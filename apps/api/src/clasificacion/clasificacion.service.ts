import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { ExpedientesService } from './expedientes.service';
import type { AuditCtx } from '../auth/decorators';
import { adjuntarComoAnexos } from '../common/anexos.util';
import { ClasificarRadicadoDto } from './dto';

@Injectable()
export class ClasificacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly expedientes: ExpedientesService,
  ) {}

  async clasificar(numero: string, dto: ClasificarRadicadoDto, ctx: AuditCtx) {
    const radicado = await this.prisma.radicado.findUnique({
      where: { numero },
      include: { anexos: true },
    });
    if (!radicado) throw new NotFoundException(`Radicado ${numero} no encontrado`);
    if (radicado.estado === 'ANULADO') throw new BadRequestException('El radicado está anulado');
    if (radicado.expedienteId) throw new BadRequestException('El radicado ya está en un expediente');

    const serie = await this.prisma.serie.findUnique({ where: { id: dto.serieId } });
    if (!serie) throw new BadRequestException('Serie inexistente');
    if (dto.subserieId) {
      const ss = await this.prisma.subserie.findFirst({
        where: { id: dto.subserieId, serieId: dto.serieId },
      });
      if (!ss) throw new BadRequestException('La subserie no pertenece a la serie');
    }

    // Resolver expediente destino
    let expedienteId: string;
    if (dto.expedienteNumero) {
      const exp = await this.prisma.expediente.findUnique({ where: { numero: dto.expedienteNumero } });
      if (!exp) throw new BadRequestException('Expediente destino inexistente');
      if (exp.estado !== 'ABIERTO') throw new BadRequestException('El expediente destino está cerrado');
      expedienteId = exp.id;
    } else {
      if (!dto.nuevoExpedienteTitulo) {
        throw new BadRequestException(
          'Indique expedienteNumero o nuevoExpedienteTitulo',
        );
      }
      const dependenciaId = radicado.dependenciaId ?? serie.dependenciaId;
      const exp = await this.expedientes.crear(
        {
          titulo: dto.nuevoExpedienteTitulo,
          serieId: dto.serieId,
          subserieId: dto.subserieId,
          dependenciaId,
        },
        ctx,
      );
      expedienteId = exp.id;
    }

    const anterior = radicado.estado;

    await this.prisma.$transaction(async (tx) => {
      const seq = await tx.eventoTramite.aggregate({
        where: { radicadoId: radicado.id },
        _max: { secuencia: true },
      });
      await tx.eventoTramite.create({
        data: {
          radicadoId: radicado.id,
          secuencia: (seq._max.secuencia ?? 0) + 1,
          tipoEvento: 'CLASIFICADO',
          estadoAnterior: anterior,
          estadoNuevo: anterior === 'RADICADO' ? 'CLASIFICADO' : anterior,
          actorId: ctx.usuario?.id ?? null,
          ip: ctx.ip ?? null,
          observacion: `Serie ${serie.codigo}; expediente asignado`,
        },
      });
      await tx.radicado.update({
        where: { id: radicado.id },
        data: {
          serieId: dto.serieId,
          subserieId: dto.subserieId ?? null,
          expedienteId,
          estado: anterior === 'RADICADO' ? 'CLASIFICADO' : anterior,
        },
      });
      await adjuntarComoAnexos(tx, radicado.id, dto.adjuntos, 'Soporte de la clasificación');
      await this.expedientes.incorporarRadicado(
        tx,
        expedienteId,
        radicado,
        radicado.anexos.map((a) => ({
          id: a.id,
          nombre: a.nombre,
          objectKey: a.objectKey,
          contentType: a.contentType,
          tamanoBytes: a.tamanoBytes,
          checksumSha256: a.checksumSha256,
        })),
        ctx,
      );
    });

    await this.bitacora.registrar({
      ctx, entidad: 'radicado', entidadId: radicado.id, accion: 'ACTUALIZAR',
      antes: { estado: anterior, expedienteId: null },
      despues: { estado: 'CLASIFICADO', serieId: dto.serieId, expedienteId },
      observacion: 'Clasificación archivística',
    });

    return this.prisma.radicado.findUnique({
      where: { id: radicado.id },
      include: {
        serie: { select: { codigo: true, nombre: true } },
        subserie: { select: { codigo: true, nombre: true } },
        expediente: { select: { numero: true, titulo: true } },
      },
    });
  }
}
