import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { Auditoria, CurrentUser, Roles } from '../auth/decorators';
import type { AuditCtx, UsuarioActual } from '../auth/decorators';
import { ROLES } from '../auth/roles';

const CLASES = ['INFORMACION', 'SOFTWARE', 'HARDWARE', 'SERVICIO', 'INFRAESTRUCTURA', 'PERSONAL', 'INSTALACION'];
const ESTADOS_RIESGO = ['IDENTIFICADO', 'EN_TRATAMIENTO', 'MITIGADO', 'ACEPTADO', 'CERRADO'];
const OPCIONES_TRATAMIENTO = ['MITIGAR', 'TRANSFERIR', 'EVITAR', 'ACEPTAR'];
const ESTADOS_CONTROL = ['NO_APLICA', 'NO_IMPLEMENTADO', 'PLANIFICADO', 'EN_IMPLEMENTACION', 'IMPLEMENTADO'];
const ESTADOS_PLAN = ['ABIERTO', 'EN_CURSO', 'IMPLEMENTADO', 'VERIFICADO', 'CERRADO'];

const PARAM_MARCO = 'sgsi.marco';
const MARCO_DEFECTO = {
  version: '1.0',
  fechaAprobacion: null as string | null,
  politica:
    'La entidad protege la confidencialidad, la integridad y la disponibilidad de la información que gestiona a través del SGDEA, cumpliendo la Ley 594 de 2000, el Acuerdo 001 de 2024 del AGN, la Ley 1581 de 2012 (protección de datos personales) y adoptando los controles de ISO/IEC 27001:2022 y el Modelo de Seguridad y Privacidad de la Información (MSPI) de MinTIC.',
  alcance:
    'El SGSI cubre el Sistema de Gestión de Documentos Electrónicos de Archivo (SGDEA): la radicación, el trámite, los expedientes electrónicos, la bitácora de auditoría y los activos de información y de infraestructura que lo soportan (base de datos, almacenamiento de objetos, servidor, red y respaldos).',
  objetivos: [
    'Garantizar la trazabilidad e inalterabilidad de los radicados y de la bitácora.',
    'Asegurar la disponibilidad del servicio y la recuperación ante desastres mediante copias de seguridad verificadas.',
    'Controlar el acceso a la información con base en roles y el principio de mínimo privilegio.',
    'Tratar los riesgos de seguridad hasta un nivel aceptable y revisarlos periódicamente.',
  ],
  metodologia:
    'Los riesgos se valoran como Probabilidad (1–5) × Impacto (1–5). Bandas: 1–4 Bajo, 5–9 Medio, 10–15 Alto, 16–25 Extremo. Cada riesgo tiene una opción de tratamiento (mitigar, transferir, evitar, aceptar), controles del Anexo A asociados y, si aplica, un plan de tratamiento con responsable y fecha objetivo. El riesgo residual se recalcula tras aplicar los controles.',
  roles: [
    { rol: 'Responsable del SGSI (rol DEV)', responsabilidad: 'Mantiene el marco, el inventario de activos, el mapa de riesgos y la Declaración de Aplicabilidad; opera las copias de seguridad y la infraestructura.' },
    { rol: 'Administrador (rol ADMIN)', responsabilidad: 'Gestiona usuarios, roles y dependencias; participa en la valoración de riesgos de los activos de información documental.' },
    { rol: 'Auditor (rol AUDITOR)', responsabilidad: 'Revisa de forma independiente la bitácora, los riesgos y el cumplimiento de los controles.' },
    { rol: 'Alta dirección', responsabilidad: 'Aprueba la política, asigna recursos y revisa el desempeño del SGSI.' },
  ],
  periodicidadRevision: 'Revisión de riesgos y de la Declaración de Aplicabilidad al menos una vez al año o ante cambios significativos.',
  referencias: [
    'ISO/IEC 27001:2022 — Sistemas de gestión de seguridad de la información',
    'ISO/IEC 27002:2022 — Controles de seguridad de la información',
    'Modelo de Seguridad y Privacidad de la Información (MSPI) — MinTIC',
    'Ley 1581 de 2012 y Decreto 1377 de 2013 — Protección de datos personales',
    'Acuerdo 001 de 2024 del AGN — Función archivística y gestión documental',
  ],
};

const NIVEL_BANDA = (n: number) =>
  n <= 4 ? 'BAJO' : n <= 9 ? 'MEDIO' : n <= 15 ? 'ALTO' : 'EXTREMO';

// ─────────────────────────── DTOs ───────────────────────────
class ActivoDto {
  @IsString() @MinLength(2) nombre!: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsIn(CLASES) clase!: string;
  @IsOptional() @IsString() propietario?: string;
  @IsOptional() @IsString() custodio?: string;
  @IsOptional() @IsString() dependenciaId?: string;
  @IsOptional() @IsString() ubicacion?: string;
  @IsOptional() @IsBoolean() esInfraestructura?: boolean;
  @IsInt() @Min(1) @Max(5) confidencialidad!: number;
  @IsInt() @Min(1) @Max(5) integridad!: number;
  @IsInt() @Min(1) @Max(5) disponibilidad!: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}
class ActivoUpdateDto {
  @IsOptional() @IsString() @MinLength(2) nombre?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsIn(CLASES) clase?: string;
  @IsOptional() @IsString() propietario?: string;
  @IsOptional() @IsString() custodio?: string;
  @IsOptional() @IsString() dependenciaId?: string;
  @IsOptional() @IsString() ubicacion?: string;
  @IsOptional() @IsBoolean() esInfraestructura?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(5) confidencialidad?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) integridad?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) disponibilidad?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}
class RiesgoDto {
  @IsString() activoId!: string;
  @IsString() @MinLength(3) nombre!: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsString() @MinLength(3) amenaza!: string;
  @IsString() @MinLength(3) vulnerabilidad!: string;
  @IsInt() @Min(1) @Max(5) probabilidad!: number;
  @IsInt() @Min(1) @Max(5) impacto!: number;
  @IsOptional() @IsIn(OPCIONES_TRATAMIENTO) opcionTratamiento?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) probabilidadResidual?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) impactoResidual?: number;
  @IsOptional() @IsIn(ESTADOS_RIESGO) estado?: string;
  @IsOptional() @IsString() responsableId?: string;
  @IsOptional() @IsString() fechaRevision?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) controlIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) controlCodigos?: string[];
}
class RiesgoUpdateDto extends RiesgoDto {
  @IsOptional() @IsString() declare activoId: string;
  @IsOptional() @IsString() @MinLength(3) declare nombre: string;
  @IsOptional() @IsString() @MinLength(3) declare amenaza: string;
  @IsOptional() @IsString() @MinLength(3) declare vulnerabilidad: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) declare probabilidad: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) declare impacto: number;
}
class SoaDto {
  @IsOptional() @IsBoolean() aplica?: boolean;
  @IsOptional() @IsString() justificacion?: string;
  @IsOptional() @IsIn(ESTADOS_CONTROL) estado?: string;
  @IsOptional() @IsString() responsableId?: string;
  @IsOptional() @IsString() observaciones?: string;
  @IsOptional() @IsString() fechaImplementacion?: string;
}
class PlanDto {
  @IsString() riesgoId!: string;
  @IsString() @MinLength(4) descripcion!: string;
  @IsOptional() @IsString() accion?: string;
  @IsOptional() @IsString() responsableId?: string;
  @IsOptional() @IsString() fechaObjetivo?: string;
  @IsOptional() @IsIn(ESTADOS_PLAN) estado?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) avance?: number;
}
class PlanUpdateDto {
  @IsOptional() @IsString() @MinLength(4) descripcion?: string;
  @IsOptional() @IsString() accion?: string;
  @IsOptional() @IsString() responsableId?: string;
  @IsOptional() @IsString() fechaObjetivo?: string;
  @IsOptional() @IsIn(ESTADOS_PLAN) estado?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) avance?: number;
}
class MarcoDto {
  @IsOptional() @IsString() version?: string;
  @IsOptional() @IsString() fechaAprobacion?: string;
  @IsOptional() @IsString() politica?: string;
  @IsOptional() @IsString() alcance?: string;
  @IsOptional() @IsArray() objetivos?: unknown[];
  @IsOptional() @IsString() metodologia?: string;
  @IsOptional() @IsArray() roles?: unknown[];
  @IsOptional() @IsString() periodicidadRevision?: string;
  @IsOptional() @IsArray() referencias?: unknown[];
}

// ─────────────────────────── servicio ───────────────────────────
@Injectable()
export class SgsiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  private puedeVerInfra(u: UsuarioActual): boolean {
    const r = u.roles ?? [];
    return r.includes(ROLES.DEV) || r.includes(ROLES.AUDITOR);
  }
  private esDev(u: UsuarioActual): boolean {
    return (u.roles ?? []).includes(ROLES.DEV);
  }
  private exigirPermisoInfra(u: UsuarioActual, esInfra: boolean) {
    if (esInfra && !this.esDev(u)) {
      throw new ForbiddenException('Solo el rol DEV puede gestionar activos y riesgos de infraestructura.');
    }
  }

  private async siguiente(clave: string, prefijo: string): Promise<string> {
    const [{ fn_siguiente_secuencia: n }] = await this.prisma.$queryRaw<
      Array<{ fn_siguiente_secuencia: number }>
    >(Prisma.sql`SELECT fn_siguiente_secuencia(${clave})`);
    return `${prefijo}-${String(n).padStart(3, '0')}`;
  }

  private fecha(v?: string | null): Date | null {
    return v ? new Date(v) : null;
  }

  // ── activos ──────────────────────────────────────────────────────────────
  async listarActivos(u: UsuarioActual) {
    const where: Prisma.ActivoInformacionWhereInput = this.puedeVerInfra(u)
      ? {}
      : { esInfraestructura: false };
    const activos = await this.prisma.activoInformacion.findMany({
      where,
      orderBy: { codigo: 'asc' },
      include: { _count: { select: { riesgos: true } } },
    });
    return activos.map((a) => ({ ...a, riesgos: a._count.riesgos, _count: undefined }));
  }

  async crearActivo(dto: ActivoDto, ctx: AuditCtx) {
    const u = ctx.usuario!;
    const esInfra = dto.esInfraestructura ?? dto.clase === 'INFRAESTRUCTURA';
    this.exigirPermisoInfra(u, esInfra);
    const valoracion = Math.max(dto.confidencialidad, dto.integridad, dto.disponibilidad);
    const a = await this.prisma.activoInformacion.create({
      data: {
        codigo: await this.siguiente('sgsi:activo', 'ACT'),
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        clase: dto.clase as never,
        propietario: dto.propietario ?? null,
        custodio: dto.custodio ?? null,
        dependenciaId: dto.dependenciaId ?? null,
        ubicacion: dto.ubicacion ?? null,
        esInfraestructura: esInfra,
        confidencialidad: dto.confidencialidad,
        integridad: dto.integridad,
        disponibilidad: dto.disponibilidad,
        valoracion,
        activo: dto.activo ?? true,
      },
    });
    await this.bitacora.registrar({ ctx, entidad: 'sgsi_activo', entidadId: a.id, accion: 'CREAR', despues: { codigo: a.codigo, nombre: a.nombre } });
    return a;
  }

  async actualizarActivo(id: string, dto: ActivoUpdateDto, ctx: AuditCtx) {
    const u = ctx.usuario!;
    const antes = await this.prisma.activoInformacion.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Activo no encontrado');
    this.exigirPermisoInfra(u, antes.esInfraestructura || !!dto.esInfraestructura);
    const c = dto.confidencialidad ?? antes.confidencialidad;
    const i = dto.integridad ?? antes.integridad;
    const d = dto.disponibilidad ?? antes.disponibilidad;
    const a = await this.prisma.activoInformacion.update({
      where: { id },
      data: {
        nombre: dto.nombre ?? undefined,
        descripcion: dto.descripcion ?? undefined,
        clase: (dto.clase as never) ?? undefined,
        propietario: dto.propietario ?? undefined,
        custodio: dto.custodio ?? undefined,
        dependenciaId: dto.dependenciaId ?? undefined,
        ubicacion: dto.ubicacion ?? undefined,
        esInfraestructura: dto.esInfraestructura ?? undefined,
        confidencialidad: dto.confidencialidad ?? undefined,
        integridad: dto.integridad ?? undefined,
        disponibilidad: dto.disponibilidad ?? undefined,
        valoracion: Math.max(c, i, d),
        activo: dto.activo ?? undefined,
      },
    });
    await this.bitacora.registrar({ ctx, entidad: 'sgsi_activo', entidadId: id, accion: 'ACTUALIZAR', antes: { nombre: antes.nombre }, despues: { nombre: a.nombre } });
    return a;
  }

  async eliminarActivo(id: string, ctx: AuditCtx) {
    const a = await this.prisma.activoInformacion.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Activo no encontrado');
    this.exigirPermisoInfra(ctx.usuario!, a.esInfraestructura);
    await this.prisma.activoInformacion.delete({ where: { id } });
    await this.bitacora.registrar({ ctx, entidad: 'sgsi_activo', entidadId: id, accion: 'ANULAR', antes: { codigo: a.codigo, nombre: a.nombre } });
    return { ok: true };
  }

  // ── riesgos ──────────────────────────────────────────────────────────────
  async listarRiesgos(u: UsuarioActual) {
    const where: Prisma.RiesgoWhereInput = this.puedeVerInfra(u)
      ? {}
      : { activo: { esInfraestructura: false } };
    const riesgos = await this.prisma.riesgo.findMany({
      where,
      orderBy: { codigo: 'asc' },
      include: {
        activo: { select: { codigo: true, nombre: true, esInfraestructura: true } },
        controles: { select: { codigo: true, titulo: true } },
        _count: { select: { planes: true } },
      },
    });
    const nombres = await this.nombresUsuarios(riesgos.map((r) => r.responsableId));
    return riesgos.map((r) => ({
      ...r,
      bandaInherente: NIVEL_BANDA(r.nivelInherente),
      bandaResidual: r.nivelResidual != null ? NIVEL_BANDA(r.nivelResidual) : null,
      responsable: r.responsableId ? nombres.get(r.responsableId) ?? null : null,
      planes: r._count.planes,
      _count: undefined,
    }));
  }

  /** Resuelve la lista de controles del Anexo A a conectar, por id o por código. */
  private async resolverControles(dto: { controlIds?: string[]; controlCodigos?: string[] }): Promise<{ id: string }[] | undefined> {
    if (dto.controlIds) return dto.controlIds.map((id) => ({ id }));
    if (dto.controlCodigos) {
      const cs = await this.prisma.controlAnexoA.findMany({
        where: { codigo: { in: dto.controlCodigos } },
        select: { id: true },
      });
      return cs;
    }
    return undefined;
  }

  private residual(dto: { probabilidadResidual?: number; impactoResidual?: number }) {
    return dto.probabilidadResidual != null && dto.impactoResidual != null
      ? { pr: dto.probabilidadResidual, ir: dto.impactoResidual, nr: dto.probabilidadResidual * dto.impactoResidual }
      : { pr: null, ir: null, nr: null };
  }

  async crearRiesgo(dto: RiesgoDto, ctx: AuditCtx) {
    const activo = await this.prisma.activoInformacion.findUnique({ where: { id: dto.activoId } });
    if (!activo) throw new NotFoundException('Activo inexistente');
    this.exigirPermisoInfra(ctx.usuario!, activo.esInfraestructura);
    const { pr, ir, nr } = this.residual(dto);
    const controles = await this.resolverControles(dto);
    const r = await this.prisma.riesgo.create({
      data: {
        codigo: await this.siguiente('sgsi:riesgo', 'RSG'),
        activoId: dto.activoId,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        amenaza: dto.amenaza,
        vulnerabilidad: dto.vulnerabilidad,
        probabilidad: dto.probabilidad,
        impacto: dto.impacto,
        nivelInherente: dto.probabilidad * dto.impacto,
        opcionTratamiento: (dto.opcionTratamiento as never) ?? 'MITIGAR',
        probabilidadResidual: pr,
        impactoResidual: ir,
        nivelResidual: nr,
        estado: (dto.estado as never) ?? 'IDENTIFICADO',
        responsableId: dto.responsableId ?? null,
        fechaRevision: this.fecha(dto.fechaRevision),
        controles: controles?.length ? { connect: controles } : undefined,
      },
    });
    await this.bitacora.registrar({ ctx, entidad: 'sgsi_riesgo', entidadId: r.id, accion: 'CREAR', despues: { codigo: r.codigo, nivel: r.nivelInherente } });
    return r;
  }

  async actualizarRiesgo(id: string, dto: RiesgoUpdateDto, ctx: AuditCtx) {
    const antes = await this.prisma.riesgo.findUnique({ where: { id }, include: { activo: true } });
    if (!antes) throw new NotFoundException('Riesgo no encontrado');
    this.exigirPermisoInfra(ctx.usuario!, antes.activo.esInfraestructura);
    const p = dto.probabilidad ?? antes.probabilidad;
    const i = dto.impacto ?? antes.impacto;
    const prBase = dto.probabilidadResidual ?? antes.probabilidadResidual ?? undefined;
    const irBase = dto.impactoResidual ?? antes.impactoResidual ?? undefined;
    const { pr, ir, nr } = this.residual({ probabilidadResidual: prBase, impactoResidual: irBase });
    const controles = await this.resolverControles(dto);
    const r = await this.prisma.riesgo.update({
      where: { id },
      data: {
        activoId: dto.activoId ?? undefined,
        nombre: dto.nombre ?? undefined,
        descripcion: dto.descripcion ?? undefined,
        amenaza: dto.amenaza ?? undefined,
        vulnerabilidad: dto.vulnerabilidad ?? undefined,
        probabilidad: dto.probabilidad ?? undefined,
        impacto: dto.impacto ?? undefined,
        nivelInherente: p * i,
        opcionTratamiento: (dto.opcionTratamiento as never) ?? undefined,
        probabilidadResidual: pr,
        impactoResidual: ir,
        nivelResidual: nr,
        estado: (dto.estado as never) ?? undefined,
        responsableId: dto.responsableId ?? undefined,
        fechaRevision: dto.fechaRevision ? new Date(dto.fechaRevision) : undefined,
        controles: controles ? { set: controles } : undefined,
      },
    });
    await this.bitacora.registrar({ ctx, entidad: 'sgsi_riesgo', entidadId: id, accion: 'ACTUALIZAR', antes: { nivel: antes.nivelInherente }, despues: { nivel: r.nivelInherente, estado: r.estado } });
    return r;
  }

  async eliminarRiesgo(id: string, ctx: AuditCtx) {
    const r = await this.prisma.riesgo.findUnique({ where: { id }, include: { activo: true } });
    if (!r) throw new NotFoundException('Riesgo no encontrado');
    this.exigirPermisoInfra(ctx.usuario!, r.activo.esInfraestructura);
    await this.prisma.riesgo.delete({ where: { id } });
    await this.bitacora.registrar({ ctx, entidad: 'sgsi_riesgo', entidadId: id, accion: 'ANULAR', antes: { codigo: r.codigo } });
    return { ok: true };
  }

  // ── controles / SoA ─────────────────────────────────────────────────────
  async listarControles() {
    const controles = await this.prisma.controlAnexoA.findMany({
      orderBy: { codigo: 'asc' },
      include: { aplicabilidad: true, _count: { select: { riesgos: true } } },
    });
    const nombres = await this.nombresUsuarios(controles.map((c) => c.aplicabilidad?.responsableId ?? null));
    return controles.map((c) => ({
      codigo: c.codigo,
      tema: c.tema,
      titulo: c.titulo,
      riesgosAsociados: c._count.riesgos,
      soa: c.aplicabilidad
        ? {
            aplica: c.aplicabilidad.aplica,
            justificacion: c.aplicabilidad.justificacion,
            estado: c.aplicabilidad.estado,
            observaciones: c.aplicabilidad.observaciones,
            fechaImplementacion: c.aplicabilidad.fechaImplementacion,
            responsable: c.aplicabilidad.responsableId ? nombres.get(c.aplicabilidad.responsableId) ?? null : null,
          }
        : { aplica: true, justificacion: null, estado: 'NO_IMPLEMENTADO', observaciones: null, fechaImplementacion: null, responsable: null },
    }));
  }

  async actualizarSoa(codigo: string, dto: SoaDto, ctx: AuditCtx) {
    const control = await this.prisma.controlAnexoA.findUnique({ where: { codigo } });
    if (!control) throw new NotFoundException('Control del Anexo A no encontrado');
    const data = {
      aplica: dto.aplica ?? undefined,
      justificacion: dto.justificacion ?? undefined,
      estado: (dto.estado as never) ?? undefined,
      responsableId: dto.responsableId ?? undefined,
      observaciones: dto.observaciones ?? undefined,
      fechaImplementacion: dto.fechaImplementacion ? new Date(dto.fechaImplementacion) : undefined,
    };
    const soa = await this.prisma.declaracionAplicabilidad.upsert({
      where: { controlId: control.id },
      update: data,
      create: { controlId: control.id, ...data, estado: (dto.estado as never) ?? 'NO_IMPLEMENTADO' },
    });
    await this.bitacora.registrar({ ctx, entidad: 'sgsi_soa', entidadId: codigo, accion: 'ACTUALIZAR', despues: { aplica: soa.aplica, estado: soa.estado } });
    return soa;
  }

  // ── planes de tratamiento ───────────────────────────────────────────────
  async listarPlanes(u: UsuarioActual, riesgoId?: string) {
    const where: Prisma.PlanTratamientoWhereInput = {
      ...(riesgoId ? { riesgoId } : {}),
      ...(this.puedeVerInfra(u) ? {} : { riesgo: { activo: { esInfraestructura: false } } }),
    };
    const planes = await this.prisma.planTratamiento.findMany({
      where,
      orderBy: [{ estado: 'asc' }, { fechaObjetivo: 'asc' }],
      include: { riesgo: { select: { codigo: true, nombre: true } } },
    });
    const nombres = await this.nombresUsuarios(planes.map((p) => p.responsableId));
    const hoy = new Date();
    return planes.map((p) => ({
      ...p,
      responsable: p.responsableId ? nombres.get(p.responsableId) ?? null : null,
      vencido: !!p.fechaObjetivo && p.fechaObjetivo < hoy && !['VERIFICADO', 'CERRADO'].includes(p.estado),
    }));
  }

  async crearPlan(dto: PlanDto, ctx: AuditCtx) {
    const riesgo = await this.prisma.riesgo.findUnique({ where: { id: dto.riesgoId }, include: { activo: true } });
    if (!riesgo) throw new NotFoundException('Riesgo inexistente');
    this.exigirPermisoInfra(ctx.usuario!, riesgo.activo.esInfraestructura);
    const p = await this.prisma.planTratamiento.create({
      data: {
        riesgoId: dto.riesgoId,
        descripcion: dto.descripcion,
        accion: dto.accion ?? null,
        responsableId: dto.responsableId ?? null,
        fechaObjetivo: this.fecha(dto.fechaObjetivo),
        estado: (dto.estado as never) ?? 'ABIERTO',
        avance: dto.avance ?? 0,
      },
    });
    await this.bitacora.registrar({ ctx, entidad: 'sgsi_plan', entidadId: p.id, accion: 'CREAR', despues: { riesgo: riesgo.codigo } });
    return p;
  }

  async actualizarPlan(id: string, dto: PlanUpdateDto, ctx: AuditCtx) {
    const antes = await this.prisma.planTratamiento.findUnique({ where: { id }, include: { riesgo: { include: { activo: true } } } });
    if (!antes) throw new NotFoundException('Plan no encontrado');
    this.exigirPermisoInfra(ctx.usuario!, antes.riesgo.activo.esInfraestructura);
    const cerrando = ['VERIFICADO', 'CERRADO'].includes(dto.estado ?? '');
    const p = await this.prisma.planTratamiento.update({
      where: { id },
      data: {
        descripcion: dto.descripcion ?? undefined,
        accion: dto.accion ?? undefined,
        responsableId: dto.responsableId ?? undefined,
        fechaObjetivo: dto.fechaObjetivo ? new Date(dto.fechaObjetivo) : undefined,
        estado: (dto.estado as never) ?? undefined,
        avance: dto.avance ?? (cerrando ? 100 : undefined),
        fechaCierre: cerrando ? new Date() : undefined,
      },
    });
    await this.bitacora.registrar({ ctx, entidad: 'sgsi_plan', entidadId: id, accion: 'ACTUALIZAR', despues: { estado: p.estado, avance: p.avance } });
    return p;
  }

  async eliminarPlan(id: string, ctx: AuditCtx) {
    const p = await this.prisma.planTratamiento.findUnique({ where: { id }, include: { riesgo: { include: { activo: true } } } });
    if (!p) throw new NotFoundException('Plan no encontrado');
    this.exigirPermisoInfra(ctx.usuario!, p.riesgo.activo.esInfraestructura);
    await this.prisma.planTratamiento.delete({ where: { id } });
    await this.bitacora.registrar({ ctx, entidad: 'sgsi_plan', entidadId: id, accion: 'ANULAR' });
    return { ok: true };
  }

  // ── marco de gestión ────────────────────────────────────────────────────
  async marco() {
    const p = await this.prisma.parametro.findUnique({ where: { clave: PARAM_MARCO } });
    return { ...MARCO_DEFECTO, ...((p?.valor ?? {}) as object) };
  }
  async guardarMarco(dto: MarcoDto, ctx: AuditCtx) {
    const actual = await this.marco();
    const valor = { ...actual, ...Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)) };
    await this.prisma.parametro.upsert({
      where: { clave: PARAM_MARCO },
      update: { valor: valor as never },
      create: { clave: PARAM_MARCO, valor: valor as never, descripcion: 'Marco de gestión del SGSI' },
    });
    await this.bitacora.registrar({ ctx, entidad: 'sgsi_marco', entidadId: PARAM_MARCO, accion: 'ACTUALIZAR' });
    return valor;
  }

  // ── tablero ─────────────────────────────────────────────────────────────
  async tablero(u: UsuarioActual) {
    const verInfra = this.puedeVerInfra(u);
    const whereActivo: Prisma.ActivoInformacionWhereInput = verInfra ? {} : { esInfraestructura: false };
    const whereRiesgo: Prisma.RiesgoWhereInput = verInfra ? {} : { activo: { esInfraestructura: false } };

    const [activos, riesgos, controles, planes] = await Promise.all([
      this.prisma.activoInformacion.groupBy({ by: ['clase'], where: whereActivo, _count: { _all: true } }),
      this.prisma.riesgo.findMany({
        where: whereRiesgo,
        select: { probabilidad: true, impacto: true, nivelInherente: true, nivelResidual: true, probabilidadResidual: true, impactoResidual: true, estado: true },
      }),
      this.prisma.declaracionAplicabilidad.groupBy({ by: ['aplica', 'estado'], _count: { _all: true } }),
      this.prisma.planTratamiento.findMany({ where: verInfra ? {} : { riesgo: { activo: { esInfraestructura: false } } }, select: { estado: true, fechaObjetivo: true } }),
    ]);

    // matriz 5×5: fila = impacto (5 arriba → 1 abajo), col = probabilidad (1 → 5)
    const matriz = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
    const porBanda: Record<string, number> = { BAJO: 0, MEDIO: 0, ALTO: 0, EXTREMO: 0 };
    const porEstado: Record<string, number> = {};
    for (const r of riesgos) {
      const p = r.probabilidadResidual ?? r.probabilidad;
      const i = r.impactoResidual ?? r.impacto;
      const nivel = r.nivelResidual ?? r.nivelInherente;
      matriz[5 - i][p - 1] += 1;
      porBanda[NIVEL_BANDA(nivel)] += 1;
      porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1;
    }

    const soaTotal = controles.reduce((a, g) => a + g._count._all, 0);
    const soaNoAplica = controles.filter((g) => !g.aplica).reduce((a, g) => a + g._count._all, 0);
    const soaImplementados = controles.filter((g) => g.aplica && g.estado === 'IMPLEMENTADO').reduce((a, g) => a + g._count._all, 0);
    const soaAplicables = soaTotal - soaNoAplica;

    const hoy = new Date();
    const planVencidos = planes.filter((p) => p.fechaObjetivo && p.fechaObjetivo < hoy && !['VERIFICADO', 'CERRADO'].includes(p.estado)).length;
    const planAbiertos = planes.filter((p) => !['VERIFICADO', 'CERRADO'].includes(p.estado)).length;

    return {
      alcanceInfra: verInfra,
      matriz,
      porBanda: Object.entries(porBanda).map(([clave, n]) => ({ clave, n })),
      porEstado: Object.entries(porEstado).map(([clave, n]) => ({ clave, n })),
      activosPorClase: activos.map((g) => ({ clave: g.clase, n: g._count._all })).sort((a, b) => b.n - a.n),
      totales: {
        activos: activos.reduce((a, g) => a + g._count._all, 0),
        riesgos: riesgos.length,
        riesgosAltos: porBanda.ALTO + porBanda.EXTREMO,
      },
      soa: {
        total: soaTotal,
        aplicables: soaAplicables,
        noAplica: soaNoAplica,
        implementados: soaImplementados,
        cobertura: soaAplicables ? Math.round((soaImplementados / soaAplicables) * 100) : 0,
      },
      planes: { total: planes.length, abiertos: planAbiertos, vencidos: planVencidos },
    };
  }

  private async nombresUsuarios(ids: (string | null)[]) {
    const uniq = [...new Set(ids.filter(Boolean) as string[])];
    if (!uniq.length) return new Map<string, string>();
    const us = await this.prisma.usuario.findMany({ where: { id: { in: uniq } }, select: { id: true, nombre: true } });
    return new Map(us.map((u) => [u.id, u.nombre]));
  }
}

// ─────────────────────────── controlador ───────────────────────────
@ApiTags('SGSI — seguridad de la información')
@ApiBearerAuth()
@Controller('sgsi')
export class SgsiController {
  constructor(private readonly sgsi: SgsiService) {}

  @Get('tablero')
  @Roles(ROLES.ADMIN, ROLES.DEV, ROLES.AUDITOR)
  @ApiOperation({ summary: 'Tablero del SGSI: mapa de calor, riesgos por nivel, cobertura de la SoA' })
  tablero(@CurrentUser() u: UsuarioActual) {
    return this.sgsi.tablero(u);
  }

  @Get('activos')
  @Roles(ROLES.ADMIN, ROLES.DEV, ROLES.AUDITOR)
  activos(@CurrentUser() u: UsuarioActual) {
    return this.sgsi.listarActivos(u);
  }
  @Post('activos')
  @Roles(ROLES.ADMIN, ROLES.DEV)
  crearActivo(@Body() dto: ActivoDto, @Auditoria() ctx: AuditCtx) {
    return this.sgsi.crearActivo(dto, ctx);
  }
  @Patch('activos/:id')
  @Roles(ROLES.ADMIN, ROLES.DEV)
  actualizarActivo(@Param('id') id: string, @Body() dto: ActivoUpdateDto, @Auditoria() ctx: AuditCtx) {
    return this.sgsi.actualizarActivo(id, dto, ctx);
  }
  @Delete('activos/:id')
  @Roles(ROLES.ADMIN, ROLES.DEV)
  eliminarActivo(@Param('id') id: string, @Auditoria() ctx: AuditCtx) {
    return this.sgsi.eliminarActivo(id, ctx);
  }

  @Get('riesgos')
  @Roles(ROLES.ADMIN, ROLES.DEV, ROLES.AUDITOR)
  riesgos(@CurrentUser() u: UsuarioActual) {
    return this.sgsi.listarRiesgos(u);
  }
  @Post('riesgos')
  @Roles(ROLES.ADMIN, ROLES.DEV)
  crearRiesgo(@Body() dto: RiesgoDto, @Auditoria() ctx: AuditCtx) {
    return this.sgsi.crearRiesgo(dto, ctx);
  }
  @Patch('riesgos/:id')
  @Roles(ROLES.ADMIN, ROLES.DEV)
  actualizarRiesgo(@Param('id') id: string, @Body() dto: RiesgoUpdateDto, @Auditoria() ctx: AuditCtx) {
    return this.sgsi.actualizarRiesgo(id, dto, ctx);
  }
  @Delete('riesgos/:id')
  @Roles(ROLES.ADMIN, ROLES.DEV)
  eliminarRiesgo(@Param('id') id: string, @Auditoria() ctx: AuditCtx) {
    return this.sgsi.eliminarRiesgo(id, ctx);
  }

  @Get('controles')
  @Roles(ROLES.ADMIN, ROLES.DEV, ROLES.AUDITOR)
  @ApiOperation({ summary: 'Anexo A de ISO/IEC 27001:2022 con su Declaración de Aplicabilidad' })
  controles() {
    return this.sgsi.listarControles();
  }
  @Patch('controles/:codigo')
  @Roles(ROLES.DEV)
  actualizarSoa(@Param('codigo') codigo: string, @Body() dto: SoaDto, @Auditoria() ctx: AuditCtx) {
    return this.sgsi.actualizarSoa(codigo, dto, ctx);
  }

  @Get('planes')
  @Roles(ROLES.ADMIN, ROLES.DEV, ROLES.AUDITOR)
  planes(@CurrentUser() u: UsuarioActual, @Query('riesgoId') riesgoId?: string) {
    return this.sgsi.listarPlanes(u, riesgoId);
  }
  @Post('planes')
  @Roles(ROLES.ADMIN, ROLES.DEV)
  crearPlan(@Body() dto: PlanDto, @Auditoria() ctx: AuditCtx) {
    return this.sgsi.crearPlan(dto, ctx);
  }
  @Patch('planes/:id')
  @Roles(ROLES.ADMIN, ROLES.DEV)
  actualizarPlan(@Param('id') id: string, @Body() dto: PlanUpdateDto, @Auditoria() ctx: AuditCtx) {
    return this.sgsi.actualizarPlan(id, dto, ctx);
  }
  @Delete('planes/:id')
  @Roles(ROLES.ADMIN, ROLES.DEV)
  eliminarPlan(@Param('id') id: string, @Auditoria() ctx: AuditCtx) {
    return this.sgsi.eliminarPlan(id, ctx);
  }

  @Get('marco')
  @Roles(ROLES.ADMIN, ROLES.DEV, ROLES.AUDITOR)
  marco() {
    return this.sgsi.marco();
  }
  @Put('marco')
  @Roles(ROLES.DEV)
  guardarMarco(@Body() dto: MarcoDto, @Auditoria() ctx: AuditCtx) {
    return this.sgsi.guardarMarco(dto, ctx);
  }
}

@Module({
  controllers: [SgsiController],
  providers: [SgsiService],
})
export class SgsiModule {}
