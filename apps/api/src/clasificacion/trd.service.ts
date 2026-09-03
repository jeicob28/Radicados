import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import type { AuditCtx } from '../auth/decorators';
import {
  ActualizarSerieDto,
  CrearSerieDto,
  CrearSubserieDto,
  CrearTipoDocumentalDto,
} from './dto';

@Injectable()
export class TrdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  /** Cuadro de clasificación: dependencia → serie → subserie, con reglas TRD. */
  async cuadro() {
    const series = await this.prisma.serie.findMany({
      orderBy: [{ dependenciaId: 'asc' }, { codigo: 'asc' }],
      include: {
        dependencia: { select: { codigo: true, nombre: true } },
        subseries: { orderBy: { codigo: 'asc' } },
      },
    });
    return series.map((s) => ({
      id: s.id,
      codigo: s.codigo,
      nombre: s.nombre,
      dependencia: s.dependencia,
      trd: {
        archivoGestion: s.retencionArchivoGestion,
        archivoCentral: s.retencionArchivoCentral,
        disposicionFinal: s.disposicionFinal,
        procedimiento: s.procedimiento,
      },
      subseries: s.subseries.map((ss) => ({
        id: ss.id,
        codigo: ss.codigo,
        nombre: ss.nombre,
        trd: {
          archivoGestion: ss.retencionArchivoGestion ?? s.retencionArchivoGestion,
          archivoCentral: ss.retencionArchivoCentral ?? s.retencionArchivoCentral,
          disposicionFinal: ss.disposicionFinal ?? s.disposicionFinal,
        },
      })),
    }));
  }

  listarSeries(dependenciaId?: string) {
    return this.prisma.serie.findMany({
      where: dependenciaId ? { dependenciaId } : {},
      orderBy: { codigo: 'asc' },
      include: { subseries: { orderBy: { codigo: 'asc' } } },
    });
  }

  async crearSerie(dto: CrearSerieDto, ctx: AuditCtx) {
    const dep = await this.prisma.dependencia.findUnique({ where: { id: dto.dependenciaId } });
    if (!dep) throw new NotFoundException('Dependencia inexistente');
    try {
      const serie = await this.prisma.serie.create({ data: { ...dto } });
      await this.bitacora.registrar({
        ctx, entidad: 'serie', entidadId: serie.id, accion: 'CREAR',
        despues: { codigo: serie.codigo, nombre: serie.nombre, disposicionFinal: serie.disposicionFinal },
      });
      return serie;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe una serie con ese código en la dependencia');
      }
      throw e;
    }
  }

  async actualizarSerie(id: string, dto: ActualizarSerieDto, ctx: AuditCtx) {
    const antes = await this.prisma.serie.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Serie no encontrada');
    const serie = await this.prisma.serie.update({ where: { id }, data: { ...dto } });
    await this.bitacora.registrar({
      ctx, entidad: 'serie', entidadId: id, accion: 'ACTUALIZAR',
      antes: { retencionAG: antes.retencionArchivoGestion, disposicion: antes.disposicionFinal },
      despues: { retencionAG: serie.retencionArchivoGestion, disposicion: serie.disposicionFinal },
    });
    return serie;
  }

  async crearSubserie(serieId: string, dto: CrearSubserieDto, ctx: AuditCtx) {
    const serie = await this.prisma.serie.findUnique({ where: { id: serieId } });
    if (!serie) throw new NotFoundException('Serie no encontrada');
    try {
      const ss = await this.prisma.subserie.create({ data: { ...dto, serieId } });
      await this.bitacora.registrar({
        ctx, entidad: 'subserie', entidadId: ss.id, accion: 'CREAR',
        despues: { codigo: ss.codigo, nombre: ss.nombre, serieId },
      });
      return ss;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe una subserie con ese código en la serie');
      }
      throw e;
    }
  }

  async crearTipoDocumental(dto: CrearTipoDocumentalDto, ctx: AuditCtx) {
    try {
      const t = await this.prisma.tipoDocumental.create({ data: { ...dto } });
      await this.bitacora.registrar({
        ctx, entidad: 'tipo_documental', entidadId: t.id, accion: 'CREAR',
        despues: { codigo: t.codigo, nombre: t.nombre },
      });
      return t;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un tipo documental con ese código');
      }
      throw e;
    }
  }

  listarTiposDocumentales() {
    return this.prisma.tipoDocumental.findMany({ orderBy: { codigo: 'asc' } });
  }
}
