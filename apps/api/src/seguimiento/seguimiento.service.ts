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
import type { AuditCtx, UsuarioActual } from '../auth/decorators';
import { ROLES } from '../auth/roles';
import { alcanceDependencia } from '../common/visibilidad-radicados';
import { adjuntarComoAnexos } from '../common/anexos.util';
import {
  AsignarDto,
  ComunicadoOficialDto,
  MotivoDto,
  ObservacionDto,
  ReasignarDto,
  ResponderDto,
  TrasladarDto,
} from './dto';

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

  /** Notifica a todos los usuarios activos que tienen el rol indicado. */
  private async notificarRol(
    rol: string,
    tipo: string,
    titulo: string,
    cuerpo: string | undefined,
    radicadoNumero: string,
  ) {
    const usuarios = await this.prisma.usuario.findMany({
      where: { activo: true, roles: { has: rol } },
      select: { id: true },
    });
    if (!usuarios.length) return;
    await this.prisma.notificacion
      .createMany({
        data: usuarios.map((u) => ({
          usuarioId: u.id,
          tipo,
          titulo,
          cuerpo: cuerpo ?? null,
          radicadoNumero,
        })),
        skipDuplicates: true,
      })
      .catch(() => undefined);
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
      await adjuntarComoAnexos(tx, r.id, dto.adjuntos, 'Soporte de la asignación');
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

  async aceptar(numero: string, dto: ObservacionDto, ctx: AuditCtx) {
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
          observacion: dto.observacion ? `Recibido y en trámite. ${dto.observacion}` : 'Recibido y en trámite',
        },
      });
      await adjuntarComoAnexos(tx, r.id, dto.adjuntos, 'Soporte al aceptar el trámite');
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
      await adjuntarComoAnexos(tx, r.id, dto.adjuntos, 'Soporte del traslado');
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
      await adjuntarComoAnexos(tx, r.id, dto.adjuntos, 'Soporte de la reasignación');
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
      await adjuntarComoAnexos(tx, r.id, dto.adjuntos, 'Soporte de la devolución');
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

  async cerrar(numero: string, dto: ObservacionDto, ctx: AuditCtx) {
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
      await adjuntarComoAnexos(tx, r.id, dto.adjuntos, 'Soporte del cierre');
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

  /**
   * El funcionario responde el radicado de entrada. Ver Requerimientos §21.2.
   *  - variante DIRECTA: ya respondió al solicitante → el radicado se CIERRA
   *    y Ventanilla Única recibe una notificación informativa.
   *  - variante COMUNICADO_OFICIAL: el radicado pasa a POR_COMUNICAR y le
   *    llega a Ventanilla como tarea para emitir el comunicado oficial.
   * En ninguno de los dos casos se genera un consecutivo de salida: la
   * respuesta se archiva sobre el mismo radicado de entrada.
   */
  async responder(numero: string, dto: ResponderDto, ctx: AuditCtx) {
    const r = await this.cargar(numero);
    if (r.estado !== 'EN_TRAMITE') {
      throw new BadRequestException(
        `Para responder, el radicado debe estar EN_TRAMITE (estado actual: ${r.estado}). ` +
          'Acepte primero el trámite.',
      );
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

    const directa = dto.variante === 'DIRECTA';
    const estadoNuevo = directa ? 'CERRADO' : 'POR_COMUNICAR';
    const ahora = new Date();

    const actualizado = await this.prisma.$transaction(async (tx) => {
      await tx.eventoTramite.create({
        data: {
          radicadoId: r.id,
          secuencia: await this.proximaSecuencia(tx, r.id),
          tipoEvento: directa ? 'CERRADO' : 'RESPUESTA_GENERADA',
          estadoAnterior: r.estado,
          estadoNuevo,
          actorId: ctx.usuario?.id ?? null,
          ip: ctx.ip ?? null,
          observacion:
            (directa
              ? `Respuesta directa (${dto.medioRespuesta}). `
              : `Respuesta lista, requiere comunicado oficial (${dto.medioRespuesta}). `) + dto.notas,
        },
      });
      await adjuntarComoAnexos(tx, r.id, dto.adjuntos, 'Evidencia de la respuesta');
      return tx.radicado.update({
        where: { id: r.id },
        data: {
          estado: estadoNuevo,
          medioRespuesta: dto.medioRespuesta,
          fechaPrimeraRespuesta: r.fechaPrimeraRespuesta ?? ahora,
          ...(directa
            ? { fechaCierre: ahora, nivelAlerta: 'NA', diasHabilesRestantes: null }
            : {}),
        },
      });
    });

    if (directa) {
      await this.notificarRol(
        ROLES.VENTANILLA,
        'RADICADO_CERRADO',
        `Radicado ${numero} cerrado con respuesta directa`,
        dto.notas,
        numero,
      );
    } else {
      await this.notificarRol(
        ROLES.VENTANILLA,
        'COMUNICADO_PENDIENTE',
        `Preparar comunicado oficial — radicado ${numero}`,
        dto.notas,
        numero,
      );
    }

    await this.bitacora.registrar({
      ctx,
      entidad: 'radicado',
      entidadId: r.id,
      accion: 'RESPONDER',
      antes: { estado: r.estado },
      despues: { estado: estadoNuevo, variante: dto.variante, medioRespuesta: dto.medioRespuesta },
      observacion: dto.notas,
    });
    return actualizado;
  }

  /**
   * Ventanilla Única emite el comunicado oficial de respuesta y cierra el
   * radicado. Solo aplica a radicados en estado POR_COMUNICAR.
   */
  async emitirComunicado(numero: string, dto: ComunicadoOficialDto, ctx: AuditCtx) {
    const r = await this.cargar(numero);
    if (r.estado !== 'POR_COMUNICAR') {
      throw new BadRequestException(
        `El radicado no está a la espera de comunicado oficial (estado actual: ${r.estado})`,
      );
    }
    const ahora = new Date();
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
          observacion: dto.observacion
            ? `Comunicado oficial emitido. ${dto.observacion}`
            : 'Comunicado oficial emitido.',
        },
      });
      await adjuntarComoAnexos(tx, r.id, dto.adjuntos, 'Comunicado oficial');
      return tx.radicado.update({
        where: { id: r.id },
        data: { estado: 'CERRADO', fechaCierre: ahora, nivelAlerta: 'NA', diasHabilesRestantes: null },
      });
    });

    if (r.funcionarioId) {
      await this.notificar(
        r.funcionarioId,
        'RADICADO_CERRADO',
        `Comunicado oficial emitido — radicado ${numero} cerrado`,
        dto.observacion,
        numero,
      );
    }
    await this.bitacora.registrar({
      ctx,
      entidad: 'radicado',
      entidadId: r.id,
      accion: 'CAMBIAR_ESTADO',
      antes: { estado: r.estado },
      despues: { estado: 'CERRADO' },
      observacion: 'Comunicado oficial emitido',
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
      await adjuntarComoAnexos(tx, r.id, dto.adjuntos, 'Soporte de la reapertura');
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

  async vencimientos(
    params: { dependenciaId?: string; nivel?: string },
    usuario?: UsuarioActual,
  ) {
    // Ventanilla única: quien no tiene visibilidad total solo ve su
    // dependencia (ignora el dependenciaId del query); sin dependencia
    // asignada no ve nada.
    const alcance = alcanceDependencia(usuario);
    if (alcance === '') return [];
    if (alcance) params = { ...params, dependenciaId: alcance };

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

  async indicadores(dependenciaId?: string, usuario?: UsuarioActual) {
    const alcance = alcanceDependencia(usuario);
    if (alcance === '') {
      return {
        abiertos: 0,
        vencidos: 0,
        porVencer: 0,
        cerrados: 0,
        respondidos: 0,
        tiempoPromedioRespuestaHoras: null,
        semaforo: {},
      };
    }
    if (alcance) dependenciaId = alcance;

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
