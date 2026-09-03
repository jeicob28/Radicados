import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { ActualizarRolDto, CrearRolDto } from './dto';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  listar() {
    return this.roles.listar();
  }

  @Post()
  @Roles(ROLES.ADMIN)
  crear(@Body() dto: CrearRolDto, @Auditoria() ctx: AuditCtx) {
    return this.roles.crear(dto, ctx);
  }

  @Patch(':codigo')
  @Roles(ROLES.ADMIN)
  actualizar(
    @Param('codigo') codigo: string,
    @Body() dto: ActualizarRolDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.roles.actualizar(codigo, dto, ctx);
  }
}
