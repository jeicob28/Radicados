import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface Reporte {
  titulo: string;
  generado: string;
  columnas: string[];
  filas: (string | number | null)[][];
  resumen?: Record<string, unknown>;
}

interface Filtro {
  desde?: Date;
  hasta?: Date;
  dependenciaId?: string;
  vigencia?: number;
}

const ABIERTOS = ['RADICADO', 'CLASIFICADO', 'ASIGNADO', 'EN_TRAMITE', 'REABIERTO'];

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  private rango(f: Filtro): Prisma.RadicadoWhereInput {
    const w: Prisma.RadicadoWhereInput = {};
    if (f.vigencia) w.vigencia = f.vigencia;
    if (f.dependenciaId) w.dependenciaId = f.dependenciaId;
    if (f.desde || f.hasta) {
      w.fechaHoraRadicacion = {
        ...(f.desde ? { gte: f.desde } : {}),
        ...(f.hasta ? { lte: f.hasta } : {}),
      };
    }
    return w;
  }

  private async filasRadicados(where: Prisma.RadicadoWhereInput) {
    const rows = await this.prisma.radicado.findMany({
      where,
      orderBy: { fechaHoraRadicacion: 'asc' },
      include: {
        tercero: { select: { nombre: true } },
        dependencia: { select: { nombre: true } },
        funcionario: { select: { nombre: true } },
      },
      take: 10000,
    });
    return rows.map((r) => [
      r.numero,
      r.fechaHoraRadicacion.toISOString().slice(0, 16).replace('T', ' '),
      r.tipoComunicacion,
      r.asunto,
      r.tercero?.nombre ?? r.destinatario ?? '',
      r.dependencia?.nombre ?? '',
      r.funcionario?.nombre ?? '',
      r.estado,
      r.fechaVencimiento ? r.fechaVencimiento.toISOString().slice(0, 10) : '',
      r.nivelAlerta,
    ]);
  }

  private readonly COLS_RAD = [
    'Radicado', 'Fecha', 'Tipo', 'Asunto', 'Remitente/Destinatario',
    'Dependencia', 'Responsable', 'Estado', 'Vence', 'Alerta',
  ];

  async generar(tipo: string, f: Filtro): Promise<Reporte> {
    const generado = new Date().toISOString();
    const base = this.rango(f);

    switch (tipo) {
      case 'recibidos': {
        const where = { ...base, tipo: 'ENT' as never };
        const filas = await this.filasRadicados(where);
        return { titulo: 'Radicados recibidos', generado, columnas: this.COLS_RAD, filas, resumen: { total: filas.length } };
      }
      case 'enviados': {
        const where = { ...base, tipo: 'SAL' as never };
        const filas = await this.filasRadicados(where);
        return { titulo: 'Radicados enviados', generado, columnas: this.COLS_RAD, filas, resumen: { total: filas.length } };
      }
      case 'pendientes': {
        const where = { ...base, estado: { in: ABIERTOS as never } };
        const filas = await this.filasRadicados(where);
        return { titulo: 'Radicados pendientes', generado, columnas: this.COLS_RAD, filas, resumen: { total: filas.length } };
      }
      case 'vencidos': {
        const where = { ...base, estado: { in: ABIERTOS as never }, nivelAlerta: 'VENCIDO' as never };
        const filas = await this.filasRadicados(where);
        return { titulo: 'Radicados vencidos', generado, columnas: this.COLS_RAD, filas, resumen: { total: filas.length } };
      }
      case 'por-dependencia': {
        const grupos = await this.prisma.radicado.groupBy({
          by: ['dependenciaId'],
          where: base,
          _count: true,
        });
        const deps = await this.prisma.dependencia.findMany();
        const nombre = new Map(deps.map((d) => [d.id, d.nombre]));
        return {
          titulo: 'Radicados por dependencia',
          generado,
          columnas: ['Dependencia', 'Cantidad'],
          filas: grupos.map((g) => [g.dependenciaId ? nombre.get(g.dependenciaId) ?? '—' : 'Sin asignar', g._count]),
          resumen: { total: grupos.reduce((a, g) => a + g._count, 0) },
        };
      }
      case 'por-funcionario': {
        const grupos = await this.prisma.radicado.groupBy({
          by: ['funcionarioId'],
          where: { ...base, funcionarioId: { not: null } },
          _count: true,
        });
        const us = await this.prisma.usuario.findMany({ select: { id: true, nombre: true } });
        const nombre = new Map(us.map((u) => [u.id, u.nombre]));
        return {
          titulo: 'Radicados por funcionario',
          generado,
          columnas: ['Funcionario', 'Cantidad'],
          filas: grupos.map((g) => [nombre.get(g.funcionarioId!) ?? '—', g._count]),
        };
      }
      case 'tiempo-respuesta': {
        const rows = await this.prisma.radicado.findMany({
          where: { ...base, fechaPrimeraRespuesta: { not: null } },
          select: {
            numero: true,
            fechaHoraRadicacion: true,
            fechaPrimeraRespuesta: true,
            dependencia: { select: { nombre: true } },
          },
          take: 10000,
        });
        const filas = rows.map((r) => {
          const h = (r.fechaPrimeraRespuesta!.getTime() - r.fechaHoraRadicacion.getTime()) / 3_600_000;
          return [r.numero, r.dependencia?.nombre ?? '', Math.round(h * 10) / 10];
        });
        const prom = filas.length
          ? Math.round((filas.reduce((a, r) => a + (r[2] as number), 0) / filas.length) * 10) / 10
          : null;
        return {
          titulo: 'Tiempo de respuesta',
          generado,
          columnas: ['Radicado', 'Dependencia', 'Horas hasta respuesta'],
          filas,
          resumen: { promedioHoras: prom, respondidos: filas.length },
        };
      }
      case 'derechos-peticion': {
        const where = {
          ...base,
          tipoComunicacion: {
            in: ['DERECHO_PETICION', 'PETICION_INFORMACION', 'PETICION_DOCUMENTOS', 'CONSULTA'] as never,
          },
        };
        const filas = await this.filasRadicados(where);
        const vencidos = filas.filter((r) => r[9] === 'VENCIDO').length;
        return {
          titulo: 'Derechos de petición y solicitudes',
          generado,
          columnas: this.COLS_RAD,
          filas,
          resumen: { total: filas.length, vencidos },
        };
      }
      case 'documentos-por-serie': {
        const grupos = await this.prisma.radicado.groupBy({
          by: ['serieId'],
          where: { ...base, serieId: { not: null } },
          _count: true,
        });
        const series = await this.prisma.serie.findMany({ select: { id: true, codigo: true, nombre: true } });
        const s = new Map(series.map((x) => [x.id, `${x.codigo} · ${x.nombre}`]));
        return {
          titulo: 'Documentos por serie documental',
          generado,
          columnas: ['Serie', 'Radicados'],
          filas: grupos.map((g) => [s.get(g.serieId!) ?? '—', g._count]),
        };
      }
      case 'anulados': {
        const rows = await this.prisma.anulacion.findMany({
          where: f.desde || f.hasta
            ? { fecha: { ...(f.desde ? { gte: f.desde } : {}), ...(f.hasta ? { lte: f.hasta } : {}) } }
            : {},
          include: {
            radicado: { select: { numero: true, asunto: true } },
            usuario: { select: { nombre: true } },
          },
          orderBy: { fecha: 'asc' },
        });
        return {
          titulo: 'Radicados anulados',
          generado,
          columnas: ['Radicado', 'Asunto', 'Fecha anulación', 'Usuario', 'Motivo', 'Justificación'],
          filas: rows.map((a) => [
            a.radicado.numero,
            a.radicado.asunto,
            a.fecha.toISOString().slice(0, 16).replace('T', ' '),
            a.usuario?.nombre ?? '',
            a.motivo,
            a.justificacion,
          ]),
          resumen: { total: rows.length },
        };
      }
      default:
        throw new BadRequestException(
          `Reporte "${tipo}" no reconocido. Disponibles: recibidos, enviados, pendientes, vencidos, ` +
            `por-dependencia, por-funcionario, tiempo-respuesta, derechos-peticion, documentos-por-serie, anulados`,
        );
    }
  }
}
