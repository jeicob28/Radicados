import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type RadicadoLista } from '../api';
import { useAuth } from '../auth';
import { Alerta, Card, EstadoPill, ErrorMsg, fechaCorta, useAsync } from '../ui';

// Roles con visibilidad total (ver también radicacion.service.ts en la API,
// que es quien realmente la impone). Los demás solo ven su dependencia —
// esta lista es solo para mostrar el aviso correcto, no aplica el filtro.
const ROLES_VISIBILIDAD_TOTAL = ['VENTANILLA', 'ARCHIVISTA', 'AUDITOR', 'RADICADOR'];

interface Pagina {
  total: number;
  page: number;
  pageSize: number;
  items: RadicadoLista[];
}

const ESTADOS = ['', 'RADICADO', 'CLASIFICADO', 'ASIGNADO', 'EN_TRAMITE', 'RESPONDIDO', 'POR_COMUNICAR', 'CERRADO', 'ANULADO'];

export default function Consulta() {
  const { tieneRol } = useAuth();
  const soloMiDependencia = !tieneRol(...ROLES_VISIBILIDAD_TOTAL);
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [estado, setEstado] = useState(sp.get('estado') ?? '');
  const [tipo, setTipo] = useState(sp.get('tipo') ?? '');
  const vencidos = sp.get('vencidos') === 'true';
  const page = Number(sp.get('page') ?? 1);

  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (estado) qs.set('estado', estado);
  if (tipo) qs.set('tipo', tipo);
  if (vencidos) qs.set('vencidos', 'true');
  qs.set('page', String(page));

  const { data, error, cargando } = useAsync<Pagina>(
    () => api(`/radicados?${qs.toString()}`),
    [qs.toString()],
  );

  const aplicar = () => {
    const n = new URLSearchParams();
    if (q) n.set('q', q);
    if (estado) n.set('estado', estado);
    if (tipo) n.set('tipo', tipo);
    if (vencidos) n.set('vencidos', 'true');
    setSp(n);
  };

  const irPagina = (p: number) => {
    const n = new URLSearchParams(sp);
    n.set('page', String(p));
    setSp(n);
  };

  return (
    <div className="page">
      <h1>Consulta de radicados</h1>
      {soloMiDependencia && (
        <p className="vacio" style={{ textAlign: 'left', padding: '0 0 10px' }}>
          Solo se muestran los radicados de tu dependencia.
        </p>
      )}
      <Card>
        <div className="filtros">
          <input
            placeholder="Número, asunto o remitente…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && aplicar()}
          />
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todo tipo</option>
            <option value="ENT">Entrada</option>
            <option value="SAL">Salida</option>
          </select>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS.map((s) => (
              <option key={s} value={s}>
                {s || 'Todo estado'}
              </option>
            ))}
          </select>
          <button className="btn primary" onClick={aplicar}>
            Buscar
          </button>
        </div>

        {error && <ErrorMsg>{error}</ErrorMsg>}
        {cargando && <p className="vacio">Cargando…</p>}
        {data && (
          <>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Radicado</th>
                    <th>Fecha</th>
                    <th>Asunto</th>
                    <th>Remitente</th>
                    <th>Dependencia</th>
                    <th>Estado</th>
                    <th>Alerta</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.numero}>
                      <td>
                        <Link to={`/radicados/${r.numero}`} className="rad">
                          {r.numero}
                        </Link>
                      </td>
                      <td>{fechaCorta(r.fechaHoraRadicacion)}</td>
                      <td>{r.asunto}</td>
                      <td>{r.tercero?.nombre ?? '—'}</td>
                      <td>{r.dependencia?.codigo ?? '—'}</td>
                      <td>
                        <EstadoPill estado={r.estado} />
                      </td>
                      <td>
                        <Alerta nivel={r.nivelAlerta} />
                      </td>
                    </tr>
                  ))}
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="vacio">
                        Sin resultados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="paginador">
              <span>
                {data.total} radicados · página {data.page}
              </span>
              <div>
                <button className="btn ghost" disabled={page <= 1} onClick={() => irPagina(page - 1)}>
                  ← Anterior
                </button>
                <button
                  className="btn ghost"
                  disabled={page * data.pageSize >= data.total}
                  onClick={() => irPagina(page + 1)}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
