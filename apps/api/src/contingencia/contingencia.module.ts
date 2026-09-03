import {
  BadRequestException,
  Body,
  Controller,
  Injectable,
  Module,
  NotFoundException,
  Post,
  Get,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { hashRadicado } from '../common/hash';
import { formatearConsecutivo } from '../common/consecutivo.util';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';
import { CANALES, TIPOS_COMUNICACION, TIPOS_CONSECUTIVO, AdjuntoRefDto } from '../radicacion/dto';

class IncorporarContingenciaDto {
  @ApiProperty({ enum: TIPOS_CONSECUTIVO })
  @IsEnum(TIPOS_CONSECUTIVO)
  tipo!: (typeof TIPOS_CONSECUTIVO)[number];

  @ApiProperty({ description: 'Número del talonario físico (dentro del rango de contingencia)' })
  @IsInt()
  @Min(1)
  numeroTalonario!: number;

  @ApiProperty({ description: 'Fecha y hora reales de la radicación manual (ISO 8601)' })
  @IsISO8601()
  fechaHoraReal!: string;

  @ApiProperty({ enum: CANALES }) @IsEnum(CANALES) canal!: (typeof CANALES)[number];

  @ApiProperty() @IsString() @MinLength(4) asunto!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() terceroId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() destinatario?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dependenciaId?: string;

  @ApiPropertyOptional({ enum: TIPOS_COMUNICACION })
  @IsOptional()
  @IsEnum(TIPOS_COMUNICACION)
  tipoComunicacion?: (typeof TIPOS_COMUNICACION)[number];

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) folios?: number;

  @ApiProperty({ minLength: 8, description: 'Justificación / acta de la incorporación' })
  @IsString()
  @MinLength(8)
  justificacion!: string;

  @ApiPropertyOptional({ type: [AdjuntoRefDto] })
  @IsOptional()
  @IsArray()
  adjuntos?: AdjuntoRefDto[];
}

@Injectable()
class ContingenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  private async vigencia(): Promise<number> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: 'consecutivo.vigencia_actual' } });
    return typeof p?.valor === 'number' ? (p.valor as number) : new Date().getUTCFullYear();
  }

  async incorporar(dto: IncorporarContingenciaDto, ctx: AuditCtx) {
    const vigencia = await this.vigencia();
    const consecutivo = await this.prisma.consecutivo.findUnique({
      where: { vigencia_tipo: { vigencia, tipo: dto.tipo as never } },
    });
    if (!consecutivo) throw new NotFoundException('No hay consecutivo para esa vigencia y tipo');
    if (consecutivo.rangoContingenciaDesde == null || consecutivo.rangoContingenciaHasta == null) {
      throw new BadRequestException('El consecutivo no tiene rango de contingencia configurado');
    }
    const { numeroTalonario: n } = dto;
    if (n < consecutivo.rangoContingenciaDesde || n > consecutivo.rangoContingenciaHasta) {
      throw new BadRequestException(
        `El número ${n} está fuera del rango de contingencia ` +
          `(${consecutivo.rangoContingenciaDesde}–${consecutivo.rangoContingenciaHasta})`,
      );
    }
    if (consecutivo.ultimoContingencia != null && n <= consecutivo.ultimoContingencia) {
      throw new BadRequestException(
        `El número ${n} ya fue usado en contingencia (último: ${consecutivo.ultimoContingencia})`,
      );
    }

    const numero = formatearConsecutivo(consecutivo.formato, vigencia, dto.tipo, n);
    const duplicado = await this.prisma.radicado.findUnique({ where: { numero } });
    if (duplicado) throw new BadRequestException(`El radicado ${numero} ya existe`);

    const fechaReal = new Date(dto.fechaHoraReal);
    const anterior = await this.prisma.radicado.findFirst({
      where: { vigencia, tipo: dto.tipo as never },
      orderBy: { secuencial: 'desc' },
      select: { hashRegistro: true },
    });
    const hash = hashRadicado({
      numero,
      fechaHoraIso: fechaReal.toISOString(),
      terceroDocumento: dto.terceroId ?? 's/d',
      asunto: dto.asunto,
      hashAnterior: anterior?.hashRegistro ?? null,
    });

    const radicado = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.radicado.create({
        data: {
          numero,
          vigencia,
          tipo: dto.tipo as never,
          consecutivoId: consecutivo.id,
          secuencial: n,
          origen: 'CONTINGENCIA',
          canal: dto.canal as never,
          fechaHoraRadicacion: fechaReal,
          terceroId: dto.terceroId ?? null,
          destinatario: dto.destinatario ?? null,
          dependenciaId: dto.dependenciaId ?? null,
          asunto: dto.asunto,
          tipoComunicacion: (dto.tipoComunicacion as never) ?? 'GENERAL',
          folios: dto.folios ?? 0,
          estado: 'RADICADO',
          hashRegistro: hash,
          hashAnterior: anterior?.hashRegistro ?? null,
        },
      });
      await tx.eventoTramite.create({
        data: {
          radicadoId: creado.id,
          secuencia: 1,
          tipoEvento: 'RADICADO',
          estadoNuevo: 'RADICADO',
          actorId: ctx.usuario?.id ?? null,
          ip: ctx.ip ?? null,
          observacion: `Incorporación de contingencia (talonario ${n}). ${dto.justificacion}`,
        },
      });
      if (dto.adjuntos?.length) {
        await tx.anexo.createMany({
          data: dto.adjuntos.map((a) => ({
            radicadoId: creado.id,
            nombre: a.nombre,
            objectKey: a.objectKey,
            contentType: a.contentType ?? null,
            tamanoBytes: a.tamanoBytes ?? null,
            checksumSha256: a.checksumSha256 ?? null,
          })),
        });
      }
      await tx.consecutivo.update({
        where: { id: consecutivo.id },
        data: { ultimoContingencia: n },
      });
      return creado;
    });

    await this.bitacora.registrar({
      ctx, entidad: 'radicado', entidadId: radicado.id, accion: 'CREAR',
      despues: { numero, origen: 'CONTINGENCIA', talonario: n },
      observacion: dto.justificacion,
    });
    return radicado;
  }

  async conciliacion(tipo: string) {
    const vigencia = await this.vigencia();
    const consecutivo = await this.prisma.consecutivo.findUnique({
      where: { vigencia_tipo: { vigencia, tipo: tipo as never } },
    });
    if (!consecutivo) throw new NotFoundException('Consecutivo no encontrado');
    const { rangoContingenciaDesde: d, rangoContingenciaHasta: h } = consecutivo;

    const incorporados = await this.prisma.radicado.findMany({
      where: { consecutivoId: consecutivo.id, origen: 'CONTINGENCIA' },
      select: { numero: true, secuencial: true, fechaHoraRadicacion: true, asunto: true },
      orderBy: { secuencial: 'asc' },
    });
    const usados = new Set(incorporados.map((r) => r.secuencial));

    const faltantes: number[] = [];
    if (d != null && consecutivo.ultimoContingencia != null) {
      for (let i = d; i <= consecutivo.ultimoContingencia; i++) {
        if (!usados.has(i)) faltantes.push(i);
      }
    }

    const colisiones = await this.prisma.radicado.findMany({
      where: {
        consecutivoId: consecutivo.id,
        origen: { not: 'CONTINGENCIA' },
        ...(d != null && h != null ? { secuencial: { gte: d, lte: h } } : {}),
      },
      select: { numero: true, secuencial: true, origen: true },
    });

    return {
      vigencia,
      tipo,
      rango: d != null ? { desde: d, hasta: h } : null,
      ultimoContingencia: consecutivo.ultimoContingencia,
      incorporados,
      faltantes,
      colisiones,
      ok: faltantes.length === 0 && colisiones.length === 0,
    };
  }
}

@ApiTags('contingencia')
@ApiBearerAuth()
@Controller('contingencia')
@Roles(ROLES.RADICADOR)
class ContingenciaController {
  constructor(private readonly contingencia: ContingenciaService) {}

  @Post('incorporar')
  @ApiOperation({ summary: 'Incorpora un radicado hecho manualmente durante una contingencia' })
  incorporar(@Body() dto: IncorporarContingenciaDto, @Auditoria() ctx: AuditCtx) {
    return this.contingencia.incorporar(dto, ctx);
  }

  @Get('conciliacion')
  @ApiOperation({ summary: 'Verifica que todo el rango de contingencia se incorporó sin colisiones' })
  conciliacion(@Query('tipo') tipo = 'ENT') {
    return this.contingencia.conciliacion(tipo);
  }
}

@Module({
  controllers: [ContingenciaController],
  providers: [ContingenciaService],
})
export class ContingenciaModule {}
