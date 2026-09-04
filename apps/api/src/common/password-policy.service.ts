import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PoliticaPassword {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  /** días antes de exigir cambio; null = sin caducidad */
  caducidadDias: number | null;
}

export const POLITICA_PASSWORD_DEFECTO: PoliticaPassword = {
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSpecial: false,
  caducidadDias: null,
};

const CLAVE = 'seguridad.password_policy';

@Injectable()
export class PasswordPolicyService {
  private cache?: { en: number; politica: PoliticaPassword };

  constructor(private readonly prisma: PrismaService) {}

  async obtener(): Promise<PoliticaPassword> {
    if (this.cache && Date.now() - this.cache.en < 60_000) return this.cache.politica;
    const p = await this.prisma.parametro.findUnique({ where: { clave: CLAVE } });
    const politica: PoliticaPassword = {
      ...POLITICA_PASSWORD_DEFECTO,
      ...((p?.valor as Partial<PoliticaPassword>) ?? {}),
    };
    this.cache = { en: Date.now(), politica };
    return politica;
  }

  async validar(password: string): Promise<void> {
    const p = await this.obtener();
    const errores: string[] = [];
    if (password.length < p.minLength) errores.push(`mínimo ${p.minLength} caracteres`);
    if (p.requireUpper && !/[A-ZÁÉÍÓÚÑ]/.test(password)) errores.push('al menos una mayúscula');
    if (p.requireLower && !/[a-záéíóúñ]/.test(password)) errores.push('al menos una minúscula');
    if (p.requireNumber && !/[0-9]/.test(password)) errores.push('al menos un número');
    if (p.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
      errores.push('al menos un carácter especial');
    }
    if (errores.length) {
      throw new BadRequestException(`La contraseña no cumple la política: ${errores.join(', ')}`);
    }
  }

  async haCaducado(passwordCambiadaEn: Date | null): Promise<boolean> {
    const p = await this.obtener();
    if (!p.caducidadDias) return false;
    if (!passwordCambiadaEn) return true;
    const dias = (Date.now() - passwordCambiadaEn.getTime()) / 86_400_000;
    return dias > p.caducidadDias;
  }
}
