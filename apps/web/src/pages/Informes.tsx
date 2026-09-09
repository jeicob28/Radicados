import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { Boton, Card, ErrorMsg, Field, Modal, fechaCorta } from '../ui';
import { Barras, Dona, color, type Punto } from '../components/Graficas';

interface Metas {
  porcentajeATiempoMin: number;
  tiempoPromedioDiasMax: number;
  vencidosMax: number;
  tasaCumplimientoMin: number;
}
interface Tablero {
  filtros: { dependenciaId: string | null; dependenciaNombre: string | null; alcanceForzado?: boolean };
  kpi: {
    total: number; abiertos: number; cerrados: number; vencidos: number; enTramite: number;
    porcentajeATiempo: number | null; tiempoPromedioDias: number | null; tasaCumplimiento: number | null;
  };
  metas: Metas;
  porEstado: { clave: string; n: number }[];
  porAlerta: { clave: string; n: number }[];
  porTipoComunicacion: { clave: string; n: number }[];
  porDependencia: DepFila[];
}
interface DepFila {
  id: string; codigo: string; nombre: string; esHoja: boolean;
  total: number; abiertos: number; cerrados: number; vencidos: number;
}
interface Desglose {
  dependencia: { id: string; codigo: string; nombre: string } | null;
  tieneSubdependencias: boolean;
  subdependencias: DepFila[];
  funcionarios: { id: string; nombre: string; total: number; abiertos: number; cerrados: number }[];
  casos: {
    numero: string; asunto: string; estado: string; nivelAlerta: string; tipoComunicacion: string;
    funcionario: string | null; fechaVencimiento: string | null; diasHabilesRestantes: number | null;
  }[];
}

const COL_ESTADO: Record<string, string> = {
  RADICADO: '#4f8fb2', CLASIFICADO: '#4f8fb2', ASIGNADO: '#9a6400', EN_TRAMITE: '#9a6400',
  RESPONDIDO: '#2f7d4f', POR_COMUNICAR: '#9a6400', CERRADO: '#2f7d4f', REABIERTO: '#9a6400', ANULADO: '#b23524',
  RECIBIDO: '#8f6f4f',
};
const COL_ALERTA: Record<string, string> = {
  VERDE: '#2f7d4f', AMARILLO: '#9a6400', ROJO: '#b23524', VENCIDO: '#7a1d13', NA: '#9aa0a8',
};
const bonito = (s: string) => s.replace(/_/g, ' ');

export default function Informes() {
  const { tieneRol } = useAuth();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [deps, setDeps] = useState<{ id: string; label: string }[]>([]);
  const [depSel, setDepSel] = useState('');
  const [tab, setTab] = useState<Tablero | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editarMetas, setEditarMetas] = useState(false);

  // pila de drill-down: [] = tablero; luego {id,nombre} por nivel
  const [pila, setPila] = useState<{ id: string; nombre: string }[]>([]);
  const [desglose, setDesglose] = useState<Desglose | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    return p.toString();
  }, [desde, hasta]);

  useEffect(() => {
    api<{ id: string; codigo: string; nombre: string; hijos?: unknown[] }[]>('/dependencias')
      .then((arbol) => {
        const plano: { id: string; label: string }[] = [];
        const rec = (ns: any[], niv = 0) =>
          ns.forEach((n) => {
            plano.push({ id: n.id, label: `${'— '.repeat(niv)}${n.codigo} · ${n.nombre}` });
            rec(n.hijos ?? [], niv + 1);
          });
        rec(arbol);
        setDeps(plano);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setCargando(true);
    setError(null);
    const d = depSel ? `&dependenciaId=${depSel}` : '';
    api<Tablero>(`/informes/tablero?${qs}${d}`)
      .then((t) => {
        setTab(t);
        setPila([]);
        setDesglose(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setCargando(false));
  }, [qs, depSel]);

  const entrar = async (id: string, nombre: string) => {
    setError(null);
    try {
      const dg = await api<Desglose>(`/informes/dependencia/${id}?${qs}`);
      setDesglose(dg);
      setPila((p) => [...p, { id, nombre }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };
  const volverA = async (idx: number) => {
    if (idx < 0) {
      setPila([]);
      setDesglose(null);
      return;
    }
    const nueva = pila.slice(0, idx + 1);
    const dg = await api<Desglose>(`/informes/dependencia/${nueva[idx].id}?${qs}`);
    setPila(nueva);
    setDesglose(dg);
  };

  const puntosDep = (filas: DepFila[]): Punto[] =>
    filas.map((d) => ({ clave: d.id, label: `${d.codigo} · ${d.nombre}`, valor: d.total, color: d.vencidos > 0 ? '#b23524' : undefined }));

  return (
    <div className="page">
      <h1>Informes</h1>

      <Card
        actions={
          tieneRol('ADMIN') ? (
            <Boton variante="ghost" onClick={() => setEditarMetas(true)}>Metas de los KPI</Boton>
          ) : undefined
        }
      >
        <div className="filtros">
          <select
            value={depSel}
            onChange={(e) => setDepSel(e.target.value)}
            disabled={tab?.filtros.alcanceForzado}
          >
            <option value="">Todas las dependencias</option>
            {deps.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        {tab?.filtros.alcanceForzado && (
          <p className="vacio" style={{ padding: 0, textAlign: 'left' }}>
            Solo se muestran los datos de tu dependencia.
          </p>
        )}
      </Card>

      {error && <ErrorMsg>{error}</ErrorMsg>}
      {cargando && !tab && <p className="vacio">Cargando…</p>}

      {tab && (
        <>
          <Kpis kpi={tab.kpi} metas={tab.metas} />

          <div className="g-cols">
            <Card title="Por estado">
              <Dona
                datos={tab.porEstado.map((e) => ({ clave: e.clave, label: bonito(e.clave), valor: e.n, color: COL_ESTADO[e.clave] }))}
              />
            </Card>
            <Card title="Semáforo de cumplimiento (en curso)">
              <Dona
                datos={tab.porAlerta.map((a) => ({ clave: a.clave, label: bonito(a.clave), valor: a.n, color: COL_ALERTA[a.clave] }))}
              />
            </Card>
          </div>

          <Card title="Por tipo de comunicación">
            <Barras datos={tab.porTipoComunicacion.map((t, i) => ({ clave: t.clave, label: bonito(t.clave), valor: t.n, color: color(i) }))} />
          </Card>

          <Card title="Por dependencia">
            {(pila.length > 0 || desglose) && (
              <div className="g-migas">
                <button onClick={() => volverA(-1)}>Todas</button>
                {pila.map((p, i) => (
                  <span key={p.id}>
                    {' › '}
                    <button onClick={() => volverA(i)}>{p.nombre}</button>
                  </span>
                ))}
              </div>
            )}

            {!desglose && (
              <Barras datos={puntosDep(tab.porDependencia)} onClick={(p) => {
                const d = tab.porDependencia.find((x) => x.id === p.clave)!;
                entrar(d.id, `${d.codigo} · ${d.nombre}`);
              }} />
            )}

            {desglose && desglose.subdependencias.length > 0 && (
              <>
                <h4 style={{ margin: '4px 0 8px' }}>Por subdependencia</h4>
                <Barras
                  datos={puntosDep(desglose.subdependencias)}
                  onClick={(p) => {
                    const d = desglose.subdependencias.find((x) => x.id === p.clave)!;
                    entrar(d.id, `${d.codigo} · ${d.nombre}`);
                  }}
                />
              </>
            )}

            {desglose && desglose.funcionarios.length > 0 && (
              <>
                <h4 style={{ margin: '18px 0 8px' }}>
                  Por funcionario{desglose.subdependencias.length > 0 ? ' (asignados directamente)' : ''}
                </h4>
                <Barras
                  datos={desglose.funcionarios.map((f, i) => ({ clave: f.id, label: f.nombre, valor: f.total, color: color(i) }))}
                />
              </>
            )}

            {desglose && (
              <>
                <h4 style={{ margin: '18px 0 8px' }}>Casos en curso ({desglose.casos.length})</h4>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Radicado</th><th>Asunto</th><th>Funcionario</th><th>Estado</th><th>Vence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {desglose.casos.map((c) => (
                        <tr key={c.numero}>
                          <td><Link to={`/radicados/${c.numero}`} className="rad">{c.numero}</Link></td>
                          <td>{c.asunto}</td>
                          <td>{c.funcionario ?? '—'}</td>
                          <td><span className="pill muted">{bonito(c.estado)}</span></td>
                          <td>
                            {c.fechaVencimiento ? fechaCorta(c.fechaVencimiento) : '—'}
                            {c.diasHabilesRestantes != null && (
                              <span
                                className={`pill ${c.diasHabilesRestantes < 0 ? 'crit' : c.diasHabilesRestantes <= 2 ? 'warn' : 'ok'}`}
                                style={{ marginLeft: 6 }}
                              >
                                {c.diasHabilesRestantes < 0 ? `vencido ${-c.diasHabilesRestantes}d` : `${c.diasHabilesRestantes}d`}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {desglose.casos.length === 0 && (
                        <tr><td colSpan={5} className="vacio">Sin casos en curso.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {editarMetas && tab && (
        <MetasModal metas={tab.metas} onClose={() => setEditarMetas(false)} onGuardado={(m) => {
          setTab({ ...tab, metas: m });
          setEditarMetas(false);
        }} />
      )}
    </div>
  );
}

function Kpi({ label, valor, sufijo, meta, ok }: { label: string; valor: string | number; sufijo?: string; meta?: string; ok?: boolean }) {
  return (
    <div className="tile">
      <strong>{valor}{sufijo}</strong>
      <span>{label}</span>
      {meta && <div className={`kpi-meta ${ok ? 'ok' : 'mal'}`}>{ok ? '✓' : '✗'} {meta}</div>}
    </div>
  );
}

function Kpis({ kpi, metas }: { kpi: Tablero['kpi']; metas: Metas }) {
  return (
    <div className="tiles">
      <Kpi label="Radicados (total)" valor={kpi.total} />
      <Kpi label="Abiertos" valor={kpi.abiertos} />
      <Kpi
        label="Vencidos"
        valor={kpi.vencidos}
        meta={`meta ≤ ${metas.vencidosMax}`}
        ok={kpi.vencidos <= metas.vencidosMax}
      />
      <Kpi
        label="Respondidos a tiempo"
        valor={kpi.porcentajeATiempo ?? '—'}
        sufijo={kpi.porcentajeATiempo != null ? '%' : ''}
        meta={`meta ≥ ${metas.porcentajeATiempoMin}%`}
        ok={(kpi.porcentajeATiempo ?? 0) >= metas.porcentajeATiempoMin}
      />
      <Kpi
        label="Tiempo prom. respuesta"
        valor={kpi.tiempoPromedioDias ?? '—'}
        sufijo={kpi.tiempoPromedioDias != null ? ' d' : ''}
        meta={`meta ≤ ${metas.tiempoPromedioDiasMax} d`}
        ok={(kpi.tiempoPromedioDias ?? 999) <= metas.tiempoPromedioDiasMax}
      />
      <Kpi
        label="Tasa de cierre"
        valor={kpi.tasaCumplimiento ?? '—'}
        sufijo={kpi.tasaCumplimiento != null ? '%' : ''}
        meta={`meta ≥ ${metas.tasaCumplimientoMin}%`}
        ok={(kpi.tasaCumplimiento ?? 0) >= metas.tasaCumplimientoMin}
      />
    </div>
  );
}

function MetasModal({ metas, onClose, onGuardado }: { metas: Metas; onClose: () => void; onGuardado: (m: Metas) => void }) {
  const [f, setF] = useState(metas);
  const [err, setErr] = useState<string | null>(null);
  const [gu, setGu] = useState(false);
  const set = (k: keyof Metas) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: Number(e.target.value) });
  const guardar = async () => {
    setGu(true);
    setErr(null);
    try {
      const m = await api<Metas>('/informes/metas', { method: 'PUT', body: JSON.stringify(f) });
      onGuardado(m);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
      setGu(false);
    }
  };
  return (
    <Modal title="Metas de los indicadores" onClose={onClose}>
      <div className="form-grid">
        <Field label="Respondidos a tiempo — mínimo (%)">
          <input type="number" min={0} max={100} value={f.porcentajeATiempoMin} onChange={set('porcentajeATiempoMin')} />
        </Field>
        <Field label="Tiempo prom. de respuesta — máximo (días)">
          <input type="number" min={1} max={365} value={f.tiempoPromedioDiasMax} onChange={set('tiempoPromedioDiasMax')} />
        </Field>
        <Field label="Radicados vencidos — máximo">
          <input type="number" min={0} value={f.vencidosMax} onChange={set('vencidosMax')} />
        </Field>
        <Field label="Tasa de cierre — mínimo (%)">
          <input type="number" min={0} max={100} value={f.tasaCumplimientoMin} onChange={set('tasaCumplimientoMin')} />
        </Field>
      </div>
      {err && <ErrorMsg>{err}</ErrorMsg>}
      <div className="chips" style={{ marginTop: 10 }}>
        <Boton onClick={guardar} disabled={gu}>{gu ? 'Guardando…' : 'Guardar'}</Boton>
        <Boton variante="ghost" onClick={onClose}>Cancelar</Boton>
      </div>
    </Modal>
  );
}
