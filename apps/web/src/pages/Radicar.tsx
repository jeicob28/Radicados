import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Boton, Card, ErrorMsg, Field, useAsync } from '../ui';

const CANALES = ['PRESENCIAL', 'CORREO', 'WEB', 'FORMULARIO', 'TELEFONO', 'FISICO'];
const TIPOS_COM = [
  'GENERAL',
  'DERECHO_PETICION',
  'PETICION_INFORMACION',
  'PETICION_DOCUMENTOS',
  'CONSULTA',
  'QUEJA',
  'RECLAMO',
  'SOLICITUD',
  'FELICITACION',
  'SUGERENCIA',
  'OTRO',
];

interface DepNodo {
  id: string;
  codigo: string;
  nombre: string;
  hijos: DepNodo[];
}
interface Tercero {
  id: string;
  nombre: string;
  numeroDocumento: string;
}

function flatten(nodos: DepNodo[], nivel = 0): { id: string; label: string }[] {
  return nodos.flatMap((n) => [
    { id: n.id, label: `${'— '.repeat(nivel)}${n.codigo} · ${n.nombre}` },
    ...flatten(n.hijos, nivel + 1),
  ]);
}

export default function Radicar() {
  const nav = useNavigate();
  const deps = useAsync(() => api<DepNodo[]>('/dependencias'), []);
  const [form, setForm] = useState({
    tipo: 'ENT',
    canal: 'WEB',
    asunto: '',
    tipoComunicacion: 'GENERAL',
    dependenciaId: '',
    terceroId: '',
    destinatario: '',
    folios: 0,
    enRespuestaA: '',
  });
  const [archivos, setArchivos] = useState<FileList | null>(null);
  const [terceros, setTerceros] = useState<Tercero[]>([]);
  const [buscando, setBuscando] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const buscarTercero = async (q: string) => {
    setBuscando(q);
    if (q.length < 2) return setTerceros([]);
    setTerceros(await api<Tercero[]>(`/terceros?q=${encodeURIComponent(q)}`));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      let adjuntos: unknown[] = [];
      if (archivos && archivos.length) {
        const fd = new FormData();
        Array.from(archivos).forEach((a) => fd.append('files', a));
        const res = await api<{ adjuntos: unknown[] }>('/radicados/adjuntos', { method: 'POST', body: fd });
        adjuntos = res.adjuntos;
      }
      const payload: Record<string, unknown> = {
        tipo: form.tipo,
        canal: form.canal,
        asunto: form.asunto,
        tipoComunicacion: form.tipoComunicacion,
        folios: Number(form.folios) || 0,
        adjuntos,
      };
      if (form.dependenciaId) payload.dependenciaId = form.dependenciaId;
      if (form.terceroId) payload.terceroId = form.terceroId;
      if (form.destinatario) payload.destinatario = form.destinatario;
      if (form.tipo === 'SAL' && form.enRespuestaA) payload.enRespuestaA = form.enRespuestaA;

      const r = await api<{ numero: string }>('/radicados', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      nav(`/radicados/${r.numero}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEnviando(false);
    }
  };

  const opcionesDep = deps.data ? flatten(deps.data) : [];

  return (
    <div className="page narrow">
      <h1>Radicar comunicación</h1>
      <Card>
        <form onSubmit={submit} className="form-grid">
          <Field label="Tipo">
            <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}>
              <option value="ENT">Entrada</option>
              <option value="SAL">Salida</option>
              <option value="UNICO">Único institucional</option>
            </select>
          </Field>
          <Field label="Canal">
            <select value={form.canal} onChange={(e) => set('canal', e.target.value)}>
              {CANALES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field label="Asunto">
            <input value={form.asunto} onChange={(e) => set('asunto', e.target.value)} required minLength={4} />
          </Field>

          <Field label="Tipo de comunicación">
            <select
              value={form.tipoComunicacion}
              onChange={(e) => set('tipoComunicacion', e.target.value)}
            >
              {TIPOS_COM.map((t) => (
                <option key={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </Field>
          <Field label="Folios">
            <input
              type="number"
              min={0}
              value={form.folios}
              onChange={(e) => set('folios', e.target.value)}
            />
          </Field>

          <Field
            label={form.tipo === 'SAL' ? 'Destinatario (tercero)' : 'Remitente (tercero)'}
            hint="Busque por nombre o documento"
          >
            <input value={buscando} onChange={(e) => buscarTercero(e.target.value)} placeholder="Buscar…" />
            {terceros.length > 0 && (
              <div className="sugerencias">
                {terceros.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={form.terceroId === t.id ? 'sel' : ''}
                    onClick={() => {
                      set('terceroId', t.id);
                      setBuscando(`${t.nombre} (${t.numeroDocumento})`);
                      setTerceros([]);
                    }}
                  >
                    {t.nombre} · {t.numeroDocumento}
                  </button>
                ))}
              </div>
            )}
          </Field>

          <Field label="Dependencia destino">
            <select value={form.dependenciaId} onChange={(e) => set('dependenciaId', e.target.value)}>
              <option value="">— sin asignar —</option>
              {opcionesDep.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>

          {form.tipo === 'SAL' && (
            <Field label="En respuesta al radicado" hint="Número del radicado de entrada">
              <input value={form.enRespuestaA} onChange={(e) => set('enRespuestaA', e.target.value)} />
            </Field>
          )}

          <Field label="Anexos">
            <input type="file" multiple onChange={(e) => setArchivos(e.target.files)} />
          </Field>

          {error && (
            <div className="col-full">
              <ErrorMsg>{error}</ErrorMsg>
            </div>
          )}
          <div className="col-full">
            <Boton tipo="submit" disabled={enviando}>
              {enviando ? 'Radicando…' : 'Radicar'}
            </Boton>
          </div>
        </form>
      </Card>
    </div>
  );
}
