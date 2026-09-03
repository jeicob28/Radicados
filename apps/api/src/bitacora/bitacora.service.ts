import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditCtx } from '../auth/decorators';

export type AccionBitacora =
  | 'CREAR'
  | 'LEER'
  | 'ACTUALIZAR'
  | 'ANULAR'
  | 'ASIGNAR'
  | 'REASIGNAR'
  | 'TRASLADAR'
  | 'CAMBIAR_ESTADO'
  | 'DESCARGAR'
  | 'EXPORTAR'
  | 'LOGIN'
  | 'LOGOUT';

interface RegistroBitacora {
  ctx?: AuditCtx;
  entidad: string;
  entidadId?: string | null;
  accion: AccionBitacora;
  antes?: unknown;
  despues?: unknown;
  observacion?: string;
}

@Injectable()
export class BitacoraService {
  private readonly logger = new Logger(BitacoraService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Escribe una entrada en la bitácora. El hash encadenado lo calcula PostgreSQL
   * (trigger fn_bitacora_hash); aquí sólo se envía el contenido.
   * Nunca lanza: un fallo de auditoría se registra pero no interrumpe la operación.
   */
  async registrar(r: RegistroBitacora): Promise<void> {
    try {
      const data: Record<string, unknown> = {
        usuarioId: r.ctx?.usuario?.id ?? null,
        usuarioNombre: r.ctx?.usuario?.nombre ?? null,
        ip: r.ctx?.ip ?? null,
        userAgent: r.ctx?.userAgent ?? null,
        entidad: r.entidad,
        entidadId: r.entidadId ?? null,
        accion: r.accion,
        observacion: r.observacion ?? null,
        hash: '',
      };
      if (r.antes !== undefined) data.antes = r.antes;
      if (r.despues !== undefined) data.despues = r.despues;

      await this.prisma.bitacora.create({ data: data as never });
    } catch (e) {
      this.logger.error(`No se pudo registrar en bitácora: ${(e as Error).message}`);
    }
  }

  async listar(params: {
    entidad?: string;
    entidadId?: string;
    usuarioId?: string;
    accion?: string;
    desde?: Date;
    hasta?: Date;
    limit?: number;
    cursor?: string;
  }) {
    const where: Prisma.BitacoraWhereInput = {};
    if (params.entidad) where.entidad = params.entidad;
    if (params.entidadId) where.entidadId = params.entidadId;
    if (params.usuarioId) where.usuarioId = params.usuarioId;
    if (params.accion) where.accion = params.accion as never;
    if (params.desde || params.hasta) {
      where.fechaHora = {
        ...(params.desde ? { gte: params.desde } : {}),
        ...(params.hasta ? { lte: params.hasta } : {}),
      };
    }

    const limit = Math.min(params.limit ?? 50, 200);
    const rows = await this.prisma.bitacora.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: BigInt(params.cursor) }, skip: 1 } : {}),
    });

    const hayMas = rows.length > limit;
    const items = (hayMas ? rows.slice(0, limit) : rows).map((b) => ({
      ...b,
      id: b.id.toString(),
    }));

    return {
      items,
      siguienteCursor: hayMas ? items[items.length - 1].id : null,
    };
  }

  /** Verifica la cadena de hashes de extremo a extremo (función SQL fn_verificar_bitacora). */
  async verificar(): Promise<{ total: number; ok: boolean; rupturaEnId: string | null }> {
    const [row] = await this.prisma.$queryRaw<
      Array<{ total: bigint; ok: boolean; ruptura_id: bigint | null }>
    >`SELECT * FROM fn_verificar_bitacora()`;
    return {
      total: Number(row.total),
      ok: row.ok,
      rupturaEnId: row.ruptura_id != null ? row.ruptura_id.toString() : null,
    };
  }

  /**
   * Exportación firmada de la bitácora para entes de control: todas las entradas,
   * el resultado de la verificación de la cadena y un sello HMAC-SHA256 sobre
   * (último hash · total · fecha de generación).
   */
  async exportar(ctx: AuditCtx) {
    const verificacion = await this.verificar();
    const rows = await this.prisma.bitacora.findMany({ orderBy: { id: 'asc' } });
    const generado = new Date().toISOString();
    const ultimoHash = rows.length ? rows[rows.length - 1].hash : null;

    const secreto =
      process.env.AUDIT_EXPORT_SECRET ?? process.env.JWT_ACCESS_SECRET ?? 'dev_audit_secret';
    const sello = createHmac('sha256', secreto)
      .update(`${ultimoHash ?? ''}|${rows.length}|${generado}`)
      .digest('hex');

    await this.registrar({
      ctx,
      entidad: 'bitacora',
      accion: 'EXPORTAR',
      despues: { total: rows.length, ok: verificacion.ok },
    });

    return {
      generado,
      total: rows.length,
      verificacion,
      ultimoHash,
      sello,
      entradas: rows.map((b) => ({
        id: b.id.toString(),
        fechaHora: b.fechaHora,
        usuario: b.usuarioNombre ?? b.usuarioId,
        ip: b.ip,
        entidad: b.entidad,
        entidadId: b.entidadId,
        accion: b.accion,
        antes: b.antes,
        despues: b.despues,
        observacion: b.observacion,
        hashAnterior: b.hashAnterior,
        hash: b.hash,
      })),
    };
  }
}
