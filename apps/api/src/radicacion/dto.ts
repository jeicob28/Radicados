import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const TIPOS_CONSECUTIVO = ['ENT', 'SAL', 'UNICO'] as const;
export const CANALES = [
  'PRESENCIAL',
  'CORREO',
  'WEB',
  'FORMULARIO',
  'SISTEMA',
  'TELEFONO',
  'FISICO',
] as const;
export const TIPOS_COMUNICACION = [
  'GENERAL',
  'DERECHO_PETICION',
  'PETICION_INFORMACION',
  'PETICION_DOCUMENTOS',
  'CONSULTA',
  'QUEJA',
  'RECLAMO',
  'SOLICITUD',
  'FELICITACION',
  'SUGERENCIA',
  'OTRO',
] as const;

export class AdjuntoRefDto {
  @ApiProperty() @IsString() objectKey!: string;
  @ApiProperty() @IsString() nombre!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contentType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() tamanoBytes?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() checksumSha256?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() paginas?: number;
}

export class RadicarDto {
  @ApiProperty({ enum: TIPOS_CONSECUTIVO, default: 'ENT' })
  @IsEnum(TIPOS_CONSECUTIVO)
  tipo!: (typeof TIPOS_CONSECUTIVO)[number];

  @ApiProperty({ enum: CANALES })
  @IsEnum(CANALES)
  canal!: (typeof CANALES)[number];

  @ApiPropertyOptional({ description: 'Tercero remitente (entrada) o destinatario (salida)' })
  @IsOptional()
  @IsString()
  terceroId?: string;

  @ApiPropertyOptional({ description: 'Texto libre del destinatario si no es un tercero registrado' })
  @IsOptional()
  @IsString()
  destinatario?: string;

  @ApiPropertyOptional({ description: 'Dependencia a la que se dirige / responsable inicial' })
  @IsOptional()
  @IsString()
  dependenciaId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  asunto!: string;

  @ApiPropertyOptional({ enum: TIPOS_COMUNICACION, default: 'GENERAL' })
  @IsOptional()
  @IsEnum(TIPOS_COMUNICACION)
  tipoComunicacion?: (typeof TIPOS_COMUNICACION)[number];

  @ApiPropertyOptional() @IsOptional() @IsString() medioRespuesta?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  folios?: number;

  @ApiPropertyOptional({ description: 'Número del radicado de entrada al que responde (solo salida)' })
  @IsOptional()
  @IsString()
  enRespuestaA?: string;

  @ApiPropertyOptional({
    description:
      'Fecha y hora real de llegada del documento físico, si difiere de la fecha de radicación (recepción con rezago)',
  })
  @IsOptional()
  @IsDateString()
  fechaRecepcion?: string;

  @ApiPropertyOptional({
    description: 'Nombre de quien entrega físicamente el documento (mensajero, no siempre es el remitente)',
  })
  @IsOptional()
  @IsString()
  entregadoPor?: string;

  @ApiPropertyOptional({ type: [AdjuntoRefDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdjuntoRefDto)
  adjuntos?: AdjuntoRefDto[];
}

export class AnularRadicadoDto {
  @ApiProperty({ example: 'Error de radicación' })
  @IsString()
  motivo!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'La anulación exige una justificación' })
  justificacion!: string;
}

export class ActualizarConsecutivoDto {
  @ApiPropertyOptional({ example: '{vigencia}-ENT-{numero:06}' })
  @IsOptional()
  @IsString()
  formato?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) rangoContingenciaDesde?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) rangoContingenciaHasta?: number;
}
