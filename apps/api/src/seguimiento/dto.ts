import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AdjuntoRefDto } from '../radicacion/dto';

export const MEDIOS_RESPUESTA = [
  'CORREO_ELECTRONICO',
  'FISICO',
  'TELEFONICO',
  'PRESENCIAL',
  'PORTAL_WEB',
  'OTRO',
] as const;

export const VARIANTES_RESPUESTA = ['DIRECTA', 'COMUNICADO_OFICIAL'] as const;

/**
 * Base para todas las acciones de trámite: cualquiera puede acompañarse de
 * evidencias/soportes (opcionales), sin importar el estado o la acción.
 * Ver Requerimientos §21.2.
 */
export class AccionConEvidenciasDto {
  @ApiPropertyOptional({ type: [AdjuntoRefDto], description: 'Evidencias / documentos de soporte' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdjuntoRefDto)
  adjuntos?: AdjuntoRefDto[];
}

export class AsignarDto extends AccionConEvidenciasDto {
  @ApiProperty({ description: 'Dependencia responsable del trámite' })
  @IsString()
  dependenciaId!: string;

  @ApiPropertyOptional({ description: 'Funcionario responsable (opcional)' })
  @IsOptional()
  @IsString()
  funcionarioId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() observacion?: string;
}

export class TrasladarDto extends AccionConEvidenciasDto {
  @ApiProperty() @IsString() dependenciaId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() funcionarioId?: string;

  @ApiProperty({ minLength: 5 })
  @IsString()
  @MinLength(5, { message: 'Indique el motivo del traslado' })
  motivo!: string;
}

export class ReasignarDto extends AccionConEvidenciasDto {
  @ApiProperty() @IsString() funcionarioId!: string;

  @ApiProperty({ minLength: 5 })
  @IsString()
  @MinLength(5)
  motivo!: string;
}

export class MotivoDto extends AccionConEvidenciasDto {
  @ApiProperty({ minLength: 5 })
  @IsString()
  @MinLength(5)
  motivo!: string;
}

export class ObservacionDto extends AccionConEvidenciasDto {
  @ApiPropertyOptional() @IsOptional() @IsString() observacion?: string;
}

export class ResponderDto {
  @ApiProperty({
    enum: VARIANTES_RESPUESTA,
    description:
      'DIRECTA = el funcionario ya respondió al solicitante (cierra el radicado). ' +
      'COMUNICADO_OFICIAL = requiere que Ventanilla Única emita un comunicado oficial.',
  })
  @IsEnum(VARIANTES_RESPUESTA)
  variante!: (typeof VARIANTES_RESPUESTA)[number];

  @ApiProperty({ enum: MEDIOS_RESPUESTA, description: 'Forma en que se respondió / se responderá' })
  @IsEnum(MEDIOS_RESPUESTA)
  medioRespuesta!: (typeof MEDIOS_RESPUESTA)[number];

  @ApiProperty({ minLength: 10, description: 'Notas del trámite y de la respuesta' })
  @IsString()
  @MinLength(10, { message: 'Escriba las notas del trámite (mínimo 10 caracteres)' })
  notas!: string;

  @ApiProperty({ type: [AdjuntoRefDto], description: 'Evidencias de la respuesta (al menos una)' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Adjunte al menos una evidencia' })
  @ValidateNested({ each: true })
  @Type(() => AdjuntoRefDto)
  adjuntos!: AdjuntoRefDto[];
}

export class ComunicadoOficialDto {
  @ApiProperty({ type: [AdjuntoRefDto], description: 'Comunicado oficial (al menos un archivo)' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Adjunte el comunicado oficial' })
  @ValidateNested({ each: true })
  @Type(() => AdjuntoRefDto)
  adjuntos!: AdjuntoRefDto[];

  @ApiPropertyOptional() @IsOptional() @IsString() observacion?: string;
}
