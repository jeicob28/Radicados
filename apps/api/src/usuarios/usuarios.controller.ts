import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { ActualizarUsuarioDto, CrearUsuarioDto, EstablecerPasswordDto } from './dto';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';

@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('usuarios')
@Roles(ROLES.ADMIN)
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuarios (filtro por texto, estado y dependencia)' })
  listar(
    @Query('q') q?: string,
    @Query('activo') activo?: string,
    @Query('dependenciaId') dependenciaId?: string,
  ) {
    return this.usuarios.listar(q, activo === undefined ? undefined : activo === 'true', dependenciaId);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.usuarios.obtener(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un usuario; devuelve la contraseña temporal si no se envió una' })
  crear(@Body() dto: CrearUsuarioDto, @Auditoria() ctx: AuditCtx) {
    return this.usuarios.crear(dto, ctx);
  }

  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarUsuarioDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.usuarios.actualizar(id, dto, ctx);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Restablece la contraseña con una temporal aleatoria y cierra las sesiones' })
  resetPassword(@Param('id') id: string, @Auditoria() ctx: AuditCtx) {
    return this.usuarios.resetPassword(id, ctx);
  }

  @Post(':id/password')
  @ApiOperation({ summary: 'Fija una contraseña concreta para el usuario' })
  establecerPassword(
    @Param('id') id: string,
    @Body() dto: EstablecerPasswordDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.usuarios.establecerPassword(id, dto.password, dto.forzarCambio ?? true, ctx);
  }

  @Post(':id/cerrar-sesiones')
  @ApiOperation({ summary: 'Revoca todas las sesiones (refresh tokens) activas del usuario' })
  cerrarSesiones(@Param('id') id: string, @Auditoria() ctx: AuditCtx) {
    return this.usuarios.cerrarSesiones(id, ctx);
  }
}
