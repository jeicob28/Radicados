import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import type { AuditCtx } from '../auth/decorators';
import { ActualizarRolDto, CrearRolDto } from './dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  listar() {
    return this.prisma.rol.findMany({ orderBy: { codigo: 'asc' } });
  }

  async crear(dto: CrearRolDto, ctx: AuditCtx) {
    try {
      const rol = await this.prisma.rol.create({
        data: {
          codigo: dto.codigo,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          permisos: dto.permisos ?? [],
        },
      });
      await this.bitacora.registrar({
        ctx,
        entidad: 'rol',
        entidadId: rol.id,
        accion: 'CREAR',
        despues: { codigo: rol.codigo, permisos: rol.permisos },
      });
      return rol;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un rol con ese código');
      }
      throw e;
    }
  }

  async actualizar(codigo: string, dto: ActualizarRolDto, ctx: AuditCtx) {
    const rol = await this.prisma.rol.findUnique({ where: { codigo } });
    if (!rol) throw new NotFoundException('Rol no encontrado');
    if (rol.sistema && dto.permisos) {
      throw new BadRequestException('No se pueden modificar los permisos de un rol del sistema');
    }

    const actualizado = await this.prisma.rol.update({
      where: { codigo },
      data: {
        nombre: dto.nombre ?? rol.nombre,
        descripcion: dto.descripcion ?? rol.descripcion,
        permisos: dto.permisos ?? rol.permisos,
      },
    });

    await this.bitacora.registrar({
      ctx,
      entidad: 'rol',
      entidadId: rol.id,
      accion: 'ACTUALIZAR',
      antes: { nombre: rol.nombre, permisos: rol.permisos },
      despues: { nombre: actualizado.nombre, permisos: actualizado.permisos },
    });

    return actualizado;
  }
}
