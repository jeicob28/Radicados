import { createHash } from 'node:crypto';

export const sha256Hex = (input: string | Buffer): string =>
  createHash('sha256').update(input).digest('hex');

/**
 * Hash de integridad de un radicado: encadena con el hash del radicado anterior
 * de la misma vigencia/tipo. Réplica del cálculo documentado en §5 de la arquitectura.
 */
export function hashRadicado(params: {
  numero: string;
  fechaHoraIso: string;
  terceroDocumento: string;
  asunto: string;
  hashAnterior: string | null;
}): string {
  return sha256Hex(
    [
      params.hashAnterior ?? '',
      params.numero,
      params.fechaHoraIso,
      params.terceroDocumento,
      params.asunto,
    ].join('|'),
  );
}
