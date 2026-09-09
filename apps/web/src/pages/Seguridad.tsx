import { useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Boton, Card, ErrorMsg, Field, Modal, fechaCorta, useAsync } from '../ui';
import { Barras, Dona, type Punto } from '../components/Graficas';
import { MapaCalor, banda } from '../components/MapaCalor';

// ─────────────────────────── tipos ───────────────────────────
interface Activo {
  id: string; codigo: string; nombre: string; descripcion: string | null; clase: string;
  propietario: string | null; custodio: string | null; dependenciaId: string | null; ubicacion: string | null;
  esInfraestructura: boolean; confidencialidad: number; integridad: number; disponibilidad: number;
  valoracion: number; activo: boolean; riesgos: number;
}
interface Riesgo {
  id: string; codigo: string; nombre: string; descripcion: string | null; amenaza: string; vulnerabilidad: string;
  probabilidad: number; impacto: number; nivelInherente: number; opcionTratamiento: string;
  probabilidadResidual: number | null; impactoResidual: number | null; nivelResidual: number | null;
  estado: string; responsable: string | null; responsableId: string | null; fechaRevision: string | null;
  bandaInherente: string; bandaResidual: string | null; planes: number;
  activo: { codigo: string; nombre: string; esInfraestructura: boolean };
  controles: { codigo: string; titulo: string }[];
}
interface ControlSoa {
  codigo: string; tema: string; titulo: string; riesgosAsociados: number;
  soa: { aplica: boolean; justificacion: string | null; estado: string; observaciones: string | null; fechaImplementacion: string | null; responsable: string | null };
}
interface Plan {
  id: string; riesgoId: string; descripcion: string; accion: string | null; responsable: string | null;
  fechaObjetivo: string | null; estado: string; avance: number; fechaCierre: string | null; vencido: boolean;
  riesgo: { codigo: string; nombre: string };
}
interface Tablero {
  alcanceInfra: boolean;
  matriz: number[][];
  porBanda: { clave: string; n: number }[];
  porEstado: { clave: string; n: number }[];
  activosPorClase: { clave: string; n: number }[];
  totales: { activos: number; riesgos: number; riesgosAltos: number };
  soa: { total: number; aplicables: number; noAplica: number; implementados: number; cobertura: number };
  planes: { total: number; abiertos: number; vencidos: number };
}
interface Marco {
  version: string; fechaAprobacion: string | null; politica: string; alcance: string;
  objetivos: string[]; metodologia: string; periodicidadRevision: string;
  roles: { rol: string; responsabilidad: string }[]; referencias: string[];
}

const CLASES = ['INFORMACION', 'SOFTWARE', 'HARDWARE', 'SERVICIO', 'INFRAESTRUCTURA', 'PERSONAL', 'INSTALACION'];
const ESTADOS_RIESGO = ['IDENTIFICADO', 'EN_TRATAMIENTO', 'MITIGADO', 'ACEPTADO', 'CERRADO'];
const OPCIONES = ['MITIGAR', 'TRANSFERIR', 'EVITAR', 'ACEPTAR'];
const ESTADOS_CONTROL = ['NO_APLICA', 'NO_IMPLEMENTADO', 'PLANIFICADO', 'EN_IMPLEMENTACION', 'IMPLEMENTADO'];
const ESTADOS_PLAN = ['ABIERTO', 'EN_CURSO', 'IMPLEMENTADO', 'VERIFICADO', 'CERRADO'];
const TEMAS: Record<string, string> = {
  ORGANIZACIONAL: 'A.5 · Organizacionales', PERSONAS: 'A.6 · Personas',
  FISICO: 'A.7 · Físicos', TECNOLOGICO: 'A.8 · Tecnológicos',
};
const hum = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const cmpControl = (a: string, b: string) => {
  const [a1, a2] = a.split('.').map(Number);
  const [b1, b2] = b.split('.').map(Number);
  return a1 - b1 || a2 - b2;
};
const COL_BANDA: Record<string, string> = { bajo: '#3f8f6f', medio: '#9c6b12', alto: '#c2410c', extremo: '#b23a2e' };

const TABS = ['Tablero', 'Activos', 'Riesgos', 'Controles (SoA)', 'Planes', 'Marco'] as const;

export default function Seguridad() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Tablero');
  return (
    <div className="page">
      <h1>Seguridad de la información</h1>
      <p className="vacio" style={{ textAlign: 'left', padding: 0, marginTop: -6 }}>
        SGSI según ISO/IEC 27001:2022 — activos, riesgos, controles del Anexo A y plan de tratamiento.
      </p>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Tablero' && <TableroPanel />}
      {tab === 'Activos' && <ActivosPanel />}
      {tab === 'Riesgos' && <RiesgosPanel />}
      {tab === 'Controles (SoA)' && <ControlesPanel />}
      {tab === 'Planes' && <PlanesPanel />}
      {tab === 'Marco' && <MarcoPanel />}
    </div>
  );
}

// ─────────────────────────── Tablero ───────────────────────────
function TableroPanel() {
  const { data, error } = useAsync<Tablero>(() => api('/sgsi/tablero'), []);
  if (error) return <ErrorMsg>{error}</ErrorMsg>;
  if (!data) return <p className="vacio">Cargando…</p>;
  const bandas: Punto[] = data.porBanda.map((b) => ({ clave: b.clave, label: hum(b.clave), valor: b.n, color: COL_BANDA[b.clave.toLowerCase()] }));
  const estados: Punto[] = data.porEstado.map((e) => ({ clave: e.clave, label: hum(e.clave), valor: e.n }));
  const clases: Punto[] = data.activosPorClase.map((c) => ({ clave: c.clave, label: hum(c.clave), valor: c.n }));

  return (
    <>
      <div className="g-cols">
        <Card title="Mapa de calor de riesgos">
          <MapaCalor matriz={data.matriz} />
        </Card>
        <Card title="Riesgos por nivel">
          <Dona datos={bandas} />
          {!!estados.length && <div style={{ marginTop: 12 }}><Barras datos={estados} /></div>}
        </Card>
      </div>
      <div className="g-cols">
        <Card title="Cobertura de la Declaración de Aplicabilidad">
          <div className="tiles">
            <Kpi n={`${data.soa.cobertura}%`} t="Controles implementados" />
            <Kpi n={`${data.soa.implementados}/${data.soa.aplicables}`} t="Implementados / aplicables" />
            <Kpi n={data.soa.noAplica} t="No aplican" />
            <Kpi n={data.soa.total} t="Controles Anexo A" />
          </div>
        </Card>
        <Card title="Activos y planes">
          <div className="tiles">
            <Kpi n={data.totales.activos} t="Activos de información" />
            <Kpi n={data.totales.riesgos} t="Riesgos" />
            <Kpi n={data.totales.riesgosAltos} t="Riesgos altos / extremos" alerta={data.totales.riesgosAltos > 0} />
            <Kpi n={data.planes.vencidos} t="Planes vencidos" alerta={data.planes.vencidos > 0} />
          </div>
          {!!clases.length && <div style={{ marginTop: 12 }}><Barras datos={clases} /></div>}
        </Card>
      </div>
      {!data.alcanceInfra && (
        <p className="vacio" style={{ textAlign: 'left' }}>
          Vista de administración: no se incluyen los activos ni los riesgos de infraestructura (visibles para el rol técnico y auditoría).
        </p>
      )}
    </>
  );
}

function Kpi({ n, t, alerta }: { n: number | string; t: string; alerta?: boolean }) {
  return (
    <div className={`tile${alerta ? ' crit' : ''}`}>
      <strong>{n}</strong>
      <span>{t}</span>
    </div>
  );
}

// ─────────────────────────── Activos ───────────────────────────
function ActivosPanel() {
  const { esDev } = useAuth();
  const { data, error, recargar } = useAsync<Activo[]>(() => api('/sgsi/activos'), []);
  const [edita, setEdita] = useState<Activo | null | 'nuevo'>(null);

  return (
    <Card actions={<Boton variante="ghost" onClick={() => setEdita('nuevo')}>+ Nuevo activo</Boton>}>
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Código</th><th>Activo</th><th>Clase</th><th>C·I·D</th><th>Valoración</th><th>Riesgos</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id} className="g-clic" onClick={() => setEdita(a)}>
                <td className="mono">{a.codigo}</td>
                <td>{a.nombre}{a.esInfraestructura && <span className="pill muted" style={{ marginLeft: 6 }}>infra</span>}</td>
                <td>{hum(a.clase)}</td>
                <td className="mono">{a.confidencialidad}·{a.integridad}·{a.disponibilidad}</td>
                <td><span className="pill acc">{a.valoracion}</span></td>
                <td className="num">{a.riesgos}</td>
              </tr>
            ))}
            {data && !data.length && <tr><td colSpan={6} className="vacio">Sin activos registrados.</td></tr>}
          </tbody>
        </table>
      </div>
      {edita && (
        <ActivoModal
          activo={edita === 'nuevo' ? null : edita}
          puedeInfra={esDev}
          onClose={() => setEdita(null)}
          onDone={() => { setEdita(null); recargar(); }}
        />
      )}
    </Card>
  );
}

function ActivoModal({ activo, puedeInfra, onClose, onDone }: { activo: Activo | null; puedeInfra: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    nombre: activo?.nombre ?? '', descripcion: activo?.descripcion ?? '', clase: activo?.clase ?? 'INFORMACION',
    propietario: activo?.propietario ?? '', custodio: activo?.custodio ?? '', ubicacion: activo?.ubicacion ?? '',
    esInfraestructura: activo?.esInfraestructura ?? false,
    confidencialidad: activo?.confidencialidad ?? 3, integridad: activo?.integridad ?? 3, disponibilidad: activo?.disponibilidad ?? 3,
  });
  const [error, setError] = useState<string | null>(null);
  const [env, setEnv] = useState(false);
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  const guardar = async () => {
    setError(null);
    if (f.nombre.trim().length < 2) return setError('Indique el nombre del activo.');
    setEnv(true);
    try {
      const body = { ...f, nombre: f.nombre.trim() };
      if (activo) await api(`/sgsi/activos/${activo.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/sgsi/activos', { method: 'POST', body: JSON.stringify(body) });
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setEnv(false); }
  };
  const eliminar = async () => {
    if (!activo || !confirm(`¿Eliminar el activo ${activo.codigo}?`)) return;
    try { await api(`/sgsi/activos/${activo.id}`, { method: 'DELETE' }); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Modal title={activo ? `Activo ${activo.codigo}` : 'Nuevo activo de información'} onClose={onClose}>
      <Field label="Nombre"><input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} /></Field>
      <Field label="Descripción"><textarea rows={2} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} /></Field>
      <Field label="Clase">
        <select value={f.clase} onChange={(e) => set('clase', e.target.value)}>
          {CLASES.map((c) => <option key={c} value={c}>{hum(c)}</option>)}
        </select>
      </Field>
      <div className="cid-grid">
        <Field label="Confidencialidad (1–5)"><input type="number" min={1} max={5} value={f.confidencialidad} onChange={(e) => set('confidencialidad', +e.target.value)} /></Field>
        <Field label="Integridad (1–5)"><input type="number" min={1} max={5} value={f.integridad} onChange={(e) => set('integridad', +e.target.value)} /></Field>
        <Field label="Disponibilidad (1–5)"><input type="number" min={1} max={5} value={f.disponibilidad} onChange={(e) => set('disponibilidad', +e.target.value)} /></Field>
      </div>
      <Field label="Propietario"><input value={f.propietario} onChange={(e) => set('propietario', e.target.value)} /></Field>
      <Field label="Custodio"><input value={f.custodio} onChange={(e) => set('custodio', e.target.value)} /></Field>
      <Field label="Ubicación"><input value={f.ubicacion} onChange={(e) => set('ubicacion', e.target.value)} /></Field>
      {puedeInfra && (
        <label className="radio-inline">
          <input type="checkbox" checked={f.esInfraestructura} onChange={(e) => set('esInfraestructura', e.target.checked)} />
          Activo de infraestructura (visible solo para el rol técnico y auditoría)
        </label>
      )}
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="modal-acciones">
        {activo && <Boton variante="danger" onClick={eliminar}>Eliminar</Boton>}
        <Boton variante="ghost" onClick={onClose}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={env}>{env ? '…' : 'Guardar'}</Boton>
      </div>
    </Modal>
  );
}

// ─────────────────────────── Riesgos ───────────────────────────
function RiesgosPanel() {
  const { data, error, recargar } = useAsync<Riesgo[]>(() => api('/sgsi/riesgos'), []);
  const activos = useAsync<Activo[]>(() => api('/sgsi/activos'), []);
  const controles = useAsync<ControlSoa[]>(() => api('/sgsi/controles'), []);
  const [edita, setEdita] = useState<Riesgo | null | 'nuevo'>(null);

  return (
    <Card actions={<Boton variante="ghost" onClick={() => setEdita('nuevo')}>+ Nuevo riesgo</Boton>}>
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Código</th><th>Riesgo · activo</th><th>Amenaza / vulnerabilidad</th><th>Inherente</th><th>Residual</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id} className="g-clic" onClick={() => setEdita(r)}>
                <td className="mono">{r.codigo}</td>
                <td>{r.nombre}<div className="vacio" style={{ padding: 0, textAlign: 'left' }}>{r.activo.codigo} · {r.activo.nombre}</div></td>
                <td className="celda-sm">{r.amenaza} / {r.vulnerabilidad}</td>
                <td><NivelPill p={r.probabilidad} i={r.impacto} n={r.nivelInherente} /></td>
                <td>{r.nivelResidual != null ? <NivelPill p={r.probabilidadResidual!} i={r.impactoResidual!} n={r.nivelResidual} /> : '—'}</td>
                <td><span className="pill muted">{hum(r.estado)}</span></td>
              </tr>
            ))}
            {data && !data.length && <tr><td colSpan={6} className="vacio">Sin riesgos registrados.</td></tr>}
          </tbody>
        </table>
      </div>
      {edita && (
        <RiesgoModal
          riesgo={edita === 'nuevo' ? null : edita}
          activos={activos.data ?? []}
          controles={controles.data ?? []}
          onClose={() => setEdita(null)}
          onDone={() => { setEdita(null); recargar(); }}
        />
      )}
    </Card>
  );
}

function NivelPill({ p, i, n }: { p: number; i: number; n: number }) {
  return <span className="pill" style={{ background: COL_BANDA[banda(n)], color: '#fff' }} title={`P${p} × I${i}`}>{n} · {banda(n)}</span>;
}

function RiesgoModal({ riesgo, activos, controles, onClose, onDone }: { riesgo: Riesgo | null; activos: Activo[]; controles: ControlSoa[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    activoId: riesgo?.activo ? activos.find((a) => a.codigo === riesgo.activo.codigo)?.id ?? '' : '',
    nombre: riesgo?.nombre ?? '', descripcion: riesgo?.descripcion ?? '',
    amenaza: riesgo?.amenaza ?? '', vulnerabilidad: riesgo?.vulnerabilidad ?? '',
    probabilidad: riesgo?.probabilidad ?? 3, impacto: riesgo?.impacto ?? 3,
    opcionTratamiento: riesgo?.opcionTratamiento ?? 'MITIGAR', estado: riesgo?.estado ?? 'IDENTIFICADO',
    probabilidadResidual: riesgo?.probabilidadResidual ?? 0, impactoResidual: riesgo?.impactoResidual ?? 0,
  });
  const [sel, setSel] = useState<string[]>(riesgo?.controles.map((c) => c.codigo) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [env, setEnv] = useState(false);
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  const guardar = async () => {
    setError(null);
    if (!f.activoId) return setError('Seleccione el activo afectado.');
    if (f.nombre.trim().length < 3 || f.amenaza.trim().length < 3 || f.vulnerabilidad.trim().length < 3)
      return setError('Complete nombre, amenaza y vulnerabilidad.');
    setEnv(true);
    try {
      const body: Record<string, unknown> = {
        activoId: f.activoId, nombre: f.nombre.trim(), descripcion: f.descripcion || undefined,
        amenaza: f.amenaza.trim(), vulnerabilidad: f.vulnerabilidad.trim(),
        probabilidad: f.probabilidad, impacto: f.impacto, opcionTratamiento: f.opcionTratamiento, estado: f.estado,
        controlCodigos: sel,
      };
      if (f.probabilidadResidual && f.impactoResidual) {
        body.probabilidadResidual = f.probabilidadResidual;
        body.impactoResidual = f.impactoResidual;
      }
      if (riesgo) await api(`/sgsi/riesgos/${riesgo.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/sgsi/riesgos', { method: 'POST', body: JSON.stringify(body) });
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setEnv(false); }
  };
  const eliminar = async () => {
    if (!riesgo || !confirm(`¿Eliminar el riesgo ${riesgo.codigo}?`)) return;
    try { await api(`/sgsi/riesgos/${riesgo.id}`, { method: 'DELETE' }); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Modal title={riesgo ? `Riesgo ${riesgo.codigo}` : 'Nuevo riesgo'} onClose={onClose}>
      <Field label="Activo afectado">
        <select value={f.activoId} onChange={(e) => set('activoId', e.target.value)}>
          <option value="">— seleccione —</option>
          {activos.map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.nombre}</option>)}
        </select>
      </Field>
      <Field label="Nombre del riesgo"><input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} /></Field>
      <Field label="Amenaza"><input value={f.amenaza} onChange={(e) => set('amenaza', e.target.value)} /></Field>
      <Field label="Vulnerabilidad"><input value={f.vulnerabilidad} onChange={(e) => set('vulnerabilidad', e.target.value)} /></Field>
      <div className="cid-grid">
        <Field label="Probabilidad (1–5)"><input type="number" min={1} max={5} value={f.probabilidad} onChange={(e) => set('probabilidad', +e.target.value)} /></Field>
        <Field label="Impacto (1–5)"><input type="number" min={1} max={5} value={f.impacto} onChange={(e) => set('impacto', +e.target.value)} /></Field>
        <Field label="Nivel inherente"><input disabled value={f.probabilidad * f.impacto} /></Field>
      </div>
      <Field label="Opción de tratamiento">
        <select value={f.opcionTratamiento} onChange={(e) => set('opcionTratamiento', e.target.value)}>
          {OPCIONES.map((o) => <option key={o} value={o}>{hum(o)}</option>)}
        </select>
      </Field>
      <Field label="Estado">
        <select value={f.estado} onChange={(e) => set('estado', e.target.value)}>
          {ESTADOS_RIESGO.map((s) => <option key={s} value={s}>{hum(s)}</option>)}
        </select>
      </Field>
      <div className="cid-grid">
        <Field label="Prob. residual (opcional)"><input type="number" min={0} max={5} value={f.probabilidadResidual} onChange={(e) => set('probabilidadResidual', +e.target.value)} /></Field>
        <Field label="Impacto residual (opcional)"><input type="number" min={0} max={5} value={f.impactoResidual} onChange={(e) => set('impactoResidual', +e.target.value)} /></Field>
        <Field label="Nivel residual"><input disabled value={f.probabilidadResidual && f.impactoResidual ? f.probabilidadResidual * f.impactoResidual : '—'} /></Field>
      </div>
      <Field label="Controles del Anexo A que tratan el riesgo" hint={`${sel.length} seleccionado(s)`}>
        <div className="ctrl-picker">
          {[...controles].sort((a, b) => cmpControl(a.codigo, b.codigo)).map((c) => (
            <label key={c.codigo} className="radio-inline">
              <input
                type="checkbox"
                checked={sel.includes(c.codigo)}
                onChange={(e) => setSel((s) => e.target.checked ? [...s, c.codigo] : s.filter((x) => x !== c.codigo))}
              />
              <span className="mono">{c.codigo}</span> {c.titulo}
            </label>
          ))}
        </div>
      </Field>
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="modal-acciones">
        {riesgo && <Boton variante="danger" onClick={eliminar}>Eliminar</Boton>}
        <Boton variante="ghost" onClick={onClose}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={env}>{env ? '…' : 'Guardar'}</Boton>
      </div>
    </Modal>
  );
}

// ─────────────────────────── Controles / SoA ───────────────────────────
function ControlesPanel() {
  const { esDev } = useAuth();
  const { data, error, recargar } = useAsync<ControlSoa[]>(() => api('/sgsi/controles'), []);
  const [filtro, setFiltro] = useState('');
  const [edita, setEdita] = useState<ControlSoa | null>(null);

  const grupos = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const fil = (data ?? []).filter((c) => !q || c.codigo.includes(q) || c.titulo.toLowerCase().includes(q));
    return Object.entries(TEMAS).map(([k, label]) => ({
      label,
      items: fil.filter((c) => c.tema === k).sort((a, b) => cmpControl(a.codigo, b.codigo)),
    }));
  }, [data, filtro]);

  return (
    <Card actions={<input placeholder="Filtrar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ maxWidth: 180 }} />}>
      {error && <ErrorMsg>{error}</ErrorMsg>}
      {grupos.map((g) => !!g.items.length && (
        <div key={g.label} style={{ marginBottom: 16 }}>
          <h3>{g.label}</h3>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Control</th><th>Aplica</th><th>Estado</th><th>Riesgos</th></tr></thead>
              <tbody>
                {g.items.map((c) => (
                  <tr key={c.codigo} className={esDev ? 'g-clic' : ''} onClick={esDev ? () => setEdita(c) : undefined}>
                    <td><span className="mono">{c.codigo}</span> {c.titulo}</td>
                    <td>{c.soa.aplica ? 'Sí' : <span className="pill muted">No aplica</span>}</td>
                    <td><span className={`pill ${c.soa.estado === 'IMPLEMENTADO' ? 'acc' : 'muted'}`}>{hum(c.soa.estado)}</span></td>
                    <td className="num">{c.riesgosAsociados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {edita && <SoaModal control={edita} onClose={() => setEdita(null)} onDone={() => { setEdita(null); recargar(); }} />}
    </Card>
  );
}

function SoaModal({ control, onClose, onDone }: { control: ControlSoa; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    aplica: control.soa.aplica, estado: control.soa.estado,
    justificacion: control.soa.justificacion ?? '', observaciones: control.soa.observaciones ?? '',
    fechaImplementacion: control.soa.fechaImplementacion?.slice(0, 10) ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [env, setEnv] = useState(false);
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  const guardar = async () => {
    setEnv(true); setError(null);
    try {
      await api(`/sgsi/controles/${encodeURIComponent(control.codigo)}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...f, fechaImplementacion: f.fechaImplementacion || undefined }),
      });
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setEnv(false); }
  };

  return (
    <Modal title={`${control.codigo} · ${control.titulo}`} onClose={onClose}>
      <label className="radio-inline">
        <input type="checkbox" checked={f.aplica} onChange={(e) => { set('aplica', e.target.checked); if (!e.target.checked) set('estado', 'NO_APLICA'); }} />
        El control aplica al alcance del SGSI
      </label>
      <Field label="Estado">
        <select value={f.estado} onChange={(e) => set('estado', e.target.value)}>
          {ESTADOS_CONTROL.map((s) => <option key={s} value={s}>{hum(s)}</option>)}
        </select>
      </Field>
      <Field label={f.aplica ? 'Justificación de aplicabilidad / implementación' : 'Justificación de la exclusión'}>
        <textarea rows={3} value={f.justificacion} onChange={(e) => set('justificacion', e.target.value)} />
      </Field>
      <Field label="Observaciones / evidencia"><textarea rows={2} value={f.observaciones} onChange={(e) => set('observaciones', e.target.value)} /></Field>
      <Field label="Fecha de implementación"><input type="date" value={f.fechaImplementacion} onChange={(e) => set('fechaImplementacion', e.target.value)} /></Field>
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="modal-acciones">
        <Boton variante="ghost" onClick={onClose}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={env}>{env ? '…' : 'Guardar'}</Boton>
      </div>
    </Modal>
  );
}

// ─────────────────────────── Planes ───────────────────────────
function PlanesPanel() {
  const { data, error, recargar } = useAsync<Plan[]>(() => api('/sgsi/planes'), []);
  const riesgos = useAsync<Riesgo[]>(() => api('/sgsi/riesgos'), []);
  const [edita, setEdita] = useState<Plan | null | 'nuevo'>(null);

  return (
    <Card actions={<Boton variante="ghost" onClick={() => setEdita('nuevo')}>+ Nuevo plan</Boton>}>
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="tablewrap">
        <table>
          <thead><tr><th>Riesgo</th><th>Acción</th><th>Responsable</th><th>Objetivo</th><th>Avance</th><th>Estado</th></tr></thead>
          <tbody>
            {(data ?? []).map((p) => (
              <tr key={p.id} className="g-clic" onClick={() => setEdita(p)}>
                <td className="mono">{p.riesgo.codigo}</td>
                <td className="celda-sm">{p.descripcion}</td>
                <td>{p.responsable ?? '—'}</td>
                <td>{p.fechaObjetivo ? <span className={p.vencido ? 'pill crit' : ''}>{fechaCorta(p.fechaObjetivo)}</span> : '—'}</td>
                <td><span className="barra-avance"><span style={{ width: `${p.avance}%` }} /></span> {p.avance}%</td>
                <td><span className="pill muted">{hum(p.estado)}</span></td>
              </tr>
            ))}
            {data && !data.length && <tr><td colSpan={6} className="vacio">Sin planes de tratamiento.</td></tr>}
          </tbody>
        </table>
      </div>
      {edita && (
        <PlanModal plan={edita === 'nuevo' ? null : edita} riesgos={riesgos.data ?? []} onClose={() => setEdita(null)} onDone={() => { setEdita(null); recargar(); }} />
      )}
    </Card>
  );
}

function PlanModal({ plan, riesgos, onClose, onDone }: { plan: Plan | null; riesgos: Riesgo[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    riesgoId: plan?.riesgoId ?? '', descripcion: plan?.descripcion ?? '', accion: plan?.accion ?? '',
    fechaObjetivo: plan?.fechaObjetivo?.slice(0, 10) ?? '', estado: plan?.estado ?? 'ABIERTO', avance: plan?.avance ?? 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [env, setEnv] = useState(false);
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  const guardar = async () => {
    setError(null);
    if (!plan && !f.riesgoId) return setError('Seleccione el riesgo.');
    if (f.descripcion.trim().length < 4) return setError('Describa la acción de tratamiento.');
    setEnv(true);
    try {
      const body = { ...f, descripcion: f.descripcion.trim(), fechaObjetivo: f.fechaObjetivo || undefined };
      if (plan) await api(`/sgsi/planes/${plan.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/sgsi/planes', { method: 'POST', body: JSON.stringify(body) });
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setEnv(false); }
  };
  const eliminar = async () => {
    if (!plan || !confirm('¿Eliminar el plan?')) return;
    try { await api(`/sgsi/planes/${plan.id}`, { method: 'DELETE' }); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Modal title={plan ? 'Plan de tratamiento' : 'Nuevo plan de tratamiento'} onClose={onClose}>
      {!plan && (
        <Field label="Riesgo">
          <select value={f.riesgoId} onChange={(e) => set('riesgoId', e.target.value)}>
            <option value="">— seleccione —</option>
            {riesgos.map((r) => <option key={r.id} value={r.id}>{r.codigo} · {r.nombre}</option>)}
          </select>
        </Field>
      )}
      <Field label="Acción de tratamiento"><textarea rows={2} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} /></Field>
      <Field label="Detalle / responsable operativo"><input value={f.accion} onChange={(e) => set('accion', e.target.value)} /></Field>
      <Field label="Fecha objetivo"><input type="date" value={f.fechaObjetivo} onChange={(e) => set('fechaObjetivo', e.target.value)} /></Field>
      <div className="cid-grid">
        <Field label="Avance (%)"><input type="number" min={0} max={100} value={f.avance} onChange={(e) => set('avance', +e.target.value)} /></Field>
        <Field label="Estado">
          <select value={f.estado} onChange={(e) => set('estado', e.target.value)}>
            {ESTADOS_PLAN.map((s) => <option key={s} value={s}>{hum(s)}</option>)}
          </select>
        </Field>
      </div>
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="modal-acciones">
        {plan && <Boton variante="danger" onClick={eliminar}>Eliminar</Boton>}
        <Boton variante="ghost" onClick={onClose}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={env}>{env ? '…' : 'Guardar'}</Boton>
      </div>
    </Modal>
  );
}

// ─────────────────────────── Marco ───────────────────────────
function MarcoPanel() {
  const { esDev } = useAuth();
  const { data, error, recargar } = useAsync<Marco>(() => api('/sgsi/marco'), []);
  const [editar, setEditar] = useState(false);
  if (error) return <ErrorMsg>{error}</ErrorMsg>;
  if (!data) return <p className="vacio">Cargando…</p>;

  if (editar) return <MarcoForm marco={data} onClose={() => setEditar(false)} onDone={() => { setEditar(false); recargar(); }} />;

  return (
    <Card actions={esDev ? <Boton variante="ghost" onClick={() => setEditar(true)}>Editar</Boton> : undefined}>
      <div className="doc">
        <p className="vacio" style={{ textAlign: 'left', padding: 0 }}>Versión {data.version}{data.fechaAprobacion ? ` · aprobado ${fechaCorta(data.fechaAprobacion)}` : ' · sin aprobar'}</p>
        <h3>Política de seguridad de la información</h3><p>{data.politica}</p>
        <h3>Alcance del SGSI</h3><p>{data.alcance}</p>
        <h3>Objetivos</h3><ul>{data.objetivos.map((o, i) => <li key={i}>{o}</li>)}</ul>
        <h3>Metodología de valoración de riesgos</h3><p>{data.metodologia}</p>
        <h3>Roles y responsabilidades</h3>
        <ul>{data.roles.map((r, i) => <li key={i}><strong>{r.rol}:</strong> {r.responsabilidad}</li>)}</ul>
        <h3>Revisión</h3><p>{data.periodicidadRevision}</p>
        <h3>Referencias normativas</h3><ul>{data.referencias.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </div>
    </Card>
  );
}

function MarcoForm({ marco, onClose, onDone }: { marco: Marco; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    version: marco.version, fechaAprobacion: marco.fechaAprobacion?.slice(0, 10) ?? '',
    politica: marco.politica, alcance: marco.alcance, metodologia: marco.metodologia,
    periodicidadRevision: marco.periodicidadRevision,
    objetivos: marco.objetivos.join('\n'),
  });
  const [error, setError] = useState<string | null>(null);
  const [env, setEnv] = useState(false);
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  const guardar = async () => {
    setEnv(true); setError(null);
    try {
      await api('/sgsi/marco', {
        method: 'PUT',
        body: JSON.stringify({
          version: f.version, fechaAprobacion: f.fechaAprobacion || undefined,
          politica: f.politica, alcance: f.alcance, metodologia: f.metodologia,
          periodicidadRevision: f.periodicidadRevision,
          objetivos: f.objetivos.split('\n').map((s) => s.trim()).filter(Boolean),
        }),
      });
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setEnv(false); }
  };

  return (
    <Card>
      <h3>Editar marco de gestión</h3>
      <div className="cid-grid">
        <Field label="Versión"><input value={f.version} onChange={(e) => set('version', e.target.value)} /></Field>
        <Field label="Fecha de aprobación"><input type="date" value={f.fechaAprobacion} onChange={(e) => set('fechaAprobacion', e.target.value)} /></Field>
      </div>
      <Field label="Política"><textarea rows={4} value={f.politica} onChange={(e) => set('politica', e.target.value)} /></Field>
      <Field label="Alcance"><textarea rows={3} value={f.alcance} onChange={(e) => set('alcance', e.target.value)} /></Field>
      <Field label="Objetivos (uno por línea)"><textarea rows={4} value={f.objetivos} onChange={(e) => set('objetivos', e.target.value)} /></Field>
      <Field label="Metodología"><textarea rows={3} value={f.metodologia} onChange={(e) => set('metodologia', e.target.value)} /></Field>
      <Field label="Periodicidad de revisión"><input value={f.periodicidadRevision} onChange={(e) => set('periodicidadRevision', e.target.value)} /></Field>
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="modal-acciones">
        <Boton variante="ghost" onClick={onClose}>Cancelar</Boton>
        <Boton onClick={guardar} disabled={env}>{env ? '…' : 'Guardar'}</Boton>
      </div>
    </Card>
  );
}
