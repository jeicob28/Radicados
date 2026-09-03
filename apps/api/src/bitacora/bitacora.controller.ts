import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BitacoraService } from './bitacora.service';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';

@ApiTags('auditoría')
@ApiBearerAuth()
@Controller('bitacora')
@Roles(ROLES.AUDITOR)
export class BitacoraController {
  constructor(private readonly bitacora: BitacoraService) {}

  @Get()
  @ApiOperation({ summary: 'Consulta filtrada de la bitácora (solo lectura)' })
  listar(
    @Query('entidad') entidad?: string,
    @Query('entidadId') entidadId?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('accion') accion?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.bitacora.listar({
      entidad,
      entidadId,
      usuarioId,
      accion,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
  }

  @Get('verificacion')
  @ApiOperation({ summary: 'Verifica la cadena de hashes de la bitácora de extremo a extremo' })
  verificar() {
    return this.bitacora.verificar();
  }

  @Get('exportar')
  @ApiOperation({ summary: 'Exportación firmada de la bitácora para entes de control' })
  exportar(@Auditoria() ctx: AuditCtx) {
    return this.bitacora.exportar(ctx);
  }
}
