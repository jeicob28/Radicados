import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@empresa.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Admin2026*' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiPropertyOptional({ description: 'Código TOTP de 6 dígitos si el usuario tiene MFA' })
  @IsOptional()
  @IsString()
  codigo?: string;
}

export class CodigoMfaDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  codigo!: string;
}

export class CambiarPasswordDto {
  @ApiProperty()
  @IsString()
  actual!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'La nueva contraseña debe tener al menos 10 caracteres' })
  nueva!: string;
}
