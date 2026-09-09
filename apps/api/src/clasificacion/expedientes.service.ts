import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { StorageService } from '../storage/storage.service';
import type { AuditCtx, UsuarioActual } from '../auth/decorators';
import { alcanceDependencia } from '../common/visibilidad-radicados';
import { CrearExpedienteDto, IncorporarDocumentoDto } from './dto';

@Injectable()
export class ExpedientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly storage: StorageService,
  ) {}

  private anios(fecha: Date, n: number): Date {
    return new Date(Date.UTC(fecha.getUTCFullYear() + n, fecha.getUTCMonth(), fecha.getUTCDate()));
  }

  async crear(dto: CrearExpedienteDto, ctx: AuditCtx) {
    const serie = await this.prisma.serie.findUnique({ where: { id: dto.serieId } });
    if (!serie) throw new BadRequestException('Serie inexistente');
    const dep = await this.prisma.dependencia.findUnique({ where: { id: dto.dependenciaId } });
    if (!dep) throw new BadRequestException('Dependencia inexistente');
    if (dto.subserieId) {
      const ss = await this.prisma.subserie.findFirst({
        where: { id: dto.subserieId, serieId: dto.serieId },
      });
      if (!ss) throw new BadRequestException('La subserie no pertenece a la serie');
    }

    const anio = new Date().getUTCFullYear();
    const [{ fn_siguiente_secuencia: n }] = await this.prisma.$queryRaw<
      Array<{ fn_siguiente_secuencia: number }>
    >(Prisma.sql`SELECT fn_siguiente_secuencia(${`exp:${dep.codigo}:${serie.codigo}:${anio}`})`);

    const numero = `${dep.codigo}-${serie.codigo}-${anio}-${String(n).padStart(4, '0')}`;

    const exp = await this.prisma.expediente.create({
      data: {
        numero,
        titulo: dto.titulo,
        serieId: dto.serieId,
        subserieId: dto.subserieId ?? null,
        dependenciaId: dto.dependenciaId,
        ubicacionFisica: dto.ubicacionFisica ?? null,
        creadoPorId: ctx.usuario?.id ?? null,
      },
    });

    await this.bitacora.registrar({
      ctx, entidad: 'expediente', entidadId: exp.id, accion: 'CREAR',
      despues: { numero: exp.numero, titulo: exp.titulo, serieId: dto.serieId },
    });
    return exp;
  }

  async listar(
    params: { estado?: string; serieId?: string; dependenciaId?: string; q?: string },
    usuario?: UsuarioActual,
  ) {
    const alcance = alcanceDependencia(usuario);
    if (alcance === '') return [];
    if (alcance) params = { ...params, dependenciaId: alcance };

    const where: Prisma.ExpedienteWhereInput = {};
    if (params.estado) where.estado = params.estado as never;
    if (params.serieId) where.serieId = params.serieId;
    if (params.dependenciaId) where.dependenciaId = params.dependenciaId;
    if (params.q) {
      where.OR = [
        { numero: { contains: params.q, mode: 'insensitive' } },
        { titulo: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    return this.prisma.expediente.findMany({
      where,
      orderBy: { creado: 'desc' },
      include: {
        serie: { select: { codigo: true, nombre: true } },
        subserie: { select: { codigo: true, nombre: true } },
        dependencia: { select: { codigo: true, nombre: true } },
        _count: { select: { documentos: true, radicados: true } },
      },
      take: 200,
    });
  }

  /**
   * `usuario` solo se pasa desde rutas públicas (controller); las llamadas
   * internas del servicio van sin él y no aplican la restricción por
   * dependencia.
   */
  async obtener(numero: string, usuario?: UsuarioActual) {
    const exp = await this.prisma.expediente.findUnique({
      where: { numero },
      include: {
        serie: true,
        subserie: true,
        dependencia: { select: { codigo: true, nombre: true } },
        creadoPor: { select: { nombre: true } },
        documentos: { orderBy: { orden: 'asc' } },
        radicados: {
          orderBy: { fechaHoraRadicacion: 'asc' },
          select: { numero: true, asunto: true, tipo: true, estado: true, fechaHoraRadicacion: true },
        },
      },
    });
    if (!exp) throw new NotFoundException(`Expediente ${numero} no encontrado`);
    const alcance = alcanceDependencia(usuario);
    if (alcance !== null && exp.dependenciaId !== alcance) {
      throw new ForbiddenException('No tiene acceso a este expediente');
    }
    return exp;
  }

  /** Incorpora el radicado y sus anexos como documentos del expediente. */
  async incorporarRadicado(
    tx: Prisma.TransactionClient,
    expedienteId: string,
    radicado: { id: string; numero: string; asunto: string; fechaHoraRadicacion: Date },
    anexos: Array<{ id: string; nombre: string; objectKey: string; contentType: string | null; tamanoBytes: number | null; checksumSha256: string | null }>,
    ctx: AuditCtx,
  ) {
    const agg = await tx.documentoExpediente.aggregate({
      where: { expedienteId },
      _max: { orden: true },
    });
    let orden = (agg._max.orden ?? 0) + 1;

    await tx.documentoExpediente.create({
      data: {
        expedienteId,
        orden: orden++,
        tipo: 'RADICADO',
        titulo: `${radicado.numero} · ${radicado.asunto}`,
        fecha: radicado.fechaHoraRadicacion,
        radicadoId: radicado.id,
        incorporadoPorId: ctx.usuario?.id ?? null,
      },
    });
    for (const a of anexos) {
      await tx.documentoExpediente.create({
        data: {
          expedienteId,
          orden: orden++,
          tipo: 'ANEXO',
          titulo: a.nombre,
          radicadoId: radicado.id,
          anexoId: a.id,
          objectKey: a.objectKey,
          contentType: a.contentType,
          tamanoBytes: a.tamanoBytes,
          checksumSha256: a.checksumSha256,
          incorporadoPorId: ctx.usuario?.id ?? null,
        },
      });
    }
  }

  async incorporarDocumentoSimple(
    numero: string,
    dto: IncorporarDocumentoDto,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
    ctx: AuditCtx,
  ) {
    const exp = await this.prisma.expediente.findUnique({ where: { numero } });
    if (!exp) throw new NotFoundException('Expediente no encontrado');
    if (exp.estado !== 'ABIERTO') throw new BadRequestException('El expediente no está abierto');

    let objectKey: string | null = null;
    let checksum: string | null = null;
    let tamano: number | null = null;
    let contentType: string | null = null;
    let anexoId: string | null = dto.anexoId ?? null;

    if (file?.buffer?.length) {
      const key = `expedientes/${exp.numero}/${randomUUID()}/${file.originalname.replace(/[^\w.\- ]+/g, '_')}`;
      const res = await this.storage.subir(key, file.buffer, file.mimetype);
      objectKey = res.objectKey;
      checksum = res.checksumSha256;
      tamano = res.tamanoBytes;
      contentType = file.mimetype;
    } else if (anexoId) {
      const anexo = await this.prisma.anexo.findUnique({ where: { id: anexoId } });
      if (!anexo) throw new BadRequestException('Anexo inexistente');
      objectKey = anexo.objectKey;
      checksum = anexo.checksumSha256;
      tamano = anexo.tamanoBytes;
      contentType = anexo.contentType;
    } else {
      throw new BadRequestException('Debe adjuntar un archivo o indicar un anexo existente');
    }

    const agg = await this.prisma.documentoExpediente.aggregate({
      where: { expedienteId: exp.id },
      _max: { orden: true },
    });

    const doc = await this.prisma.documentoExpediente.create({
      data: {
        expedienteId: exp.id,
        orden: (agg._max.orden ?? 0) + 1,
        tipo: anexoId ? 'ANEXO' : 'DOCUMENTO_SIMPLE',
        titulo: dto.titulo,
        fecha: new Date(),
        anexoId,
        objectKey,
        contentType,
        tamanoBytes: tamano,
        checksumSha256: checksum,
        incorporadoPorId: ctx.usuario?.id ?? null,
      },
    });

    await this.bitacora.registrar({
      ctx, entidad: 'expediente', entidadId: exp.id, accion: 'ACTUALIZAR',
      despues: { documentoIncorporado: doc.titulo, orden: doc.orden },
    });
    return doc;
  }

  /** Foliado consecutivo: 1 folio por documento sin páginas declaradas. */
  async foliar(numero: string, ctx: AuditCtx) {
    const exp = await this.prisma.expediente.findUnique({
      where: { numero },
      include: { documentos: { orderBy: { orden: 'asc' }, include: { anexo: true } } },
    });
    if (!exp) throw new NotFoundException('Expediente no encontrado');

    let folio = 1;
    for (const d of exp.documentos) {
      const paginas = d.anexo?.paginas && d.anexo.paginas > 0 ? d.anexo.paginas : 1;
      const inicio = folio;
      const fin = folio + paginas - 1;
      await this.prisma.documentoExpediente.update({
        where: { id: d.id },
        data: { folioInicio: inicio, folioFin: fin },
      });
      folio = fin + 1;
    }
    const totalFolios = folio - 1;
    await this.prisma.expediente.update({ where: { id: exp.id }, data: { totalFolios } });

    await this.bitacora.registrar({
      ctx, entidad: 'expediente', entidadId: exp.id, accion: 'ACTUALIZAR',
      despues: { foliado: true, totalFolios },
    });
    return { numero, totalFolios, documentos: exp.documentos.length };
  }

  async cerrar(numero: string, ctx: AuditCtx) {
    const exp = await this.prisma.expediente.findUnique({
      where: { numero },
      include: { serie: true, subserie: true, documentos: true, radicados: true },
    });
    if (!exp) throw new NotFoundException('Expediente no encontrado');
    if (exp.estado !== 'ABIERTO') throw new BadRequestException('El expediente ya está cerrado');
    if (exp.documentos.length === 0 && exp.radicados.length === 0) {
      throw new BadRequestException('No se puede cerrar un expediente vacío');
    }

    const ag = exp.subserie?.retencionArchivoGestion ?? exp.serie.retencionArchivoGestion;
    const ac = exp.subserie?.retencionArchivoCentral ?? exp.serie.retencionArchivoCentral;
    const disp = exp.subserie?.disposicionFinal ?? exp.serie.disposicionFinal;

    const cierre = new Date();
    const limiteAG = this.anios(cierre, ag);
    const limiteAC = this.anios(limiteAG, ac);

    // fechas extremas a partir de los documentos/radicados
    const fechas: Date[] = [
      ...exp.radicados.map((r) => r.fechaHoraRadicacion),
      ...exp.documentos.map((d) => d.fecha ?? d.incorporado),
    ];
    const inicio = fechas.length ? new Date(Math.min(...fechas.map((f) => f.getTime()))) : null;
    const fin = fechas.length ? new Date(Math.max(...fechas.map((f) => f.getTime()))) : null;

    const actualizado = await this.prisma.expediente.update({
      where: { id: exp.id },
      data: {
        estado: 'CERRADO',
        fechaCierre: cierre,
        fechaInicioExtrema: inicio,
        fechaFinExtrema: fin,
        fechaLimiteArchivoGestion: limiteAG,
        fechaLimiteArchivoCentral: limiteAC,
        disposicionFinal: disp,
      },
    });

    await this.bitacora.registrar({
      ctx, entidad: 'expediente', entidadId: exp.id, accion: 'CAMBIAR_ESTADO',
      antes: { estado: 'ABIERTO' },
      despues: {
        estado: 'CERRADO',
        limiteArchivoGestion: limiteAG.toISOString().slice(0, 10),
        limiteArchivoCentral: limiteAC.toISOString().slice(0, 10),
        disposicionFinal: disp,
      },
    });
    return actualizado;
  }

  /** Hoja de control / índice del expediente. */
  async indice(numero: string, usuario?: UsuarioActual) {
    const exp = await this.obtener(numero, usuario);
    return {
      expediente: exp.numero,
      titulo: exp.titulo,
      serie: `${exp.serie.codigo} · ${exp.serie.nombre}`,
      subserie: exp.subserie ? `${exp.subserie.codigo} · ${exp.subserie.nombre}` : null,
      dependencia: exp.dependencia.nombre,
      estado: exp.estado,
      fechasExtremas: { inicio: exp.fechaInicioExtrema, fin: exp.fechaFinExtrema },
      totalFolios: exp.totalFolios,
      retencion: exp.fechaLimiteArchivoGestion
        ? {
            limiteArchivoGestion: exp.fechaLimiteArchivoGestion,
            limiteArchivoCentral: exp.fechaLimiteArchivoCentral,
            disposicionFinal: exp.disposicionFinal,
          }
        : null,
      documentos: exp.documentos.map((d) => ({
        orden: d.orden,
        tipo: d.tipo,
        titulo: d.titulo,
        fecha: d.fecha,
        folios: d.folioInicio != null ? `${d.folioInicio}-${d.folioFin}` : null,
        radicado: d.radicadoId ? undefined : null,
      })),
    };
  }

  async verificarIntegridad(numero: string, ctx: AuditCtx) {
    const exp = await this.prisma.expediente.findUnique({
      where: { numero },
      include: { documentos: true },
    });
    if (!exp) throw new NotFoundException('Expediente no encontrado');

    const resultados: Array<{ titulo: string; estado: string }> = [];
    for (const d of exp.documentos) {
      if (!d.objectKey || !d.checksumSha256) {
        resultados.push({ titulo: d.titulo, estado: 'SIN_CHECKSUM' });
        continue;
      }
      try {
        const ok = await this.storage.verificarChecksum(d.objectKey, d.checksumSha256);
        resultados.push({ titulo: d.titulo, estado: ok ? 'OK' : 'ALTERADO' });
      } catch {
        resultados.push({ titulo: d.titulo, estado: 'NO_ENCONTRADO' });
      }
    }
    const ok = resultados.every((r) => r.estado === 'OK' || r.estado === 'SIN_CHECKSUM');

    await this.bitacora.registrar({
      ctx, entidad: 'expediente', entidadId: exp.id, accion: 'LEER',
      observacion: 'Verificación de integridad',
      despues: { ok, revisados: resultados.length },
    });
    return { expediente: numero, ok, resultados };
  }
}
