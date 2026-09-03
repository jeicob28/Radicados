import { hashRadicado, sha256Hex } from './hash';

describe('hash de integridad del radicado', () => {
  it('es determinista para la misma entrada', () => {
    const args = {
      numero: '2026-ENT-000458',
      fechaHoraIso: '2026-09-03T08:32:00.000Z',
      terceroDocumento: 'NIT-900123456',
      asunto: 'Solicitud de información',
      hashAnterior: null,
    };
    expect(hashRadicado(args)).toBe(hashRadicado(args));
    expect(hashRadicado(args)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('encadena con el hash anterior (cambia si cambia la cadena)', () => {
    const base = {
      numero: '2026-ENT-000002',
      fechaHoraIso: '2026-09-03T09:00:00.000Z',
      terceroDocumento: 's/d',
      asunto: 'Cuenta de cobro',
      hashAnterior: 'a'.repeat(64),
    };
    expect(hashRadicado(base)).not.toBe(hashRadicado({ ...base, hashAnterior: 'b'.repeat(64) }));
  });

  it('cambia si cambia el asunto o el número', () => {
    const base = {
      numero: '2026-ENT-000010',
      fechaHoraIso: '2026-09-03T10:00:00.000Z',
      terceroDocumento: 's/d',
      asunto: 'A',
      hashAnterior: null,
    };
    expect(hashRadicado(base)).not.toBe(hashRadicado({ ...base, asunto: 'B' }));
    expect(hashRadicado(base)).not.toBe(hashRadicado({ ...base, numero: '2026-ENT-000011' }));
  });

  it('sha256Hex produce 64 hex y es estable', () => {
    expect(sha256Hex('sgdea')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('sgdea')).toBe(sha256Hex('sgdea'));
    expect(sha256Hex('sgdea')).not.toBe(sha256Hex('SGDEA'));
  });
});
