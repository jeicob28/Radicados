import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Matches } from 'class-validator';

export class CrearRolDto {
  @ApiProperty({ example: 'MESA_AYUDA' })
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{2,29}$/, { message: 'El código debe ser MAYÚSCULAS con _ (3-30)' })
  codigo!: string;

  @ApiProperty() @IsString() nombre!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permisos?: string[];
}

export class ActualizarRolDto {
  @ApiPropertyOptional() @IsOptional() @IsString() nombre?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permisos?: string[];
}
