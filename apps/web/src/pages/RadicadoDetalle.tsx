import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, blobUrl, download } from '../api';
import { useAuth } from '../auth';
import { Alerta, Boton, Card, EstadoPill, ErrorMsg, Modal, fechaCorta, fechaHora, useAsync } from '../ui';

const NOMBRE_FIRMA = 'firma-recepcion.png';

interface Evento {
  secuencia: number;
  tipoEvento: string;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  fechaHora: string;
  ip: string | null;
  observacion: string | null;
  actor?: { nombre: string } | null;
}
interface Anexo {
  id: string;
  nombre: string;
  descripcion: string | null;
  tamanoBytes: number | null;
  checksumSha256: string | null;
}
interface Radicado {
  id: string;
  numero: string;
  tipo: string;
  estado: string;
  canal: string;
  asunto: string;
  tipoComunicacion: string;
  origen: string;
  nivelAlerta: string;
  diasHabilesRestantes: number | null;
  fechaHoraRadicacion: string;
  fechaRecepcion: string | null;
  entregadoPor: string | null;
  fechaVencimiento: string | null;
  destinatario: string | null;
  medioRespuesta: string | null;
  dependenciaId: string | null;
  tercero?: { nombre: string; numeroDocumento: string; email: string | null } | null;
  dependencia?: { codigo: string; nombre: string } | null;
  funcionario?: { nombre: string } | null;
  serie?: { codigo: string; nombre: string } | null;
  expediente?: { numero: string; titulo: string } | null;
  anexos: Anexo[];
  eventos: Evento[];
  anulacion?: { motivo: string; justificacion: string; fecha: string; usuario?: { nombre: string } } | null;
}

type AccionId =
  | 'asignar'
  | 'aceptar'
  | 'trasladar'
  | 'reasignar'
  | 'cerrar'
  | 'reabrir'
  | 'anular'
  | 'clasificar';

export default function RadicadoDetalle() {
  const { numero } = useParams();
  const { tieneRol } = useAuth();
  const { data, error, cargando, recargar } = useAsync<Radicado>(
    () => api(`/radicados/${numero}`),
    [numero],
  );
  const [accion, setAccion] = useState<AccionId | null>(null);

  if (cargando) return <div className="page"><p className="vacio">Cargando…</p></div>;
  if (error) return <div className="page"><ErrorMsg>{error}</ErrorMsg></div>;
  if (!data) return null;

  const r = data;
  const firma = r.anexos.find((a) => a.nombre === NOMBRE_FIRMA);
  const acciones: { id: AccionId; label: string; ok: boolean }[] = [
    { id: 'asignar', label: 'Asignar', ok: tieneRol('JEFE', 'VENTANILLA', 'RADICADOR') && ['RADICADO', 'CLASIFICADO', 'REABIERTO'].includes(r.estado) },
    { id: 'clasificar', label: 'Clasificar', ok: tieneRol('ARCHIVISTA', 'VENTANILLA') && !r.expediente && r.estado !== 'ANULADO' },
    { id: 'aceptar', label: 'Aceptar trámite', ok: tieneRol('FUNCIONARIO', 'JEFE') && r.estado === 'ASIGNADO' },
    { id: 'trasladar', label: 'Trasladar', ok: tieneRol('FUNCIONARIO', 'JEFE') && ['ASIGNADO', 'EN_TRAMITE'].includes(r.estado) },
    { id: 'reasignar', label: 'Reasignar', ok: tieneRol('JEFE') && ['ASIGNADO', 'EN_TRAMITE'].includes(r.estado) },
    { id: 'cerrar', label: 'Cerrar', ok: tieneRol('FUNCIONARIO', 'JEFE') && (r.estado === 'RESPONDIDO' || r.estado === 'EN_TRAMITE') },
    { id: 'reabrir', label: 'Reabrir', ok: tieneRol('JEFE') && r.estado === 'CERRADO' },
    { id: 'anular', label: 'Anular', ok: tieneRol('RADICADOR') && r.estado !== 'ANULADO' },
  ];

  return (
    <div className="page">
      <div className="detalle-h">
        <div>
          <h1 className="rad-title">{r.numero}</h1>
          <div className="chips">
            <EstadoPill estado={r.estado} />
            <Alerta nivel={r.nivelAlerta} />
            {r.origen !== 'SISTEMA' && <span className="pill muted">{r.origen}</span>}
            <span className="pill muted">{r.tipoComunicacion.replace(/_/g, ' ')}</span>
          </div>
        </div>
        <div className="chips">
          {acciones.filter((a) => a.ok).map((a) => (
            <Boton key={a.id} variante={a.id === 'anular' ? 'danger' : 'ghost'} onClick={() => setAccion(a.id)}>
              {a.label}
            </Boton>
          ))}
        </div>
      </div>

      <div className="cols">
        <Card title="Datos">
          <dl className="kv">
            <dt>Asunto</dt><dd>{r.asunto}</dd>
            <dt>Radicación</dt><dd>{fechaHora(r.fechaHoraRadicacion)} · {r.canal}</dd>
            {r.fechaRecepcion && <><dt>Llegada del documento</dt><dd>{fechaHora(r.fechaRecepcion)}</dd></>}
            {r.entregadoPor && <><dt>Entregado por</dt><dd>{r.entregadoPor}</dd></>}
            <dt>Vence</dt><dd>{fechaCorta(r.fechaVencimiento)} {r.diasHabilesRestantes != null && `(${r.diasHabilesRestantes} días háb.)`}</dd>
            <dt>{r.tipo === 'SAL' ? 'Destinatario' : 'Remitente'}</dt>
            <dd>{r.tercero ? `${r.tercero.nombre} · ${r.tercero.numeroDocumento}` : r.destinatario ?? '—'}</dd>
            <dt>Dependencia</dt><dd>{r.dependencia ? `${r.dependencia.codigo} · ${r.dependencia.nombre}` : '—'}</dd>
            <dt>Responsable</dt><dd>{r.funcionario?.nombre ?? '—'}</dd>
            <dt>Serie</dt><dd>{r.serie ? `${r.serie.codigo} · ${r.serie.nombre}` : 'sin clasificar'}</dd>
            <dt>Expediente</dt><dd>{r.expediente ? `${r.expediente.numero} · ${r.expediente.titulo}` : '—'}</dd>
          </dl>
          {r.anulacion && (
            <div className="error" style={{ marginTop: 12 }}>
              <strong>Anulado</strong> — {r.anulacion.motivo}. {r.anulacion.justificacion}
              <br />
              <small>{fechaHora(r.anulacion.fecha)} · {r.anulacion.usuario?.nombre}</small>
            </div>
          )}
        </Card>

        <Card title={`Anexos (${r.anexos.length})`}>
          {r.anexos.length === 0 && <p className="vacio">Sin anexos.</p>}
          <ul className="anexos">
            {r.anexos.map((a) => (
              <li key={a.id}>
                <button
                  className="link"
                  onClick={() => download(`/radicados/${r.numero}/adjuntos/${a.id}/descarga`, a.nombre)}
                >
                  {a.nombre}
                </button>
                <em>{a.tamanoBytes ? `${(a.tamanoBytes / 1024).toFixed(1)} KB` : ''}</em>
              </li>
            ))}
          </ul>
        </Card>

        {firma && (
          <Card title="Firma de quien entrega el documento">
            <FirmaPreview numero={r.numero} anexoId={firma.id} />
          </Card>
        )}
      </div>

      <Card title="Trazabilidad">
        <ol className="traza">
          {r.eventos.map((e) => (
            <li key={e.secuencia}>
              <div className="traza-fecha">{fechaHora(e.fechaHora)}</div>
              <div className="traza-cuerpo">
                <strong>{e.tipoEvento.replace(/_/g, ' ')}</strong>
                {e.estadoNuevo && e.estadoAnterior !== e.estadoNuevo && (
                  <span className="traza-estado">
                    {e.estadoAnterior ?? '—'} → {e.estadoNuevo}
                  </span>
                )}
                {e.observacion && <p>{e.observacion}</p>}
                <small>{e.actor?.nombre ?? 'sistema'} {e.ip && `· ${e.ip}`}</small>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {accion && (
        <AccionModal
          accion={accion}
          numero={r.numero}
          dependenciaActualId={r.dependenciaId ?? undefined}
          onClose={() => setAccion(null)}
          onDone={() => {
            setAccion(null);
            recargar();
          }}
        />
      )}
    </div>
  );
}

function AccionModal({
  accion,
  numero,
  dependenciaActualId,
  onClose,
  onDone,
}: {
  accion: AccionId;
  numero: string;
  dependenciaActualId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const deps = useAsync<{ id: string; codigo: string; nombre: string; hijos: never[] }[]>(
    () => (['asignar', 'trasladar'].includes(accion) ? api('/dependencias') : Promise.resolve([])),
    [],
  );
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k: string, v: string) => setCampos((c) => ({ ...c, [k]: v }));

  const flat = (nodos: { id: string; codigo: string; nombre: string; hijos: never[] }[]): { id: string; label: string }[] =>
    nodos.flatMap((n) => [{ id: n.id, label: `${n.codigo} · ${n.nombre}` }, ...flat(n.hijos)]);

  const cfg: Record<AccionId, { titulo: string; path: string; campos: string[] }> = {
    asignar: { titulo: 'Asignar radicado', path: `/radicados/${numero}/asignar`, campos: ['dependenciaId', 'funcionarioId', 'observacion'] },
    clasificar: { titulo: 'Clasificar', path: `/radicados/${numero}/clasificar`, campos: ['serieId', 'nuevoExpedienteTitulo'] },
    aceptar: { titulo: 'Aceptar trámite', path: `/radicados/${numero}/aceptar`, campos: [] },
    trasladar: { titulo: 'Trasladar', path: `/radicados/${numero}/trasladar`, campos: ['dependenciaId', 'funcionarioId', 'motivo'] },
    reasignar: { titulo: 'Reasignar', path: `/radicados/${numero}/reasignar`, campos: ['funcionarioId', 'motivo'] },
    cerrar: { titulo: 'Cerrar', path: `/radicados/${numero}/cerrar`, campos: ['observacion'] },
    reabrir: { titulo: 'Reabrir', path: `/radicados/${numero}/reabrir`, campos: ['motivo'] },
    anular: { titulo: 'Anular radicado', path: `/radicados/${numero}/anulacion`, campos: ['motivo', 'justificacion'] },
  };
  const c = cfg[accion];

  const series = useAsync<{ id: string; codigo: string; nombre: string }[]>(
    () => (accion === 'clasificar' ? api('/series') : Promise.resolve([])),
    [],
  );

  // dependencia cuyo personal debe listarse en el selector de funcionario:
  // la elegida en el propio formulario (asignar/trasladar) o, si no aplica, la dependencia actual del radicado (reasignar)
  const dependenciaParaPersonal = c.campos.includes('dependenciaId') ? campos.dependenciaId : dependenciaActualId;
  const personal = useAsync<{ id: string; nombre: string; email: string }[]>(
    () =>
      c.campos.includes('funcionarioId') && dependenciaParaPersonal
        ? api(`/usuarios?dependenciaId=${dependenciaParaPersonal}&activo=true`)
        : Promise.resolve([]),
    [dependenciaParaPersonal],
  );

  const submit = async () => {
    setEnviando(true);
    setError(null);
    try {
      const body: Record<string, string> = { ...campos };
      if (!body.funcionarioId) delete body.funcionarioId;
      await api(c.path, { method: 'POST', body: JSON.stringify(body) });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  const ETIQUETAS: Record<string, string> = {
    dependenciaId: 'Dependencia',
    funcionarioId: 'Funcionario',
    observacion: 'Observación',
    motivo: 'Motivo',
    justificacion: 'Justificación',
    serieId: 'Serie documental',
    nuevoExpedienteTitulo: 'Título del expediente nuevo',
  };

  return (
    <Modal title={c.titulo} onClose={onClose}>
      {c.campos.length === 0 && <p>¿Confirmar la acción sobre {numero}?</p>}
      {c.campos.map((k) => (
        <label key={k} className="field">
          <span>{ETIQUETAS[k] ?? k}</span>
          {k === 'dependenciaId' ? (
            <select value={campos[k] ?? ''} onChange={(e) => { set(k, e.target.value); set('funcionarioId', ''); }}>
              <option value="">— seleccione —</option>
              {(deps.data ? flat(deps.data) : []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          ) : k === 'funcionarioId' ? (
            <select value={campos[k] ?? ''} onChange={(e) => set(k, e.target.value)} disabled={!dependenciaParaPersonal}>
              <option value="">
                {dependenciaParaPersonal ? '— sin asignar a una persona —' : 'elija primero la dependencia'}
              </option>
              {(personal.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          ) : k === 'serieId' ? (
            <select value={campos[k] ?? ''} onChange={(e) => set(k, e.target.value)}>
              <option value="">— seleccione —</option>
              {(series.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.codigo} · {s.nombre}
                </option>
              ))}
            </select>
          ) : k === 'justificacion' || k === 'motivo' || k === 'observacion' ? (
            <textarea value={campos[k] ?? ''} onChange={(e) => set(k, e.target.value)} rows={3} />
          ) : (
            <input value={campos[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
          )}
        </label>
      ))}
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="modal-acciones">
        <Boton variante="ghost" onClick={onClose}>
          Cancelar
        </Boton>
        <Boton variante={accion === 'anular' ? 'danger' : 'primary'} onClick={submit} disabled={enviando}>
          {enviando ? '…' : 'Confirmar'}
        </Boton>
      </div>
    </Modal>
  );
}

function FirmaPreview({ numero, anexoId }: { numero: string; anexoId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelado = false;
    blobUrl(`/radicados/${numero}/adjuntos/${anexoId}/descarga`)
      .then((u) => {
        if (cancelado) return URL.revokeObjectURL(u);
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => setError(true));
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [numero, anexoId]);

  if (error) return <p className="vacio">No se pudo cargar la firma.</p>;
  if (!url) return <p className="vacio">Cargando…</p>;
  return <img src={url} alt="Firma de recepción" className="firma-preview" />;
}
