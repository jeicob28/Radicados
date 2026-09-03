import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export const DISPOSICIONES = [
  'CONSERVACION_TOTAL',
  'ELIMINACION',
  'SELECCION',
  'MICROFILMACION_DIGITALIZACION',
] as const;

export class CrearSerieDto {
  @ApiProperty({ example: '100' }) @IsString() codigo!: string;
  @ApiProperty() @IsString() nombre!: string;
  @ApiProperty() @IsString() dependenciaId!: string;

  @ApiProperty({ description: 'Años en archivo de gestión' })
  @IsInt()
  @Min(0)
  retencionArchivoGestion!: number;

  @ApiProperty({ description: 'Años en archivo central' })
  @IsInt()
  @Min(0)
  retencionArchivoCentral!: number;

  @ApiProperty({ enum: DISPOSICIONES })
  @IsEnum(DISPOSICIONES)
  disposicionFinal!: (typeof DISPOSICIONES)[number];

  @ApiPropertyOptional() @IsOptional() @IsString() procedimiento?: string;
}

export class ActualizarSerieDto extends PartialType(CrearSerieDto) {}

export class CrearSubserieDto {
  @ApiProperty() @IsString() codigo!: string;
  @ApiProperty() @IsString() nombre!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) retencionArchivoGestion?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) retencionArchivoCentral?: number;
  @ApiPropertyOptional({ enum: DISPOSICIONES })
  @IsOptional()
  @IsEnum(DISPOSICIONES)
  disposicionFinal?: (typeof DISPOSICIONES)[number];
}

export class CrearTipoDocumentalDto {
  @ApiProperty() @IsString() codigo!: string;
  @ApiProperty() @IsString() nombre!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serieId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subserieId?: string;
}

export class CrearExpedienteDto {
  @ApiProperty() @IsString() @MinLength(4) titulo!: string;
  @ApiProperty() @IsString() serieId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subserieId?: string;
  @ApiProperty() @IsString() dependenciaId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ubicacionFisica?: string;
}

export class ClasificarRadicadoDto {
  @ApiProperty() @IsString() serieId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subserieId?: string;

  @ApiPropertyOptional({ description: 'Expediente existente al que se incorpora' })
  @IsOptional()
  @IsString()
  expedienteNumero?: string;

  @ApiPropertyOptional({ description: 'Si no hay expediente, título para crear uno nuevo' })
  @IsOptional()
  @IsString()
  nuevoExpedienteTitulo?: string;
}

export class IncorporarDocumentoDto {
  @ApiProperty() @IsString() @MinLength(2) titulo!: string;
  @ApiPropertyOptional({ description: 'Anexo existente de un radicado a incorporar' })
  @IsOptional()
  @IsString()
  anexoId?: string;
}
