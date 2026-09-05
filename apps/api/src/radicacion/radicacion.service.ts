import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { DiasHabilesService } from '../common/dias-habiles.service';
import { hashRadicado } from '../common/hash';
import type { AuditCtx, UsuarioActual } from '../auth/decorators';
import { tieneVisibilidadTotal } from '../common/visibilidad-radicados';
import { AnularRadicadoDto, RadicarDto } from './dto';

interface AsignacionConsecutivo {
  consecutivo_id: string;
  secuencial: number;
  numero: string;
}

@Injectable()
export class RadicacionService {
  private readonly logger = new Logger(RadicacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly diasHabiles: DiasHabilesService,
  ) {}

  private async vigenciaActual(): Promise<number> {
    const p = await this.prisma.parametro.findUnique({
      where: { clave: 'consecutivo.vigencia_actual' },
    });
    return typeof p?.valor === 'number' ? (p.valor as number) : new Date().getUTCFullYear();
  }

  /**
   * Radica una comunicación. El número se asigna dentro de una transacción
   * SERIALIZABLE mediante fn_asignar_consecutivo; si aborta por conflicto de
   * serialización se reintenta y el número NO se consume.
   */
  async radicar(dto: RadicarDto, ctx: AuditCtx) {
    const vigencia = await this.vigenciaActual();
    const tipoComunicacion = dto.tipoComunicacion ?? 'GENERAL';

    if (dto.terceroId) {
      const t = await this.prisma.tercero.findUnique({ where: { id: dto.terceroId } });
      if (!t) throw new BadRequestException('El tercero indicado no existe');
    }
    if (dto.dependenciaId) {
      const d = await this.prisma.dependencia.findUnique({ where: { id: dto.dependenciaId } });
      if (!d) throw new BadRequestException('La dependencia indicada no existe');
    }

    let entradaRelacionada: { id: string; numero: string } | null = null;
    if (dto.enRespuestaA) {
      if (dto.tipo !== 'SAL') {
        throw new BadRequestException('"enRespuestaA" solo aplica a radicados de salida');
      }
      const e = await this.prisma.radicado.findUnique({
        where: { numero: dto.enRespuestaA },
        select: { id: true, numero: true, estado: true },
      });
      if (!e) throw new BadRequestException(`El radicado ${dto.enRespuestaA} no existe`);
      if (e.estado === 'ANULADO') throw new BadRequestException('El radicado a responder está anulado');
      entradaRelacionada = { id: e.id, numero: e.numero };
    }

    // Vencimiento (solo entrada, según el plazo legal del tipo de comunicación)
    let fechaVencimiento: Date | null = null;
    if (dto.tipo === 'ENT') {
      const plazo = await this.diasHabiles.plazoPara(tipoComunicacion);
      if (plazo) fechaVencimiento = await this.diasHabiles.sumarHabiles(new Date(), plazo);
    }

    const terceroDoc = dto.terceroId ?? 's/d';

    const MAX_INTENTOS = 4;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      try {
        const radicado = await this.prisma.$transaction(
          async (tx) => {
            const [asignacion] = await tx.$queryRaw<AsignacionConsecutivo[]>(
              Prisma.sql`SELECT * FROM fn_asignar_consecutivo(${vigencia}::int, ${dto.tipo}::"TipoConsecutivo")`,
            );

            const anterior = await tx.radicado.findFirst({
              where: { vigencia, tipo: dto.tipo as never },
              orderBy: { secuencial: 'desc' },
              select: { hashRegistro: true },
            });

            const fechaHora = new Date();
            const hash = hashRadicado({
              numero: asignacion.numero,
              fechaHoraIso: fechaHora.toISOString(),
              terceroDocumento: terceroDoc,
              asunto: dto.asunto,
              hashAnterior: anterior?.hashRegistro ?? null,
            });

            const creado = await tx.radicado.create({
              data: {
                numero: asignacion.numero,
                vigencia,
                tipo: dto.tipo as never,
                consecutivoId: asignacion.consecutivo_id,
                secuencial: asignacion.secuencial,
                origen: 'SISTEMA',
                canal: dto.canal as never,
                fechaHoraRadicacion: fechaHora,
                fechaRecepcion: dto.fechaRecepcion ? new Date(dto.fechaRecepcion) : null,
                entregadoPor: dto.entregadoPor ?? null,
                terceroId: dto.terceroId ?? null,
                destinatario: dto.destinatario ?? null,
                dependenciaId: dto.dependenciaId ?? null,
                asunto: dto.asunto,
                tipoComunicacion: tipoComunicacion as never,
                medioRespuesta: dto.medioRespuesta ?? null,
                folios: dto.folios ?? 0,
                estado: 'RADICADO',
                fechaVencimiento,
                radicadoRespuestaId: entradaRelacionada?.id ?? null,
                hashRegistro: hash,
                hashAnterior: anterior?.hashRegistro ?? null,
              },
            });

            await tx.eventoTramite.create({
              data: {
                radicadoId: creado.id,
                secuencia: 1,
                tipoEvento: 'RADICADO',
                estadoNuevo: 'RADICADO',
                actorId: ctx.usuario?.id ?? null,
                ip: ctx.ip ?? null,
                observacion: `Radicado por ${dto.canal.toLowerCase()}`,
              },
            });

            if (dto.adjuntos?.length) {
              await tx.anexo.createMany({
                data: dto.adjuntos.map((a) => ({
                  radicadoId: creado.id,
                  nombre: a.nombre,
                  descripcion: a.descripcion ?? null,
                  objectKey: a.objectKey,
                  contentType: a.contentType ?? null,
                  tamanoBytes: a.tamanoBytes ?? null,
                  checksumSha256: a.checksumSha256 ?? null,
                  paginas: a.paginas ?? null,
                })),
              });
            }

            if (entradaRelacionada) {
              const seq = await tx.eventoTramite.aggregate({
                where: { radicadoId: entradaRelacionada.id },
                _max: { secuencia: true },
              });
              await tx.eventoTramite.create({
                data: {
                  radicadoId: entradaRelacionada.id,
                  secuencia: (seq._max.secuencia ?? 0) + 1,
                  tipoEvento: 'RESPUESTA_GENERADA',
                  estadoNuevo: 'RESPONDIDO',
                  actorId: ctx.usuario?.id ?? null,
                  ip: ctx.ip ?? null,
                  observacion: `Respuesta con radicado ${asignacion.numero}`,
                },
              });
              await tx.radicado.update({
                where: { id: entradaRelacionada.id },
                data: {
                  estado: 'RESPONDIDO',
                  fechaPrimeraRespuesta: fechaHora,
                  nivelAlerta: 'NA',
                  diasHabilesRestantes: null,
                },
              });
            }

            return creado;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        await this.bitacora.registrar({
          ctx,
          entidad: 'radicado',
          entidadId: radicado.id,
          accion: 'CREAR',
          despues: {
            numero: radicado.numero,
            tipo: radicado.tipo,
            asunto: radicado.asunto,
            tipoComunicacion: radicado.tipoComunicacion,
            fechaVencimiento: radicado.fechaVencimiento,
            entregadoPor: radicado.entregadoPor,
          },
        });

        return this.obtener(radicado.numero);
      } catch (e) {
        const code = (e as Prisma.PrismaClientKnownRequestError)?.code;
        const serializacion =
          code === 'P2034' ||
          (e as { meta?: { code?: string } })?.meta?.code === '40001' ||
          /could not serialize|deadlock detected/i.test((e as Error).message ?? '');

        if (serializacion && intento < MAX_INTENTOS) {
          this.logger.warn(`Conflicto de serialización al radicar (intento ${intento}); reintentando`);
          await new Promise((r) => setTimeout(r, 40 * intento));
          continue;
        }
        if (code === 'P2002') {
          throw new ConflictException('Colisión de número de radicado; reintente');
        }
        throw e;
      }
    }
    throw new ConflictException('No fue posible asignar el consecutivo tras varios intentos');
  }

  async listar(params: {
    q?: string;
    tipo?: string;
    estado?: string;
    tipoComunicacion?: string;
    dependenciaId?: string;
    vigencia?: number;
    desde?: Date;
    hasta?: Date;
    soloVencidos?: boolean;
    page?: number;
    pageSize?: number;
  }, usuario?: UsuarioActual) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(params.pageSize ?? 20, 100);

    // Ventanilla única: quien no tiene visibilidad total solo ve lo asignado
    // a su propia dependencia (ignora cualquier dependenciaId que haya
    // pedido por query — no puede curiosear otras áreas), y si no tiene
    // dependencia asignada, no ve nada.
    if (usuario && !tieneVisibilidadTotal(usuario)) {
      if (!usuario.dependenciaId) return { total: 0, page, pageSize, items: [] };
      params = { ...params, dependenciaId: usuario.dependenciaId };
    }

    const where: Prisma.RadicadoWhereInput = {};
    if (params.tipo) where.tipo = params.tipo as never;
    if (params.estado) where.estado = params.estado as never;
    if (params.tipoComunicacion) where.tipoComunicacion = params.tipoComunicacion as never;
    if (params.dependenciaId) where.dependenciaId = params.dependenciaId;
    if (params.vigencia) where.vigencia = params.vigencia;
    if (params.desde || params.hasta) {
      where.fechaHoraRadicacion = {
        ...(params.desde ? { gte: params.desde } : {}),
        ...(params.hasta ? { lte: params.hasta } : {}),
      };
    }
    if (params.soloVencidos) {
      where.fechaVencimiento = { lt: new Date() };
      where.estado = { notIn: ['RESPONDIDO', 'CERRADO', 'ANULADO'] };
    }
    if (params.q) {
      where.OR = [
        { numero: { contains: params.q, mode: 'insensitive' } },
        { asunto: { contains: params.q, mode: 'insensitive' } },
        { tercero: { nombre: { contains: params.q, mode: 'insensitive' } } },
        { tercero: { numeroDocumento: { contains: params.q } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.radicado.count({ where }),
      this.prisma.radicado.findMany({
        where,
        orderBy: { fechaHoraRadicacion: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tercero: { select: { nombre: true, numeroDocumento: true } },
          dependencia: { select: { codigo: true, nombre: true } },
          funcionario: { select: { nombre: true } },
          _count: { select: { anexos: true } },
        },
      }),
    ]);

    return { total, page, pageSize, items };
  }

  /**
   * `usuario` solo se pasa desde rutas públicas (controller); las llamadas
   * internas tras radicar/anular se hacen sin él a propósito, para mostrarle
   * al actor el registro que él mismo acaba de crear/modificar sin importar
   * su dependencia.
   */
  async obtener(numero: string, usuario?: UsuarioActual) {
    const r = await this.prisma.radicado.findUnique({
      where: { numero },
      include: {
        tercero: true,
        dependencia: { select: { id: true, codigo: true, nombre: true } },
        funcionario: { select: { id: true, nombre: true, email: true } },
        serie: { select: { codigo: true, nombre: true } },
        subserie: { select: { codigo: true, nombre: true } },
        expediente: { select: { numero: true, titulo: true, estado: true } },
        anexos: { orderBy: { creado: 'asc' } },
        anulacion: { include: { usuario: { select: { nombre: true } } } },
        eventos: {
          orderBy: { secuencia: 'asc' },
          include: { actor: { select: { nombre: true } } },
        },
      },
    });
    if (!r) throw new NotFoundException(`Radicado ${numero} no encontrado`);
    if (usuario && !tieneVisibilidadTotal(usuario) && r.dependenciaId !== usuario.dependenciaId) {
      throw new ForbiddenException('No tiene acceso a este radicado');
    }
    return r;
  }

  async trazabilidad(numero: string, usuario?: UsuarioActual) {
    const r = await this.obtener(numero, usuario);
    return {
      numero: r.numero,
      estado: r.estado,
      fechaVencimiento: r.fechaVencimiento,
      eventos: r.eventos.map((e) => ({
        secuencia: e.secuencia,
        fechaHora: e.fechaHora,
        evento: e.tipoEvento,
        de: e.estadoAnterior,
        a: e.estadoNuevo,
        actor: e.actor?.nombre ?? null,
        ip: e.ip,
        observacion: e.observacion,
      })),
    };
  }

  async anular(numero: string, dto: AnularRadicadoDto, ctx: AuditCtx) {
    const r = await this.prisma.radicado.findUnique({
      where: { numero },
      select: { id: true, estado: true },
    });
    if (!r) throw new NotFoundException(`Radicado ${numero} no encontrado`);
    if (r.estado === 'ANULADO') throw new ConflictException('El radicado ya está anulado');

    await this.prisma.$executeRaw(
      Prisma.sql`SELECT fn_anular_radicado(${r.id}, ${ctx.usuario?.id ?? null}, ${dto.motivo}, ${dto.justificacion})`,
    );

    await this.bitacora.registrar({
      ctx,
      entidad: 'radicado',
      entidadId: r.id,
      accion: 'ANULAR',
      antes: { estado: r.estado },
      despues: { estado: 'ANULADO' },
      observacion: `${dto.motivo} — ${dto.justificacion}`,
    });

    return this.obtener(numero);
  }
}
