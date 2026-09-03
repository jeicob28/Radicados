import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoRadicado, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { DiasHabilesService } from '../common/dias-habiles.service';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';
import { AsignarDto, MotivoDto, ReasignarDto, TrasladarDto } from './dto';

const ABIERTOS: EstadoRadicado[] = [
  EstadoRadicado.RADICADO,
  EstadoRadicado.CLASIFICADO,
  EstadoRadicado.ASIGNADO,
  EstadoRadicado.EN_TRAMITE,
  EstadoRadicado.REABIERTO,
];
const SIN_RESPUESTA_OBLIGATORIA = ['GENERAL', 'FELICITACION', 'SUGERENCIA', 'OTRO'];

@Injectable()
export class SeguimientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly diasHabiles: DiasHabilesService,
  ) {}

  private async cargar(numero: string) {
    const r = await this.prisma.radicado.findUnique({ where: { numero } });
    if (!r) throw new NotFoundException(`Radicado ${numero} no encontrado`);
    if (r.estado === 'ANULADO') throw new BadRequestException('El radicado está anulado');
    return r;
  }

  private async proximaSecuencia(tx: Prisma.TransactionClient, radicadoId: string) {
    const a = await tx.eventoTramite.aggregate({
      where: { radicadoId },
      _max: { secuencia: true },
    });
    return (a._max.secuencia ?? 0) + 1;
  }

  async asignar(numero: string, dto: AsignarDto, ctx: AuditCtx) {
    const r = await this.cargar(numero);
    if (!['RADICADO', 'CLASIFICADO', 'REABIERTO'].includes(r.estado)) {
      throw new BadRequestException(`No se puede asignar un radicado en estado ${r.estado}`);
    }
    const dep = await this.prisma.dependencia.findUnique({ where: { id: dto.dependenciaId } });
    if (!dep) throw new BadRequestException('Dependencia inexistente');
    if (dto.funcionarioId) {
      const f = await this.prisma.usuario.findUnique({ where: { id: dto.funcionarioId } });
      if (!f) throw new BadRequestException('Funcionario inexistente');
    }

    const actualizado = await this.prisma.$transaction(async (tx) => {
      await tx.eventoTramite.create({
        data: {
          radicadoId: r.id,
          secuencia: await this.proximaSecuencia(tx, r.id),
          tipoEvento: 'ASIGNADO',
          estadoAnterior: r.estado,
          estadoNuevo: 'ASIGNADO',
          actorId: ctx.usuario?.id ?? null,
          ip: ctx.ip ?? null,
          observacion: dto.observacion ?? `Asignado a ${dep.nombre}`,
          datos: { dependenciaId: dto.dependenciaId, funcionarioId: dto.funcionarioId ?? null },
        },
      });
      return tx.radicado.update({
        where: { id: r.id },
        data: {
          estado: 'ASIGNADO',
          dependenciaId: dto.dependenciaId,
          funcionarioId: dto.funcionarioId ?? null,
          fechaAsignacion: r.fechaAsignacion ?? new Date(),
        },
      });
    });

    await this.notificar(dto.funcionarioId, 'ASIGNACION', `Radicado ${numero} asignado`, r.asunto, numero);
    await this.bitacora.registrar({
      ctx, entidad: 'radicado', entidadId: r.id, accion: 'ASIGNAR',
      antes: { estado: r.estado, dependenciaId: r.dependenciaId },
      despues: { estado: 'ASIGNADO', dependenciaId: dto.dependenciaId, funcionarioId: dto.funcionarioId ?? null },
    });
    return actualizado;
  }

  async aceptar(numero: string, ctx: AuditCtx) {
    const r = await this.cargar(numero);
    if (r.estado !== 'ASIGNADO') {
      throw new BadRequestException('Solo se acepta un radicado en estado ASIGNADO');
    }
    if (
      r.funcionarioId &&
      ctx.usuario &&
      r.funcionarioId !== ctx.usuario.id &&
      !ctx.usuario.roles.includes(ROLES.JEFE) &&
      !ctx.usuario.roles.includes(ROLES.ADMIN)
    ) {
      throw new ForbiddenException('El radicado está asignado a otro funcionario');
    }

    const actualizado = await this.prisma.$transaction(async (tx) => {
      await tx.eventoTramite.create({
        data: {
          radicadoId: r.id,
          secuencia: await this.proximaSecuencia(tx, r.id),
          tipoEvento: 'EN_TRAMITE',
          estadoAnterior: r.estado,
          estadoNuevo: 'EN_TRAMITE',
          actorId: ctx.usuario?.id ?? null,
          ip: ctx.ip ?? null,
          observacion: 'Recibido y en trámite',
        },
      });
      return tx.radicado.update({
        where: { id: r.id },
        data: {
          estado: 'EN_TRAMITE',
          funcionarioId: r.funcionarioId ?? ctx.usuario?.id ?? null,
        },
      });
    });

    await this.bitacora.registrar({
      ctx, entidad: 'radicado', entidadId: r.id, accion: 'CAMBIAR_ESTADO',
      antes: { estado: r.estado }, despues: { estado: 'EN_TRAMITE' },
    });
    return actualizado;
  }

  async trasladar(numero: string, dto: TrasladarDto, ctx: AuditCtx) {
    const r = await this.cargar(numero);
    if (!['ASIGNADO', 'EN_TRAMITE'].includes(r.estado)) {
      throw new BadRequestException(`No se puede trasladar en estado ${r.estado}`);
    }
    const dep = await this.prisma.dependencia.findUnique({ where: { id: dto.dependenciaId } });
    if (!dep) throw new BadRequestException('Dependencia destino inexistente');

    const actualizado = await this.prisma.$transaction(async (tx) => {
      await tx.eventoTramite.create({
        data: {
          radicadoId: r.id,
          secuencia: await this.proximaSecuencia(tx, r.id),
          tipoEvento: 'TRASLADADO',
          estadoAnterior: r.estado,
          estadoNuevo: 'ASIGNADO',
          actorId: ctx.usuario?.id ?? null,
          ip: ctx.ip ?? null,
          observacion: dto.motivo,
          datos: { origen: r.dependenciaId, destino: dto.dependenciaId },
        },
      });
      return tx.radicado.update({
        where: { id: r.id },
        data: {
          estado: 'ASIGNADO',
          dependenciaId: dto.dependenciaId,
          funcionarioId: dto.funcionarioId ?? null,
        },
      });
    });

    await this.notificar(dto.funcionarioId, 'TRASLADO', `Radicado ${numero} trasladado a su dependencia`, dto.motivo, numero);
    await this.bitacora.registrar({
      ctx, entidad: 'radicado', entidadId: r.id, accion: 'TRASLADAR',
      antes: { dependenciaId: r.dependenciaId }, despues: { dependenciaId: dto.dependenciaId }, observacion: dto.motivo,
    });
    return actualizado;
  }

  async reasignar(numero: string, dto: ReasignarDto, ctx: AuditCtx) {
    const r = await this.cargar(numero);
    if (!['ASIGNADO', 'EN_TRAMITE'].includes(r.estado)) {
      throw new BadRequestException(`No se puede reasignar en estado ${r.estado}`);
    }
    const f = await this.prisma.usuario.findUnique({ where: { id: dto.funcionarioId } });
    if (!f) throw new BadRequestException('Funcionario inexistente');

    const actualizado = await this.prisma.$transaction(async (tx) => {
      await tx.eventoTramite.create({
        data: {
          radicadoId: r.id,
          secuencia: await this.proximaSecuencia(tx, r.id),
          tipoEvento: 'REASIGNADO',
          estadoAnterior: r.estado,
          estadoNuevo: r.estado,
          actorId: ctx.usuario?.id ?? null,
          ip: ctx.ip ?? null,
          observacion: dto.motivo,
          datos: { de: r.funcionarioId, a: dto.funcionarioId },
        },
      });
      return tx.radicado.update({
        where: { id: r.id },
        data: { funcionarioId: dto.funcionarioId },
      });
    });

    await this.notificar(dto.funcionarioId, 'ASIGNACION', `Radicado ${numero} reasignado a usted`, dto.motivo, numero);
    await this.bitacora.registrar({
      ctx, entidad: 'radicado', entidadId: r.id, accion: 'REASIGNAR',
      antes: { funcionarioId: r.funcionarioId }, despues: { funcionarioId: dto.funcionarioId }, observacion: dto.motivo,
    });
    return actualizado;
  }

  async devolver(numero: string, dto: MotivoDto, ctx: AuditCtx) {
    const r = await this.cargar(numero);
    if (!['ASIGNADO', 'EN_TRAMITE'].includes(r.estado)) {
      throw new BadRequestException(`No se puede devolver en estado ${r.estado}`);
    }
    const actualizado = await this.prisma.$transaction(async (tx) => {
      await tx.eventoTramite.create({
        data: {
          radicadoId: r.id,
          secuencia: await this.proximaSecuencia(tx, r.id),
          tipoEvento: 'TRASLADADO',
          estadoAnterior: r.estado,
          estadoNuevo: 'RADICADO',
          actorId: ctx.usuario?.id ?? null,
          ip: ctx.ip ?? null,
          observacion: `Devuelto: ${dto.motivo}`,
        },
      });
      return tx.radicado.update({
        where: { id: r.id },
        data: { estado: 'RADICADO', funcionarioId: null },
      });
    });
    await this.bitacora.registrar({
      ctx, entidad: 'radicado', entidadId: r.id, accion: 'CAMBIAR_ESTADO',
      antes: { estado: r.estado }, despues: { estado: 'RADICADO' }, observacion: dto.motivo,
    });
    return actualizado;
  }

  async cerrar(numero: string, dto: { observacion?: string }, ctx: AuditCtx) {
    const r = await this.cargar(numero);
    const puede =
      r.estado === 'RESPONDIDO' ||
      (r.estado === 'EN_TRAMITE' && SIN_RESPUESTA_OBLIGATORIA.includes(r.tipoComunicacion));
    if (!puede) {
      throw new BadRequestException(
        `Para cerrar, el radicado debe estar RESPONDIDO (estado actual: ${r.estado})`,
      );
    }
    const actualizado = await this.prisma.$transaction(async (tx) => {
      await tx.eventoTramite.create({
        data: {
          radicadoId: r.id,
          secuencia: await this.proximaSecuencia(tx, r.id),
          tipoEvento: 'CERRADO',
          estadoAnterior: r.estado,
          estadoNuevo: 'CERRADO',
          actorId: ctx.usuario?.id ?? null,
          ip: ctx.ip ?? null,
          observacion: dto.observacion ?? 'Trámite cerrado',
        },
      });
      return tx.radicado.update({
        where: { id: r.id },
        data: { estado: 'CERRADO', fechaCierre: new Date(), nivelAlerta: 'NA', diasHabilesRestantes: null },
      });
    });
    await this.bitacora.registrar({
      ctx, entidad: 'radicado', entidadId: r.id, accion: 'CAMBIAR_ESTADO',
      antes: { estado: r.estado }, despues: { estado: 'CERRADO' },
    });
    return actualizado;
  }

  async reabrir(numero: string, dto: MotivoDto, ctx: AuditCtx) {
    const r = await this.cargar(numero);
    if (r.estado !== 'CERRADO') {
      throw new BadRequestException('Solo se reabre un radicado CERRADO');
    }
    const actualizado = await this.prisma.$transaction(async (tx) => {
      await tx.eventoTramite.create({
        data: {
          radicadoId: r.id,
          secuencia: await this.proximaSecuencia(tx, r.id),
          tipoEvento: 'REABIERTO',
          estadoAnterior: 'CERRADO',
          estadoNuevo: 'EN_TRAMITE',
          actorId: ctx.usuario?.id ?? null,
          ip: ctx.ip ?? null,
          observacion: dto.motivo,
        },
      });
      return tx.radicado.update({
        where: { id: r.id },
        data: { estado: 'EN_TRAMITE', fechaCierre: null },
      });
    });
    await this.bitacora.registrar({
      ctx, entidad: 'radicado', entidadId: r.id, accion: 'CAMBIAR_ESTADO',
      antes: { estado: 'CERRADO' }, despues: { estado: 'EN_TRAMITE' }, observacion: dto.motivo,
    });
    return actualizado;
  }

  // ---------------------------------------------------------------------------

  private async notificar(
    usuarioId: string | undefined | null,
    tipo: string,
    titulo: string,
    cuerpo: string | undefined,
    radicadoNumero: string,
  ) {
    if (!usuarioId) return;
    await this.prisma.notificacion
      .createMany({
        data: [{ usuarioId, tipo, titulo, cuerpo: cuerpo ?? null, radicadoNumero }],
        skipDuplicates: true,
      })
      .catch(() => undefined);
  }

  async bandeja(usuarioId: string) {
    const items = await this.prisma.radicado.findMany({
      where: { funcionarioId: usuarioId, estado: { in: ABIERTOS } },
      orderBy: [{ nivelAlerta: 'desc' }, { fechaVencimiento: 'asc' }],
      include: {
        tercero: { select: { nombre: true } },
        dependencia: { select: { codigo: true } },
      },
    });
    return items.map((r) => ({
      numero: r.numero,
      asunto: r.asunto,
      estado: r.estado,
      tipoComunicacion: r.tipoComunicacion,
      remitente: r.tercero?.nombre ?? r.destinatario,
      fechaVencimiento: r.fechaVencimiento,
      nivelAlerta: r.nivelAlerta,
      diasHabilesRestantes: r.diasHabilesRestantes,
    }));
  }

  async vencimientos(params: { dependenciaId?: string; nivel?: string }) {
    const where: Prisma.RadicadoWhereInput = {
      estado: { in: ABIERTOS },
      fechaVencimiento: { not: null },
    };
    if (params.dependenciaId) where.dependenciaId = params.dependenciaId;
    if (params.nivel) where.nivelAlerta = params.nivel as never;

    const items = await this.prisma.radicado.findMany({
      where,
      orderBy: [{ nivelAlerta: 'desc' }, { fechaVencimiento: 'asc' }],
      include: {
        dependencia: { select: { codigo: true, nombre: true } },
        funcionario: { select: { nombre: true } },
        tercero: { select: { nombre: true } },
      },
      take: 500,
    });
    return items.map((r) => ({
      numero: r.numero,
      asunto: r.asunto,
      tipoComunicacion: r.tipoComunicacion,
      dependencia: r.dependencia?.nombre,
      responsable: r.funcionario?.nombre ?? null,
      remitente: r.tercero?.nombre,
      fechaVencimiento: r.fechaVencimiento,
      nivelAlerta: r.nivelAlerta,
      diasHabilesRestantes: r.diasHabilesRestantes,
    }));
  }

  async indicadores(dependenciaId?: string) {
    const base: Prisma.RadicadoWhereInput = dependenciaId ? { dependenciaId } : {};

    const [abiertos, vencidos, porVencer, respondidos, cerrados, porNivel] = await Promise.all([
      this.prisma.radicado.count({ where: { ...base, estado: { in: ABIERTOS } } }),
      this.prisma.radicado.count({ where: { ...base, estado: { in: ABIERTOS }, nivelAlerta: 'VENCIDO' } }),
      this.prisma.radicado.count({ where: { ...base, estado: { in: ABIERTOS }, nivelAlerta: { in: ['AMARILLO', 'ROJO'] } } }),
      this.prisma.radicado.findMany({
        where: { ...base, fechaPrimeraRespuesta: { not: null } },
        select: { fechaHoraRadicacion: true, fechaPrimeraRespuesta: true },
        take: 1000,
      }),
      this.prisma.radicado.count({ where: { ...base, estado: 'CERRADO' } }),
      this.prisma.radicado.groupBy({
        by: ['nivelAlerta'],
        where: { ...base, estado: { in: ABIERTOS } },
        _count: true,
      }),
    ]);

    let tiempoPromedioHoras: number | null = null;
    if (respondidos.length) {
      const suma = respondidos.reduce(
        (acc, r) =>
          acc + (r.fechaPrimeraRespuesta!.getTime() - r.fechaHoraRadicacion.getTime()),
        0,
      );
      tiempoPromedioHoras = Math.round((suma / respondidos.length / 3_600_000) * 10) / 10;
    }

    return {
      abiertos,
      vencidos,
      porVencer,
      cerrados,
      respondidos: respondidos.length,
      tiempoPromedioRespuestaHoras: tiempoPromedioHoras,
      semaforo: Object.fromEntries(porNivel.map((g) => [g.nivelAlerta, g._count])),
    };
  }
}
