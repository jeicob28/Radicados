import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { verifyPassword, hashPassword } from '../common/passwords';
import type { AuditCtx } from './decorators';

const ACCESS_TTL = '15m';
const REFRESH_TTL_DIAS = 7;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly bitacora: BitacoraService,
  ) {}

  get refreshCookieName() {
    return 'sgdea_refresh';
  }

  get refreshCookieMaxAgeMs() {
    return REFRESH_TTL_DIAS * 24 * 60 * 60 * 1000;
  }

  private async firmarAccessToken(u: {
    id: string;
    email: string;
    nombre: string;
    roles: string[];
    dependenciaId: string | null;
  }) {
    return this.jwt.signAsync(
      {
        sub: u.id,
        email: u.email,
        nombre: u.nombre,
        roles: u.roles,
        dependenciaId: u.dependenciaId,
      },
      { secret: this.config.get<string>('jwt.accessSecret'), expiresIn: ACCESS_TTL },
    );
  }

  private async emitirRefreshToken(usuarioId: string, ctx?: AuditCtx) {
    const raw = randomBytes(48).toString('hex');
    const expiraEn = new Date(Date.now() + this.refreshCookieMaxAgeMs);
    await this.prisma.refreshToken.create({
      data: {
        usuarioId,
        tokenHash: sha256(raw),
        expiraEn,
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
      },
    });
    return raw;
  }

  async login(email: string, password: string, ctx: AuditCtx, codigo?: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.activo || !usuario.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await verifyPassword(usuario.passwordHash, password);
    if (!ok) {
      await this.bitacora.registrar({
        ctx,
        entidad: 'auth',
        entidadId: usuario.id,
        accion: 'LOGIN',
        observacion: 'Intento fallido',
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.mfaHabilitado) {
      if (!codigo) {
        throw new UnauthorizedException('MFA requerido: envíe el campo "codigo"');
      }
      if (!usuario.mfaSecret || !authenticator.verify({ token: codigo, secret: usuario.mfaSecret })) {
        await this.bitacora.registrar({
          ctx, entidad: 'auth', entidadId: usuario.id, accion: 'LOGIN',
          observacion: 'Código MFA inválido',
        });
        throw new UnauthorizedException('Código MFA inválido');
      }
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    const accessToken = await this.firmarAccessToken(usuario as never);
    const refreshToken = await this.emitirRefreshToken(usuario.id, ctx);

    const ctxUsuario: AuditCtx = {
      ...ctx,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        roles: usuario.roles,
        dependenciaId: usuario.dependenciaId,
      },
    };
    await this.bitacora.registrar({
      ctx: ctxUsuario,
      entidad: 'auth',
      entidadId: usuario.id,
      accion: 'LOGIN',
    });

    return { accessToken, refreshToken, usuario: this.perfil(usuario) };
  }

  async refresh(rawToken: string | undefined, ctx: AuditCtx) {
    if (!rawToken) throw new UnauthorizedException('Sesión no encontrada');
    const registro = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { usuario: true },
    });

    if (
      !registro ||
      registro.revocadoEn ||
      registro.expiraEn < new Date() ||
      !registro.usuario.activo
    ) {
      throw new UnauthorizedException('Sesión expirada o revocada');
    }

    // rotación: se revoca el token usado y se emite uno nuevo
    await this.prisma.refreshToken.update({
      where: { id: registro.id },
      data: { revocadoEn: new Date() },
    });

    const accessToken = await this.firmarAccessToken(registro.usuario as never);
    const refreshToken = await this.emitirRefreshToken(registro.usuarioId, ctx);

    return { accessToken, refreshToken, usuario: this.perfil(registro.usuario) };
  }

  async logout(rawToken: string | undefined, ctx: AuditCtx) {
    if (!rawToken) return;
    const hash = sha256(rawToken);
    const registro = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (registro && !registro.revocadoEn) {
      await this.prisma.refreshToken.update({
        where: { id: registro.id },
        data: { revocadoEn: new Date() },
      });
      await this.bitacora.registrar({
        ctx,
        entidad: 'auth',
        entidadId: registro.usuarioId,
        accion: 'LOGOUT',
      });
    }
  }

  async me(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { dependencia: { select: { codigo: true, nombre: true } } },
    });
    if (!usuario) throw new UnauthorizedException();
    return { ...this.perfil(usuario), dependencia: usuario.dependencia ?? null };
  }

  async cambiarPassword(usuarioId: string, actual: string, nueva: string, ctx: AuditCtx) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario?.passwordHash) throw new UnauthorizedException();
    const ok = await verifyPassword(usuario.passwordHash, actual);
    if (!ok) throw new UnauthorizedException('La contraseña actual no es correcta');

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { passwordHash: await hashPassword(nueva), debeCambiarPassword: false },
    });
    // se cierran todas las sesiones activas del usuario
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });

    await this.bitacora.registrar({
      ctx,
      entidad: 'usuario',
      entidadId: usuarioId,
      accion: 'ACTUALIZAR',
      observacion: 'Cambio de contraseña',
    });
  }

  async iniciarMfa(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario) throw new UnauthorizedException();
    if (usuario.mfaHabilitado) throw new BadRequestException('El MFA ya está activo');
    const secret = authenticator.generateSecret();
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { mfaSecret: secret } });
    return {
      secret,
      otpauthUrl: authenticator.keyuri(usuario.email, 'SGDEA Radicación', secret),
    };
  }

  async activarMfa(usuarioId: string, codigo: string, ctx: AuditCtx) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario?.mfaSecret) throw new BadRequestException('Primero solicite el secreto (setup)');
    if (!authenticator.verify({ token: codigo, secret: usuario.mfaSecret })) {
      throw new BadRequestException('Código incorrecto');
    }
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { mfaHabilitado: true },
    });
    await this.bitacora.registrar({
      ctx, entidad: 'usuario', entidadId: usuarioId, accion: 'ACTUALIZAR',
      observacion: 'MFA activado',
    });
    return { ok: true };
  }

  async desactivarMfa(usuarioId: string, codigo: string, ctx: AuditCtx) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario?.mfaHabilitado || !usuario.mfaSecret) {
      throw new BadRequestException('El MFA no está activo');
    }
    if (!authenticator.verify({ token: codigo, secret: usuario.mfaSecret })) {
      throw new BadRequestException('Código incorrecto');
    }
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { mfaHabilitado: false, mfaSecret: null },
    });
    await this.bitacora.registrar({
      ctx, entidad: 'usuario', entidadId: usuarioId, accion: 'ACTUALIZAR',
      observacion: 'MFA desactivado',
    });
    return { ok: true };
  }

  private perfil(u: {
    id: string;
    documento: string;
    nombre: string;
    email: string;
    roles: string[];
    dependenciaId: string | null;
    debeCambiarPassword: boolean;
    ultimoAcceso: Date | null;
    mfaHabilitado?: boolean;
  }) {
    return {
      id: u.id,
      documento: u.documento,
      nombre: u.nombre,
      email: u.email,
      roles: u.roles,
      dependenciaId: u.dependenciaId,
      debeCambiarPassword: u.debeCambiarPassword,
      mfaHabilitado: u.mfaHabilitado ?? false,
      ultimoAcceso: u.ultimoAcceso,
    };
  }
}
