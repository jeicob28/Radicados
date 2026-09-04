import { Module } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';

class CrearDependenciaDto {
  @ApiProperty({ example: 'CON' })
  @IsString()
  @Matches(/^[A-Z0-9_]{2,12}$/)
  codigo!: string;

  @ApiProperty() @IsString() nombre!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
}

class ActualizarDependenciaDto extends PartialType(CrearDependenciaDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activa?: boolean;
}

interface DepNodo {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  hijos: DepNodo[];
}

@Injectable()
class DependenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  async obtener(id: string) {
    const dep = await this.prisma.dependencia.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, codigo: true, nombre: true } },
        hijos: { select: { id: true, codigo: true, nombre: true, activa: true }, orderBy: { codigo: 'asc' } },
        usuarios: {
          select: { id: true, nombre: true, email: true, roles: true, activo: true, ultimoAcceso: true },
          orderBy: { nombre: 'asc' },
        },
        _count: { select: { radicados: true, expedientes: true } },
      },
    });
    if (!dep) throw new NotFoundException('Dependencia no encontrada');
    return dep;
  }

  async arbol(): Promise<DepNodo[]> {
    const todas = await this.prisma.dependencia.findMany({ orderBy: { codigo: 'asc' } });
    const porId = new Map<string, DepNodo>();
    todas.forEach((d) =>
      porId.set(d.id, { id: d.id, codigo: d.codigo, nombre: d.nombre, activa: d.activa, hijos: [] }),
    );
    const raiz: DepNodo[] = [];
    todas.forEach((d) => {
      const nodo = porId.get(d.id)!;
      if (d.parentId && porId.has(d.parentId)) porId.get(d.parentId)!.hijos.push(nodo);
      else raiz.push(nodo);
    });
    return raiz;
  }

  async crear(dto: CrearDependenciaDto, ctx: AuditCtx) {
    if (dto.parentId) {
      const p = await this.prisma.dependencia.findUnique({ where: { id: dto.parentId } });
      if (!p) throw new BadRequestException('La dependencia superior no existe');
    }
    try {
      const dep = await this.prisma.dependencia.create({
        data: { codigo: dto.codigo, nombre: dto.nombre, parentId: dto.parentId ?? null },
      });
      await this.bitacora.registrar({
        ctx,
        entidad: 'dependencia',
        entidadId: dep.id,
        accion: 'CREAR',
        despues: { codigo: dep.codigo, nombre: dep.nombre },
      });
      return dep;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe una dependencia con ese código');
      }
      throw e;
    }
  }

  async actualizar(id: string, dto: ActualizarDependenciaDto, ctx: AuditCtx) {
    const antes = await this.prisma.dependencia.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Dependencia no encontrada');
    if (dto.parentId === id) throw new BadRequestException('Una dependencia no puede ser su propia superior');

    const dep = await this.prisma.dependencia.update({
      where: { id },
      data: {
        nombre: dto.nombre ?? antes.nombre,
        codigo: dto.codigo ?? antes.codigo,
        parentId: dto.parentId === undefined ? antes.parentId : dto.parentId,
        activa: dto.activa ?? antes.activa,
      },
    });
    await this.bitacora.registrar({
      ctx,
      entidad: 'dependencia',
      entidadId: id,
      accion: 'ACTUALIZAR',
      antes: { nombre: antes.nombre, activa: antes.activa },
      despues: { nombre: dep.nombre, activa: dep.activa },
    });
    return dep;
  }
}

@ApiTags('dependencias')
@ApiBearerAuth()
@Controller('dependencias')
class DependenciasController {
  constructor(private readonly deps: DependenciasService) {}

  @Get()
  arbol() {
    return this.deps.arbol();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una dependencia con su personal y sub-dependencias' })
  obtener(@Param('id') id: string) {
    return this.deps.obtener(id);
  }

  @Post()
  @Roles(ROLES.ADMIN)
  crear(@Body() dto: CrearDependenciaDto, @Auditoria() ctx: AuditCtx) {
    return this.deps.crear(dto, ctx);
  }

  @Patch(':id')
  @Roles(ROLES.ADMIN)
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarDependenciaDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.deps.actualizar(id, dto, ctx);
  }
}

@Module({
  controllers: [DependenciasController],
  providers: [DependenciasService],
})
export class DependenciasModule {}
