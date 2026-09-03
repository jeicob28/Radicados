import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CambiarPasswordDto, CodigoMfaDto, LoginDto } from './dto';
import { Auditoria, CurrentUser, Public } from './decorators';
import type { AuditCtx, UsuarioActual } from './decorators';

@ApiTags('autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private ponerCookieRefresh(res: Response, token: string) {
    res.cookie(this.auth.refreshCookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/v1/auth',
      maxAge: this.auth.refreshCookieMaxAgeMs,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicia sesión; devuelve access token y fija la cookie de refresh' })
  async login(
    @Body() dto: LoginDto,
    @Auditoria() ctx: AuditCtx,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, usuario } = await this.auth.login(
      dto.email,
      dto.password,
      ctx,
      dto.codigo,
    );
    this.ponerCookieRefresh(res, refreshToken);
    return { accessToken, usuario };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rota la sesión usando la cookie de refresh' })
  async refresh(
    @Req() req: Request,
    @Auditoria() ctx: AuditCtx,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.[this.auth.refreshCookieName];
    const { accessToken, refreshToken, usuario } = await this.auth.refresh(raw, ctx);
    this.ponerCookieRefresh(res, refreshToken);
    return { accessToken, usuario };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cierra la sesión y revoca el refresh token' })
  async logout(
    @Req() req: Request,
    @Auditoria() ctx: AuditCtx,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.[this.auth.refreshCookieName], ctx);
    res.clearCookie(this.auth.refreshCookieName, { path: '/api/v1/auth' });
    return { ok: true };
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  me(@CurrentUser() user: UsuarioActual) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @Post('cambiar-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cambia la contraseña propia y cierra las demás sesiones' })
  async cambiarPassword(
    @CurrentUser() user: UsuarioActual,
    @Body() dto: CambiarPasswordDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    await this.auth.cambiarPassword(user.id, dto.actual, dto.nueva, ctx);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Post('mfa/setup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Genera el secreto TOTP (aún no activo)' })
  setupMfa(@CurrentUser() user: UsuarioActual) {
    return this.auth.iniciarMfa(user.id);
  }

  @ApiBearerAuth()
  @Post('mfa/activar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activa el MFA verificando un código del autenticador' })
  activarMfa(
    @CurrentUser() user: UsuarioActual,
    @Body() dto: CodigoMfaDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.auth.activarMfa(user.id, dto.codigo, ctx);
  }

  @ApiBearerAuth()
  @Post('mfa/desactivar')
  @HttpCode(200)
  async desactivarMfa(
    @CurrentUser() user: UsuarioActual,
    @Body() dto: CodigoMfaDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.auth.desactivarMfa(user.id, dto.codigo, ctx);
  }
}
