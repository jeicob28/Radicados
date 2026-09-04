import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class EstablecerPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ default: true, description: 'Exigir cambio en el próximo ingreso' })
  @IsOptional()
  @IsBoolean()
  forzarCambio?: boolean;
}

export class CrearUsuarioDto {
  @ApiProperty() @IsString() documento!: string;
  @ApiProperty() @IsString() nombre!: string;
  @ApiProperty() @IsEmail() email!: string;

  @ApiProperty({ type: [String], example: ['FUNCIONARIO'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roles!: string[];

  @ApiPropertyOptional() @IsOptional() @IsUUID() dependenciaId?: string;

  @ApiPropertyOptional({ description: 'Si se omite, se genera una contraseña temporal' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  password?: string;
}

export class ActualizarUsuarioDto extends PartialType(CrearUsuarioDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() activo?: boolean;
}
