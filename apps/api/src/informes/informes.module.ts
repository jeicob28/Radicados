import { Body, Controller, Get, Injectable, Module, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiasHabilesService } from '../common/dias-habiles.service';
import { CurrentUser, Roles } from '../auth/decorators';
import type { UsuarioActual } from '../auth/decorators';
import { ROLES } from '../auth/roles';
import { alcanceDependencia } from '../common/visibilidad-radicados';

const CERRADOS_O_ANULADOS = ['CERRADO', 'ANULADO'];
const PARAM_METAS = 'kpi.metas';

interface Metas {
  porcentajeATiempoMin: number;
  tiempoPromedioDiasMax: number;
  vencidosMax: number;
  tasaCumplimientoMin: number;
}
const METAS_DEFECTO: Metas = {
  porcentajeATiempoMin: 95,
  tiempoPromedioDiasMax: 15,
  vencidosMax: 0,
  tasaCumplimientoMin: 90,
};

class MetasDto {
  @IsOptional() @IsInt() @Min(0) @Max(100) porcentajeATiempoMin?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) tiempoPromedioDiasMax?: number;
  @IsOptional() @IsInt() @Min(0) vencidosMax?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) tasaCumplimientoMin?: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

@Injectable()
export class InformesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dias: DiasHabilesService,
  ) {}

  // ── metas / KPI ───────────────────────────────────────────────────────────
  async metas(): Promise<Metas> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: PARAM_METAS } });
    return { ...METAS_DEFECTO, ...((p?.valor ?? {}) as Partial<Metas>) };
  }
  async guardarMetas(dto: MetasDto): Promise<Metas> {
    const actual = await this.metas();
    const valor = { ...actual, ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v != null)) };
    await this.prisma.parametro.upsert({
      where: { clave: PARAM_METAS },
      update: { valor: valor as never },
      create: { clave: PARAM_METAS, valor: valor as never, descripcion: 'Metas de los indicadores (informes)' },
    });
    return valor as Metas;
  }

  private rango(desde?: string, hasta?: string): Prisma.DateTimeFilter | undefined {
    if (!desde && !hasta) return undefined;
    const f: Prisma.DateTimeFilter = {};
    if (desde) f.gte = new Date(desde + 'T00:00:00');
    if (hasta) f.lte = new Date(hasta + 'T23:59:59');
    return f;
  }

  private baseWhere(dependenciaId?: string, desde?: string, hasta?: string): Prisma.RadicadoWhereInput {
    const w: Prisma.RadicadoWhereInput = {};
    if (dependenciaId) w.dependenciaId = dependenciaId;
    const r = this.rango(desde, hasta);
    if (r) w.fechaHoraRadicacion = r;
    return w;
  }

  // ── tablero principal ─────────────────────────────────────────────────────
  async tablero(usuario: UsuarioActual, dependenciaId?: string, desde?: string, hasta?: string) {
    const alcance = alcanceDependencia(usuario);
    if (alcance === '') {
      return {
        filtros: { dependenciaId: null, dependenciaNombre: null, desde: desde ?? null, hasta: hasta ?? null },
        kpi: { total: 0, abiertos: 0, cerrados: 0, vencidos: 0, enTramite: 0, porcentajeATiempo: null, tiempoPromedioDias: null, tasaCumplimiento: null },
        metas: await this.metas(),
        porEstado: [], porAlerta: [], porTipoComunicacion: [], porDependencia: [],
      };
    }
    const depFiltro = alcance || dependenciaId || undefined;
    const dep = depFiltro
      ? await this.prisma.dependencia.findUnique({ where: { id: depFiltro }, select: { codigo: true, nombre: true } })
      : null;
    const where = this.baseWhere(depFiltro, desde, hasta);

    const [total, porEstado, porAlerta, porTipo, conPlazo] = await Promise.all([
      this.prisma.radicado.count({ where }),
      this.prisma.radicado.groupBy({ by: ['estado'], where, _count: { _all: true } }),
      this.prisma.radicado.groupBy({
        by: ['nivelAlerta'],
        where: { ...where, estado: { notIn: CERRADOS_O_ANULADOS as never } },
        _count: { _all: true },
      }),
      this.prisma.radicado.groupBy({ by: ['tipoComunicacion'], where, _count: { _all: true } }),
      this.prisma.radicado.findMany({
        where: { ...where, fechaVencimiento: { not: null }, fechaPrimeraRespuesta: { not: null } },
        select: { fechaVencimiento: true, fechaPrimeraRespuesta: true, fechaHoraRadicacion: true },
        take: 5000,
      }),
    ]);

    const nEstado: Record<string, number> = {};
    for (const g of porEstado) nEstado[g.estado] = g._count._all;
    const anulados = nEstado.ANULADO ?? 0;
    const cerrados = nEstado.CERRADO ?? 0;
    const abiertos = total - cerrados - anulados;
    const vencidos = porAlerta.find((g) => g.nivelAlerta === 'VENCIDO')?._count._all ?? 0;

    const aTiempo = conPlazo.filter((c) => c.fechaPrimeraRespuesta! <= c.fechaVencimiento!).length;
    const porcentajeATiempo = conPlazo.length ? r1((aTiempo / conPlazo.length) * 100) : null;
    const tiempoPromedioDias = conPlazo.length
      ? r1(
          conPlazo.reduce(
            (a, c) => a + (c.fechaPrimeraRespuesta!.getTime() - c.fechaHoraRadicacion.getTime()) / 86_400_000,
            0,
          ) / conPlazo.length,
        )
      : null;
    const tasaCumplimiento = total - anulados > 0 ? r1((cerrados / (total - anulados)) * 100) : null;

    return {
      filtros: {
        dependenciaId: depFiltro ?? null,
        dependenciaNombre: dep ? `${dep.codigo} · ${dep.nombre}` : null,
        desde: desde ?? null,
        hasta: hasta ?? null,
        alcanceForzado: alcance != null,
      },
      kpi: {
        total,
        abiertos,
        cerrados,
        vencidos,
        enTramite: nEstado.EN_TRAMITE ?? 0,
        porcentajeATiempo,
        tiempoPromedioDias,
        tasaCumplimiento,
      },
      metas: await this.metas(),
      porEstado: porEstado.map((g) => ({ clave: g.estado, n: g._count._all })).sort((a, b) => b.n - a.n),
      porAlerta: porAlerta.map((g) => ({ clave: g.nivelAlerta, n: g._count._all })),
      porTipoComunicacion: porTipo.map((g) => ({ clave: g.tipoComunicacion, n: g._count._all })).sort((a, b) => b.n - a.n),
      porDependencia: await this.desglosePorDependencia(depFiltro, desde, hasta),
    };
  }

  /** Conteos por dependencia: si hay filtro, sus hijos directos; si no, todas. */
  private async desglosePorDependencia(dependenciaId?: string, desde?: string, hasta?: string) {
    const deps = dependenciaId
      ? await this.prisma.dependencia.findMany({ where: { parentId: dependenciaId }, select: { id: true, codigo: true, nombre: true } })
      : await this.prisma.dependencia.findMany({ where: { activa: true }, select: { id: true, codigo: true, nombre: true } });
    if (!deps.length) return [];
    const ids = deps.map((d) => d.id);
    const r = this.rango(desde, hasta);
    const whereBase: Prisma.RadicadoWhereInput = { dependenciaId: { in: ids }, ...(r ? { fechaHoraRadicacion: r } : {}) };

    const [porEstado, vencidos] = await Promise.all([
      this.prisma.radicado.groupBy({ by: ['dependenciaId', 'estado'], where: whereBase, _count: { _all: true } }),
      this.prisma.radicado.groupBy({
        by: ['dependenciaId'],
        where: { ...whereBase, nivelAlerta: 'VENCIDO', estado: { notIn: CERRADOS_O_ANULADOS as never } },
        _count: { _all: true },
      }),
    ]);
    const conHijos = new Set(
      (await this.prisma.dependencia.findMany({ where: { parentId: { in: ids } }, select: { parentId: true } }))
        .map((x) => x.parentId!),
    );
    const vencMap = new Map(vencidos.map((v) => [v.dependenciaId, v._count._all]));

    return deps
      .map((d) => {
        const filas = porEstado.filter((g) => g.dependenciaId === d.id);
        const total = filas.reduce((a, g) => a + g._count._all, 0);
        const cerrados = filas.filter((g) => g.estado === 'CERRADO').reduce((a, g) => a + g._count._all, 0);
        const anulados = filas.filter((g) => g.estado === 'ANULADO').reduce((a, g) => a + g._count._all, 0);
        return {
          id: d.id,
          codigo: d.codigo,
          nombre: d.nombre,
          esHoja: !conHijos.has(d.id),
          total,
          abiertos: total - cerrados - anulados,
          cerrados,
          vencidos: vencMap.get(d.id) ?? 0,
        };
      })
      .filter((d) => d.total > 0 || dependenciaId)
      .sort((a, b) => b.total - a.total);
  }

  // ── desglose de una dependencia ──────────────────────────────────────────
  async dependencia(usuario: UsuarioActual, id: string, desde?: string, hasta?: string) {
    const alcance = alcanceDependencia(usuario);
    if (alcance === '' || (alcance && alcance !== id)) {
      // fuera de alcance
      return { dependencia: null, tieneSubdependencias: false, subdependencias: [], funcionarios: [], casos: [] };
    }
    const dep = await this.prisma.dependencia.findUnique({
      where: { id },
      select: { id: true, codigo: true, nombre: true, hijos: { select: { id: true } } },
    });
    if (!dep) return { dependencia: null, tieneSubdependencias: false, subdependencias: [], funcionarios: [], casos: [] };

    const tieneSub = dep.hijos.length > 0;
    const subdependencias = tieneSub ? await this.desglosePorDependencia(id, desde, hasta) : [];
    const { funcionarios, casos } = await this.funcionariosYCasos(id, desde, hasta);

    return {
      dependencia: { id: dep.id, codigo: dep.codigo, nombre: dep.nombre },
      tieneSubdependencias: tieneSub,
      subdependencias,
      funcionarios,
      casos,
    };
  }

  /** Desglose por funcionario + casos en curso de los radicados asignados
   * directamente a la dependencia (no a un hijo). */
  private async funcionariosYCasos(id: string, desde?: string, hasta?: string) {
    const r = this.rango(desde, hasta);
    const where: Prisma.RadicadoWhereInput = { dependenciaId: id, ...(r ? { fechaHoraRadicacion: r } : {}) };

    const [porFunc, casos] = await Promise.all([
      this.prisma.radicado.groupBy({ by: ['funcionarioId', 'estado'], where, _count: { _all: true } }),
      this.prisma.radicado.findMany({
        where: { ...where, estado: { notIn: CERRADOS_O_ANULADOS as never } },
        select: {
          numero: true, asunto: true, estado: true, nivelAlerta: true, fechaVencimiento: true,
          tipoComunicacion: true,
          funcionario: { select: { nombre: true } },
        },
        orderBy: [{ nivelAlerta: 'desc' }, { fechaVencimiento: 'asc' }],
        take: 200,
      }),
    ]);

    const funcIds = [...new Set(porFunc.map((g) => g.funcionarioId).filter(Boolean) as string[])];
    const nombres = new Map(
      (await this.prisma.usuario.findMany({ where: { id: { in: funcIds } }, select: { id: true, nombre: true } }))
        .map((u) => [u.id, u.nombre]),
    );

    const funcAgg = new Map<string, { total: number; cerrados: number; anulados: number }>();
    for (const g of porFunc) {
      const k = g.funcionarioId ?? '—';
      const a = funcAgg.get(k) ?? { total: 0, cerrados: 0, anulados: 0 };
      a.total += g._count._all;
      if (g.estado === 'CERRADO') a.cerrados += g._count._all;
      if (g.estado === 'ANULADO') a.anulados += g._count._all;
      funcAgg.set(k, a);
    }
    const casosOut = await Promise.all(
      casos.map(async (c) => ({
        numero: c.numero,
        asunto: c.asunto,
        estado: c.estado,
        nivelAlerta: c.nivelAlerta,
        tipoComunicacion: c.tipoComunicacion,
        funcionario: c.funcionario?.nombre ?? null,
        fechaVencimiento: c.fechaVencimiento,
        diasHabilesRestantes: c.fechaVencimiento
          ? await this.dias.habilesRestantes(c.fechaVencimiento).catch(() => null)
          : null,
      })),
    );

    return {
      funcionarios: [...funcAgg.entries()]
        .map(([k, a]) => ({
          id: k,
          nombre: k === '—' ? 'Sin asignar' : nombres.get(k) ?? 'Usuario',
          total: a.total,
          abiertos: a.total - a.cerrados - a.anulados,
          cerrados: a.cerrados,
        }))
        .sort((a, b) => b.total - a.total),
      casos: casosOut,
    };
  }
}

@ApiTags('informes')
@ApiBearerAuth()
@Controller('informes')
export class InformesController {
  constructor(private readonly informes: InformesService) {}

  @Get('tablero')
  @Roles(ROLES.JEFE, ROLES.RADICADOR, ROLES.AUDITOR, ROLES.ARCHIVISTA)
  @ApiOperation({ summary: 'Tablero de informes: KPI, gráficas y desglose por dependencia' })
  tablero(
    @CurrentUser() usuario: UsuarioActual,
    @Query('dependenciaId') dependenciaId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.informes.tablero(usuario, dependenciaId, desde, hasta);
  }

  @Get('dependencia/:id')
  @Roles(ROLES.JEFE, ROLES.RADICADOR, ROLES.AUDITOR, ROLES.ARCHIVISTA)
  @ApiOperation({ summary: 'Desglose de una dependencia: subdependencias o funcionarios + casos' })
  dependencia(
    @CurrentUser() usuario: UsuarioActual,
    @Param('id') id: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.informes.dependencia(usuario, id, desde, hasta);
  }

  @Get('metas')
  @Roles(ROLES.JEFE, ROLES.RADICADOR, ROLES.AUDITOR, ROLES.ARCHIVISTA)
  @ApiOperation({ summary: 'Metas de los indicadores' })
  metas() {
    return this.informes.metas();
  }

  @Put('metas')
  @Roles(ROLES.ADMIN)
  @ApiOperation({ summary: 'Fija las metas de los indicadores' })
  guardarMetas(@Body() dto: MetasDto) {
    return this.informes.guardarMetas(dto);
  }
}

@Module({
  controllers: [InformesController],
  providers: [InformesService],
})
export class InformesModule {}
