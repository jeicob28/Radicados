import {
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';

class CrearTerceroDto {
  @ApiProperty({ enum: ['NATURAL', 'JURIDICA'] })
  @IsIn(['NATURAL', 'JURIDICA'])
  tipoPersona!: string;

  @ApiProperty({ example: 'CC' }) @IsString() tipoDocumento!: string;
  @ApiProperty() @IsString() numeroDocumento!: string;
  @ApiProperty() @IsString() nombre!: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() telefono?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() direccion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ciudad?: string;

  @ApiPropertyOptional({ description: 'Autorización de tratamiento de datos personales (Ley 1581)' })
  @IsOptional()
  @IsBoolean()
  autorizaTratamiento?: boolean;
}

class ActualizarTerceroDto extends PartialType(CrearTerceroDto) {}

@Injectable()
class TercerosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  listar(q?: string) {
    const where: Prisma.TerceroWhereInput = q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { numeroDocumento: { contains: q } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
    return this.prisma.tercero.findMany({ where, orderBy: { nombre: 'asc' }, take: 100 });
  }

  async obtener(id: string) {
    const t = await this.prisma.tercero.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Tercero no encontrado');
    return t;
  }

  async crear(dto: CrearTerceroDto, ctx: AuditCtx) {
    try {
      const t = await this.prisma.tercero.create({ data: { ...dto } });
      await this.bitacora.registrar({
        ctx,
        entidad: 'tercero',
        entidadId: t.id,
        accion: 'CREAR',
        despues: { documento: `${t.tipoDocumento} ${t.numeroDocumento}`, nombre: t.nombre },
      });
      return t;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un tercero con ese documento');
      }
      throw e;
    }
  }

  async actualizar(id: string, dto: ActualizarTerceroDto, ctx: AuditCtx) {
    await this.obtener(id);
    const t = await this.prisma.tercero.update({ where: { id }, data: { ...dto } });
    await this.bitacora.registrar({
      ctx,
      entidad: 'tercero',
      entidadId: id,
      accion: 'ACTUALIZAR',
      despues: { nombre: t.nombre, email: t.email, autorizaTratamiento: t.autorizaTratamiento },
    });
    return t;
  }
}

@ApiTags('terceros')
@ApiBearerAuth()
@Controller('terceros')
class TercerosController {
  constructor(private readonly terceros: TercerosService) {}

  @Get()
  listar(@Query('q') q?: string) {
    return this.terceros.listar(q);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.terceros.obtener(id);
  }

  @Post()
  @Roles(ROLES.VENTANILLA, ROLES.FUNCIONARIO, ROLES.RADICADOR)
  crear(@Body() dto: CrearTerceroDto, @Auditoria() ctx: AuditCtx) {
    return this.terceros.crear(dto, ctx);
  }

  @Patch(':id')
  @Roles(ROLES.VENTANILLA, ROLES.FUNCIONARIO, ROLES.RADICADOR)
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarTerceroDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.terceros.actualizar(id, dto, ctx);
  }
}

@Module({
  controllers: [TercerosController],
  providers: [TercerosService],
})
export class TercerosModule {}
