/**
 * Formatea un número de radicado a partir de una plantilla.
 * Debe producir exactamente lo mismo que la función SQL `fn_asignar_consecutivo`.
 *
 * Marcadores admitidos:
 *   {vigencia}     -> año (2026)
 *   {tipo}         -> ENT | SAL | UNICO
 *   {numero:06}    -> secuencial con relleno de ceros a 6 posiciones
 *   {numero}       -> secuencial sin relleno
 *
 * Ejemplo: formatearConsecutivo('{vigencia}-{tipo}-{numero:06}', 2026, 'ENT', 458)
 *          => '2026-ENT-000458'
 */
export function formatearConsecutivo(
  formato: string,
  vigencia: number,
  tipo: string,
  numero: number,
): string {
  return formato
    .replace('{vigencia}', String(vigencia))
    .replace('{tipo}', tipo)
    .replace('{numero:06}', String(numero).padStart(6, '0'))
    .replace('{numero}', String(numero));
}
