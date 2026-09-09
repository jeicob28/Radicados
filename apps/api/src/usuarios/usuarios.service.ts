import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { PasswordPolicyService } from '../common/password-policy.service';
import { generarPasswordTemporal, hashPassword } from '../common/passwords';
import type { AuditCtx } from '../auth/decorators';
import { ActualizarUsuarioDto, CrearUsuarioDto } from './dto';

const SELECT = {
  id: true,
  documento: true,
  nombre: true,
  email: true,
  roles: true,
  activo: true,
  dependenciaId: true,
  dependencia: { select: { codigo: true, nombre: true } },
  ultimoAcceso: true,
  debeCambiarPassword: true,
  mfaHabilitado: true,
  creado: true,
} satisfies Prisma.UsuarioSelect;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  async listar(q?: string, activo?: boolean, dependenciaId?: string) {
    const where: Prisma.UsuarioWhereInput = {};
    if (activo !== undefined) where.activo = activo;
    if (dependenciaId) where.dependenciaId = dependenciaId;
    if (q) {
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { documento: { contains: q } },
      ];
    }
    return this.prisma.usuario.findMany({ where, select: SELECT, orderBy: { nombre: 'asc' } });
  }

  async obtener(id: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id }, select: SELECT });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  /**
   * Separación de funciones: el rol DEV (soporte técnico / superusuario) solo lo
   * puede otorgar quien ya es DEV. `rolesAntes` evita bloquear a un ADMIN que
   * edita otros campos de un usuario que ya tenía DEV.
   */
  private verificarOtorgamientoDev(ctx: AuditCtx, rolesNuevos?: string[], rolesAntes: string[] = []) {
    if (!rolesNuevos) return;
    const otorgaDev = rolesNuevos.includes('DEV') && !rolesAntes.includes('DEV');
    if (otorgaDev && !(ctx.usuario?.roles ?? []).includes('DEV')) {
      throw new ForbiddenException('Solo un usuario con rol DEV puede otorgar el rol DEV');
    }
  }

  private async validarRoles(roles: string[]) {
    const existentes = await this.prisma.rol.findMany({
      where: { codigo: { in: roles } },
      select: { codigo: true },
    });
    const set = new Set(existentes.map((r) => r.codigo));
    const faltan = roles.filter((r) => !set.has(r));
    if (faltan.length) {
      throw new BadRequestException(`Roles inexistentes: ${faltan.join(', ')}`);
    }
  }

  private async revocarSesiones(usuarioId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  }

  async crear(dto: CrearUsuarioDto, ctx: AuditCtx) {
    await this.validarRoles(dto.roles);
    this.verificarOtorgamientoDev(ctx, dto.roles);
    if (dto.dependenciaId) {
      const dep = await this.prisma.dependencia.findUnique({ where: { id: dto.dependenciaId } });
      if (!dep) throw new BadRequestException('Dependencia inexistente');
    }
    if (dto.password) await this.passwordPolicy.validar(dto.password);

    const passwordTemporal = dto.password ?? generarPasswordTemporal();
    let creado;
    try {
      creado = await this.prisma.usuario.create({
        data: {
          documento: dto.documento,
          nombre: dto.nombre,
          email: dto.email,
          roles: dto.roles,
          dependenciaId: dto.dependenciaId ?? null,
          passwordHash: await hashPassword(passwordTemporal),
          debeCambiarPassword: true,
          passwordCambiadaEn: new Date(),
        },
        select: SELECT,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un usuario con ese documento o correo');
      }
      throw e;
    }

    await this.bitacora.registrar({
      ctx,
      entidad: 'usuario',
      entidadId: creado.id,
      accion: 'CREAR',
      despues: { documento: creado.documento, email: creado.email, roles: creado.roles },
    });

    return { usuario: creado, passwordTemporal: dto.password ? undefined : passwordTemporal };
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto, ctx: AuditCtx) {
    const antes = await this.obtener(id);
    if (dto.roles) await this.validarRoles(dto.roles);
    this.verificarOtorgamientoDev(ctx, dto.roles, antes.roles);
    if (dto.dependenciaId) {
      const dep = await this.prisma.dependencia.findUnique({ where: { id: dto.dependenciaId } });
      if (!dep) throw new BadRequestException('Dependencia inexistente');
    }

    const data: Prisma.UsuarioUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.roles !== undefined) data.roles = dto.roles;
    if (dto.activo !== undefined) data.activo = dto.activo;
    if (dto.dependenciaId !== undefined) {
      data.dependencia = dto.dependenciaId
        ? { connect: { id: dto.dependenciaId } }
        : { disconnect: true };
    }

    const actualizado = await this.prisma.usuario.update({ where: { id }, data, select: SELECT });

    if (dto.activo === false) await this.revocarSesiones(id);

    await this.bitacora.registrar({
      ctx,
      entidad: 'usuario',
      entidadId: id,
      accion: 'ACTUALIZAR',
      antes: {
        nombre: antes.nombre,
        email: antes.email,
        roles: antes.roles,
        activo: antes.activo,
        dependenciaId: antes.dependenciaId,
      },
      despues: {
        nombre: actualizado.nombre,
        email: actualizado.email,
        roles: actualizado.roles,
        activo: actualizado.activo,
        dependenciaId: actualizado.dependenciaId,
      },
    });

    return actualizado;
  }

  async resetPassword(id: string, ctx: AuditCtx) {
    await this.obtener(id);
    const passwordTemporal = generarPasswordTemporal();
    await this.prisma.usuario.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(passwordTemporal),
        debeCambiarPassword: true,
        passwordCambiadaEn: new Date(),
      },
    });
    await this.revocarSesiones(id);
    await this.bitacora.registrar({
      ctx,
      entidad: 'usuario',
      entidadId: id,
      accion: 'ACTUALIZAR',
      observacion: 'Restablecimiento de contraseña por administrador (temporal)',
    });
    return { passwordTemporal };
  }

  /** El administrador fija una contraseña concreta (en vez de una temporal aleatoria). */
  async establecerPassword(
    id: string,
    password: string,
    forzarCambio: boolean,
    ctx: AuditCtx,
  ) {
    await this.obtener(id);
    await this.passwordPolicy.validar(password);
    await this.prisma.usuario.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(password),
        debeCambiarPassword: forzarCambio,
        passwordCambiadaEn: new Date(),
      },
    });
    await this.revocarSesiones(id);
    await this.bitacora.registrar({
      ctx,
      entidad: 'usuario',
      entidadId: id,
      accion: 'ACTUALIZAR',
      observacion: `Contraseña fijada por administrador${forzarCambio ? ' (con cambio obligatorio)' : ''}`,
    });
    return { ok: true };
  }

  async cerrarSesiones(id: string, ctx: AuditCtx) {
    await this.obtener(id);
    await this.revocarSesiones(id);
    await this.bitacora.registrar({
      ctx,
      entidad: 'usuario',
      entidadId: id,
      accion: 'ACTUALIZAR',
      observacion: 'Sesiones cerradas por administrador',
    });
    return { ok: true };
  }
}
