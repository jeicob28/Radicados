import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SeguimientoService } from './seguimiento.service';
import { AlertasService } from './alertas.service';
import { AsignarDto, MotivoDto, ObservacionDto, ReasignarDto, TrasladarDto } from './dto';
import { Auditoria, CurrentUser, Roles } from '../auth/decorators';
import type { AuditCtx, UsuarioActual } from '../auth/decorators';
import { ROLES } from '../auth/roles';

@ApiTags('seguimiento')
@ApiBearerAuth()
@Controller()
export class SeguimientoController {
  constructor(
    private readonly seguimiento: SeguimientoService,
    private readonly alertas: AlertasService,
  ) {}

  @Post('radicados/:numero/asignar')
  @Roles(ROLES.JEFE, ROLES.VENTANILLA, ROLES.RADICADOR)
  @ApiOperation({ summary: 'Asigna el radicado a una dependencia y, opcionalmente, a un funcionario' })
  asignar(@Param('numero') numero: string, @Body() dto: AsignarDto, @Auditoria() ctx: AuditCtx) {
    return this.seguimiento.asignar(numero, dto, ctx);
  }

  @Post('radicados/:numero/aceptar')
  @Roles(ROLES.FUNCIONARIO, ROLES.JEFE)
  @ApiOperation({ summary: 'El funcionario acepta el trámite (pasa a EN_TRAMITE)' })
  aceptar(@Param('numero') numero: string, @Auditoria() ctx: AuditCtx) {
    return this.seguimiento.aceptar(numero, ctx);
  }

  @Post('radicados/:numero/trasladar')
  @Roles(ROLES.FUNCIONARIO, ROLES.JEFE)
  trasladar(@Param('numero') numero: string, @Body() dto: TrasladarDto, @Auditoria() ctx: AuditCtx) {
    return this.seguimiento.trasladar(numero, dto, ctx);
  }

  @Post('radicados/:numero/reasignar')
  @Roles(ROLES.JEFE)
  reasignar(@Param('numero') numero: string, @Body() dto: ReasignarDto, @Auditoria() ctx: AuditCtx) {
    return this.seguimiento.reasignar(numero, dto, ctx);
  }

  @Post('radicados/:numero/devolver')
  @Roles(ROLES.FUNCIONARIO, ROLES.JEFE)
  devolver(@Param('numero') numero: string, @Body() dto: MotivoDto, @Auditoria() ctx: AuditCtx) {
    return this.seguimiento.devolver(numero, dto, ctx);
  }

  @Post('radicados/:numero/cerrar')
  @Roles(ROLES.FUNCIONARIO, ROLES.JEFE)
  cerrar(@Param('numero') numero: string, @Body() dto: ObservacionDto, @Auditoria() ctx: AuditCtx) {
    return this.seguimiento.cerrar(numero, dto, ctx);
  }

  @Post('radicados/:numero/reabrir')
  @Roles(ROLES.JEFE)
  reabrir(@Param('numero') numero: string, @Body() dto: MotivoDto, @Auditoria() ctx: AuditCtx) {
    return this.seguimiento.reabrir(numero, dto, ctx);
  }

  @Get('bandeja')
  @ApiOperation({ summary: 'Radicados asignados al funcionario autenticado, con semáforo' })
  bandeja(@CurrentUser() user: UsuarioActual) {
    return this.seguimiento.bandeja(user.id);
  }

  @Get('seguimiento/vencimientos')
  @ApiOperation({ summary: 'Radicados abiertos con fecha de vencimiento y su nivel de alerta' })
  vencimientos(@Query('dependenciaId') dependenciaId?: string, @Query('nivel') nivel?: string) {
    return this.seguimiento.vencimientos({ dependenciaId, nivel });
  }

  @Get('seguimiento/indicadores')
  indicadores(@Query('dependenciaId') dependenciaId?: string) {
    return this.seguimiento.indicadores(dependenciaId);
  }

  @Post('seguimiento/recalcular-alertas')
  @Roles(ROLES.JEFE, ROLES.RADICADOR)
  @ApiOperation({ summary: 'Fuerza el recálculo del semáforo de cumplimiento' })
  recalcular() {
    return this.alertas.recalcular();
  }
}
