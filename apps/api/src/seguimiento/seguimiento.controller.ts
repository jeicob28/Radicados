import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SeguimientoService } from './seguimiento.service';
import { AlertasService } from './alertas.service';
import {
  AsignarDto,
  ComunicadoOficialDto,
  MotivoDto,
  ObservacionDto,
  ReasignarDto,
  ResponderDto,
  TrasladarDto,
} from './dto';
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

  // aceptar / trasladar / devolver / cerrar / responder: sin restricción por
  // rol — cualquier usuario salvo AUDITOR puede tramitar los radicados
  // asignados a él o a su dependencia (el servicio lo verifica). Ver §21.2.
  @Post('radicados/:numero/aceptar')
  @ApiOperation({ summary: 'Acepta el trámite del radicado (pasa a EN_TRAMITE)' })
  aceptar(
    @Param('numero') numero: string,
    @Body() dto: ObservacionDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.seguimiento.aceptar(numero, dto, ctx);
  }

  @Post('radicados/:numero/trasladar')
  trasladar(@Param('numero') numero: string, @Body() dto: TrasladarDto, @Auditoria() ctx: AuditCtx) {
    return this.seguimiento.trasladar(numero, dto, ctx);
  }

  @Post('radicados/:numero/reasignar')
  @Roles(ROLES.JEFE)
  reasignar(@Param('numero') numero: string, @Body() dto: ReasignarDto, @Auditoria() ctx: AuditCtx) {
    return this.seguimiento.reasignar(numero, dto, ctx);
  }

  @Post('radicados/:numero/devolver')
  devolver(@Param('numero') numero: string, @Body() dto: MotivoDto, @Auditoria() ctx: AuditCtx) {
    return this.seguimiento.devolver(numero, dto, ctx);
  }

  @Post('radicados/:numero/cerrar')
  cerrar(@Param('numero') numero: string, @Body() dto: ObservacionDto, @Auditoria() ctx: AuditCtx) {
    return this.seguimiento.cerrar(numero, dto, ctx);
  }

  @Post('radicados/:numero/responder')
  @ApiOperation({
    summary:
      'Responde y cierra el radicado: elige la forma de responder, adjunta evidencias y la ' +
      'variante (DIRECTA = cierra; COMUNICADO_OFICIAL = pasa a Ventanilla Única).',
  })
  responder(@Param('numero') numero: string, @Body() dto: ResponderDto, @Auditoria() ctx: AuditCtx) {
    return this.seguimiento.responder(numero, dto, ctx);
  }

  @Post('radicados/:numero/comunicado-oficial')
  @Roles(ROLES.VENTANILLA)
  @ApiOperation({
    summary: 'Ventanilla Única emite el comunicado oficial de respuesta y cierra el radicado (estado POR_COMUNICAR).',
  })
  emitirComunicado(
    @Param('numero') numero: string,
    @Body() dto: ComunicadoOficialDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.seguimiento.emitirComunicado(numero, dto, ctx);
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
  @ApiOperation({
    summary:
      'Radicados abiertos con fecha de vencimiento y su nivel de alerta. ' +
      'Quien no tiene visibilidad total solo ve los de su dependencia.',
  })
  vencimientos(
    @CurrentUser() usuario: UsuarioActual,
    @Query('dependenciaId') dependenciaId?: string,
    @Query('nivel') nivel?: string,
  ) {
    return this.seguimiento.vencimientos({ dependenciaId, nivel }, usuario);
  }

  @Get('seguimiento/indicadores')
  indicadores(@CurrentUser() usuario: UsuarioActual, @Query('dependenciaId') dependenciaId?: string) {
    return this.seguimiento.indicadores(dependenciaId, usuario);
  }

  @Post('seguimiento/recalcular-alertas')
  @Roles(ROLES.JEFE, ROLES.RADICADOR)
  @ApiOperation({ summary: 'Fuerza el recálculo del semáforo de cumplimiento' })
  recalcular() {
    return this.alertas.recalcular();
  }
}
