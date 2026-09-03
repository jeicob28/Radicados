import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class AsignarDto {
  @ApiProperty({ description: 'Dependencia responsable del trámite' })
  @IsString()
  dependenciaId!: string;

  @ApiPropertyOptional({ description: 'Funcionario responsable (opcional)' })
  @IsOptional()
  @IsString()
  funcionarioId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() observacion?: string;
}

export class TrasladarDto {
  @ApiProperty() @IsString() dependenciaId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() funcionarioId?: string;

  @ApiProperty({ minLength: 5 })
  @IsString()
  @MinLength(5, { message: 'Indique el motivo del traslado' })
  motivo!: string;
}

export class ReasignarDto {
  @ApiProperty() @IsString() funcionarioId!: string;

  @ApiProperty({ minLength: 5 })
  @IsString()
  @MinLength(5)
  motivo!: string;
}

export class MotivoDto {
  @ApiProperty({ minLength: 5 })
  @IsString()
  @MinLength(5)
  motivo!: string;
}

export class ObservacionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() observacion?: string;
}
