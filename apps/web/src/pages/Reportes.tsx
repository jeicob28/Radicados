import { useState } from 'react';
import { api, download } from '../api';
import { Boton, Card, ErrorMsg } from '../ui';

const TIPOS = [
  ['recibidos', 'Radicados recibidos'],
  ['enviados', 'Radicados enviados'],
  ['pendientes', 'Radicados pendientes'],
  ['vencidos', 'Radicados vencidos'],
  ['por-dependencia', 'Por dependencia'],
  ['por-funcionario', 'Por funcionario'],
  ['tiempo-respuesta', 'Tiempo de respuesta'],
  ['derechos-peticion', 'Derechos de petición'],
  ['documentos-por-serie', 'Documentos por serie'],
  ['anulados', 'Radicados anulados'],
];

interface Reporte {
  titulo: string;
  columnas: string[];
  filas: (string | number | null)[][];
  resumen?: Record<string, unknown>;
}

export default function Reportes() {
  const [tipo, setTipo] = useState('recibidos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [rep, setRep] = useState<Reporte | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const qs = () => {
    const p = new URLSearchParams();
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    return p.toString();
  };

  const generar = async () => {
    setCargando(true);
    setError(null);
    try {
      setRep(await api<Reporte>(`/reportes/${tipo}?${qs()}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="page">
      <h1>Reportes e indicadores</h1>
      <Card>
        <div className="filtros">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          <Boton onClick={generar} disabled={cargando}>
            {cargando ? '…' : 'Generar'}
          </Boton>
          <Boton
            variante="ghost"
            onClick={() => download(`/reportes/${tipo}?${qs()}&formato=xlsx`, `reporte-${tipo}.xlsx`)}
          >
            Descargar Excel
          </Boton>
        </div>

        {error && <ErrorMsg>{error}</ErrorMsg>}
        {rep && (
          <>
            {rep.resumen && (
              <p className="resumen">
                {Object.entries(rep.resumen).map(([k, v]) => (
                  <span key={k}>
                    <strong>{String(v)}</strong> {k}
                  </span>
                ))}
              </p>
            )}
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    {rep.columnas.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rep.filas.slice(0, 200).map((f, i) => (
                    <tr key={i}>
                      {f.map((v, j) => (
                        <td key={j}>{v ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                  {rep.filas.length === 0 && (
                    <tr>
                      <td colSpan={rep.columnas.length} className="vacio">
                        Sin datos en el período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
