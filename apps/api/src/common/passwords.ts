import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';

const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(plano: string): Promise<string> {
  return argonHash(plano, OPTS);
}

export async function verifyPassword(hashStr: string, plano: string): Promise<boolean> {
  try {
    return await argonVerify(hashStr, plano, OPTS);
  } catch {
    return false;
  }
}

/** Contraseña temporal legible para entregar a un usuario nuevo. */
export function generarPasswordTemporal(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) out += alfabeto[bytes[i] % alfabeto.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}
