import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsDefined, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';

class GuardarParametroDto {
  @ApiProperty({ description: 'Valor JSON del parámetro (objeto, arreglo, número o texto)' })
  @IsDefined()
  valor!: unknown;

  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string;
}

@Injectable()
class ParametrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  listar() {
    return this.prisma.parametro.findMany({ orderBy: { clave: 'asc' } });
  }

  async obtener(clave: string) {
    const p = await this.prisma.parametro.findUnique({ where: { clave } });
    if (!p) throw new NotFoundException(`Parámetro "${clave}" no existe`);
    return p;
  }

  async guardar(clave: string, dto: GuardarParametroDto, ctx: AuditCtx) {
    const antes = await this.prisma.parametro.findUnique({ where: { clave } });
    const p = await this.prisma.parametro.upsert({
      where: { clave },
      update: { valor: dto.valor as never, descripcion: dto.descripcion ?? antes?.descripcion ?? null },
      create: { clave, valor: dto.valor as never, descripcion: dto.descripcion ?? null },
    });
    await this.bitacora.registrar({
      ctx,
      entidad: 'parametro',
      entidadId: clave,
      accion: antes ? 'ACTUALIZAR' : 'CREAR',
      antes: antes?.valor ?? undefined,
      despues: p.valor,
    });
    return p;
  }
}

@ApiTags('parámetros')
@ApiBearerAuth()
@Controller('parametros')
class ParametrosController {
  constructor(private readonly parametros: ParametrosService) {}

  @Get()
  listar() {
    return this.parametros.listar();
  }

  @Get(':clave')
  obtener(@Param('clave') clave: string) {
    return this.parametros.obtener(clave);
  }

  @Put(':clave')
  @Roles(ROLES.DEV)
  guardar(
    @Param('clave') clave: string,
    @Body() dto: GuardarParametroDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.parametros.guardar(clave, dto, ctx);
  }
}

@Module({
  controllers: [ParametrosController],
  providers: [ParametrosService],
})
export class ParametrosModule {}
