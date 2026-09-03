import { formatearConsecutivo } from './consecutivo.util';

describe('formatearConsecutivo', () => {
  it('formatea un radicado de entrada con relleno de ceros', () => {
    expect(
      formatearConsecutivo('{vigencia}-{tipo}-{numero:06}', 2026, 'ENT', 458),
    ).toBe('2026-ENT-000458');
  });

  it('formatea un radicado de salida', () => {
    expect(
      formatearConsecutivo('{vigencia}-{tipo}-{numero:06}', 2026, 'SAL', 1),
    ).toBe('2026-SAL-000001');
  });

  it('formatea el consecutivo único institucional (sin tipo)', () => {
    expect(formatearConsecutivo('{vigencia}-{numero:06}', 2026, 'UNICO', 12)).toBe(
      '2026-000012',
    );
  });

  it('admite secuenciales de más de 6 dígitos sin truncar', () => {
    expect(
      formatearConsecutivo('{vigencia}-{tipo}-{numero:06}', 2026, 'ENT', 1234567),
    ).toBe('2026-ENT-1234567');
  });
});
