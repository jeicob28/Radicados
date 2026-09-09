import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, blobUrl, download } from '../api';
import { useAuth } from '../auth';
import { Alerta, Boton, Card, EstadoPill, ErrorMsg, Field, Modal, fechaCorta, fechaHora, useAsync } from '../ui';
import {
  SelectorSerieSubserie,
  codigoClasificacion,
  useCuadroClasificacion,
  validarClasificacion,
} from '../components/Clasificacion';

const NOMBRE_FIRMA = 'firma-recepcion.png';

const MEDIOS_RESPUESTA: [string, string][] = [
  ['CORREO_ELECTRONICO', 'Correo electrónico'],
  ['FISICO', 'Físico / impreso'],
  ['TELEFONICO', 'Telefónico'],
  ['PRESENCIAL', 'Presencial'],
  ['PORTAL_WEB', 'Portal web'],
  ['OTRO', 'Otro'],
];

interface AdjuntoRef {
  objectKey: string;
  nombre: string;
  contentType?: string;
  tamanoBytes?: number;
  checksumSha256?: string;
}

/** Sube los archivos como evidencias de trámite y devuelve sus descriptores. */
async function subirEvidencias(files: File[]): Promise<AdjuntoRef[]> {
  if (!files.length) return [];
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  const res = await api<{ adjuntos: AdjuntoRef[] }>('/radicados/adjuntos-tramite', {
    method: 'POST',
    body: fd,
  });
  return res.adjuntos;
}

/** Selector de archivos con lista y opción de quitar, para evidencias. */
function CampoEvidencias({
  files,
  setFiles,
  label = 'Evidencias',
  hint,
}: {
  files: File[];
  setFiles: (f: File[]) => void;
  label?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {hint && <em>{hint}</em>}
      <input
        type="file"
        multiple
        onChange={(e) => {
          setFiles([...files, ...Array.from(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
      {files.length > 0 && (
        <ul className="anexos">
          {files.map((f, i) => (
            <li key={i}>
              <span>{f.name}</span>
              <button type="button" className="link" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}

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
  funcionario?: { id: string; nombre: string } | null;
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
  | 'responder'
  | 'devolver'
  | 'comunicado'
  | 'reabrir'
  | 'anular'
  | 'clasificar';

export default function RadicadoDetalle() {
  const { numero } = useParams();
  const { tieneRol, usuario } = useAuth();
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

  // Tramitar (aceptar / responder / trasladar / devolver): todos los roles
  // salvo AUDITOR, sobre los radicados asignados a la persona o a su
  // dependencia. Ver Requerimientos §21.2. El backend lo verifica también.
  const roles = usuario?.roles ?? [];
  const esAuditorPuro = roles.includes('AUDITOR') && !roles.includes('ADMIN');
  const puedoTramitar =
    !esAuditorPuro &&
    (roles.includes('ADMIN') ||
      (!!r.funcionario?.id && r.funcionario.id === usuario?.id) ||
      (!!usuario?.dependenciaId && usuario.dependenciaId === r.dependenciaId));

  const acciones: { id: AccionId; label: string; ok: boolean }[] = [
    { id: 'asignar', label: 'Asignar', ok: tieneRol('JEFE', 'VENTANILLA', 'RADICADOR') && ['RADICADO', 'CLASIFICADO', 'REABIERTO'].includes(r.estado) },
    { id: 'clasificar', label: 'Clasificar', ok: tieneRol('ARCHIVISTA', 'VENTANILLA') && !r.expediente && r.estado !== 'ANULADO' },
    { id: 'aceptar', label: 'Aceptar trámite', ok: puedoTramitar && r.estado === 'ASIGNADO' },
    { id: 'responder', label: 'Responder / cerrar', ok: puedoTramitar && ['EN_TRAMITE', 'RESPONDIDO'].includes(r.estado) },
    { id: 'trasladar', label: 'Trasladar', ok: puedoTramitar && ['ASIGNADO', 'EN_TRAMITE'].includes(r.estado) },
    { id: 'devolver', label: 'Devolver', ok: puedoTramitar && ['ASIGNADO', 'EN_TRAMITE'].includes(r.estado) },
    { id: 'reasignar', label: 'Reasignar', ok: tieneRol('JEFE') && ['ASIGNADO', 'EN_TRAMITE'].includes(r.estado) },
    { id: 'comunicado', label: 'Emitir comunicado oficial', ok: tieneRol('VENTANILLA') && r.estado === 'POR_COMUNICAR' },
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
            {r.medioRespuesta && (
              <>
                <dt>Forma de respuesta</dt>
                <dd>{MEDIOS_RESPUESTA.find(([v]) => v === r.medioRespuesta)?.[1] ?? r.medioRespuesta}</dd>
              </>
            )}
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

      {accion === 'responder' && (
        <ResponderModal
          numero={r.numero}
          onClose={() => setAccion(null)}
          onDone={() => { setAccion(null); recargar(); }}
        />
      )}
      {accion === 'comunicado' && (
        <ComunicadoModal
          numero={r.numero}
          onClose={() => setAccion(null)}
          onDone={() => { setAccion(null); recargar(); }}
        />
      )}
      {accion === 'clasificar' && (
        <ClasificarModal
          numero={r.numero}
          dependenciaId={r.dependenciaId ?? undefined}
          onClose={() => setAccion(null)}
          onDone={() => { setAccion(null); recargar(); }}
        />
      )}
      {accion && !['responder', 'comunicado', 'clasificar'].includes(accion) && (
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

function ResponderModal({
  numero,
  onClose,
  onDone,
}: {
  numero: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [variante, setVariante] = useState<'DIRECTA' | 'COMUNICADO_OFICIAL'>('DIRECTA');
  const [medio, setMedio] = useState('CORREO_ELECTRONICO');
  const [notas, setNotas] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const submit = async () => {
    if (notas.trim().length < 10) return setError('Escriba las notas del trámite (mínimo 10 caracteres).');
    if (!files.length) return setError('Adjunte al menos una evidencia de la respuesta.');
    setEnviando(true);
    setError(null);
    try {
      const adjuntos = await subirEvidencias(files);
      await api(`/radicados/${numero}/responder`, {
        method: 'POST',
        body: JSON.stringify({ variante, medioRespuesta: medio, notas: notas.trim(), adjuntos }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal title={`Responder radicado ${numero}`} onClose={onClose}>
      <label className="field">
        <span>¿Cómo se responde?</span>
        <div className="chips" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <label className={`rolchip ${variante === 'DIRECTA' ? 'sel' : ''}`}>
            <input
              type="radio"
              checked={variante === 'DIRECTA'}
              onChange={() => setVariante('DIRECTA')}
            />
            Respuesta directa al solicitante — cierra el radicado
          </label>
          <label className={`rolchip ${variante === 'COMUNICADO_OFICIAL' ? 'sel' : ''}`}>
            <input
              type="radio"
              checked={variante === 'COMUNICADO_OFICIAL'}
              onChange={() => setVariante('COMUNICADO_OFICIAL')}
            />
            Requiere comunicado oficial de Ventanilla Única
          </label>
        </div>
      </label>

      <label className="field">
        <span>Forma de responder</span>
        <select value={medio} onChange={(e) => setMedio(e.target.value)}>
          {MEDIOS_RESPUESTA.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Notas del trámite y de la respuesta</span>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={4} />
      </label>

      <CampoEvidencias
        files={files}
        setFiles={setFiles}
        label="Evidencias (obligatorio)"
        hint={
          variante === 'DIRECTA'
            ? 'Copia de lo enviado al solicitante, soportes del trámite, etc.'
            : 'Borrador de la respuesta y soportes para que Ventanilla Única elabore el comunicado.'
        }
      />

      {variante === 'COMUNICADO_OFICIAL' && (
        <p className="vacio" style={{ textAlign: 'left', padding: 0 }}>
          El radicado quedará <strong>POR COMUNICAR</strong> hasta que Ventanilla Única emita el comunicado oficial.
        </p>
      )}

      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="modal-acciones">
        <Boton variante="ghost" onClick={onClose}>
          Cancelar
        </Boton>
        <Boton onClick={submit} disabled={enviando}>
          {enviando ? 'Enviando…' : 'Responder'}
        </Boton>
      </div>
    </Modal>
  );
}

function ComunicadoModal({
  numero,
  onClose,
  onDone,
}: {
  numero: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [obs, setObs] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const submit = async () => {
    if (!files.length) return setError('Adjunte el comunicado oficial.');
    setEnviando(true);
    setError(null);
    try {
      const adjuntos = await subirEvidencias(files);
      await api(`/radicados/${numero}/comunicado-oficial`, {
        method: 'POST',
        body: JSON.stringify({ adjuntos, observacion: obs.trim() || undefined }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal title={`Comunicado oficial — radicado ${numero}`} onClose={onClose}>
      <CampoEvidencias files={files} setFiles={setFiles} label="Comunicado oficial (obligatorio)" />
      <label className="field">
        <span>Observación (opcional)</span>
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
      </label>
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="modal-acciones">
        <Boton variante="ghost" onClick={onClose}>
          Cancelar
        </Boton>
        <Boton onClick={submit} disabled={enviando}>
          {enviando ? 'Enviando…' : 'Emitir y cerrar'}
        </Boton>
      </div>
    </Modal>
  );
}

/**
 * Clasificación archivística del radicado según la norma (Acuerdo 001 de 2024):
 * serie → subserie (obligatoria si la serie tiene subseries) y destino en un
 * expediente nuevo o en uno abierto de la misma clasificación.
 */
function ClasificarModal({
  numero,
  dependenciaId,
  onClose,
  onDone,
}: {
  numero: string;
  dependenciaId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const cuadro = useCuadroClasificacion();
  const [serieId, setSerieId] = useState('');
  const [subserieId, setSubserieId] = useState('');
  const [destino, setDestino] = useState<'nuevo' | 'existente'>('nuevo');
  const [titulo, setTitulo] = useState('');
  const [expedienteNumero, setExpedienteNumero] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const serie = cuadro.data?.find((s) => s.id === serieId) ?? null;
  const subserie = serie?.subseries.find((ss) => ss.id === subserieId) ?? null;

  const abiertos = useAsync<{ numero: string; titulo: string; subserie: { codigo: string } | null }[]>(
    () => (serieId ? api(`/expedientes?estado=ABIERTO&serieId=${serieId}`) : Promise.resolve([])),
    [serieId],
  );
  const candidatos = (abiertos.data ?? []).filter(
    (e) => !subserieId || e.subserie?.codigo === subserie?.codigo,
  );

  const submit = async () => {
    setError(null);
    const problema = validarClasificacion(serie, subserie);
    if (problema) return setError(problema);
    const body: Record<string, unknown> = { serieId, subserieId: subserieId || undefined };
    if (destino === 'existente') {
      if (!expedienteNumero) return setError('Seleccione el expediente al que se incorpora.');
      body.expedienteNumero = expedienteNumero;
    } else {
      if (titulo.trim().length < 4) return setError('El título del expediente nuevo debe tener al menos 4 caracteres.');
      body.nuevoExpedienteTitulo = titulo.trim();
    }
    setEnviando(true);
    try {
      await api(`/radicados/${numero}/clasificar`, { method: 'POST', body: JSON.stringify(body) });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal title={`Clasificar radicado ${numero}`} onClose={onClose}>
      <SelectorSerieSubserie
        cuadro={cuadro.data}
        cargando={cuadro.cargando}
        serieId={serieId}
        subserieId={subserieId}
        onSerie={(id) => { setSerieId(id); setExpedienteNumero(''); setDestino('nuevo'); }}
        onSubserie={(id) => { setSubserieId(id); setExpedienteNumero(''); setDestino('nuevo'); }}
        dependenciaFiltroId={dependenciaId}
      />

      {serie && (
        <Field label="Destino">
          <div className="chips">
            <label className="radio-inline">
              <input type="radio" checked={destino === 'nuevo'} onChange={() => setDestino('nuevo')} />
              Expediente nuevo
            </label>
            <label className="radio-inline">
              <input
                type="radio"
                checked={destino === 'existente'}
                onChange={() => setDestino('existente')}
                disabled={!candidatos.length}
              />
              Incorporar a uno abierto {candidatos.length ? `(${candidatos.length})` : '(no hay)'}
            </label>
          </div>
        </Field>
      )}

      {serie && destino === 'nuevo' && (
        <Field
          label="Título del expediente nuevo"
          hint={`Se abrirá como ${codigoClasificacion(serie, subserie)} — ${subserie ? subserie.nombre : serie.nombre}`}
        >
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Asunto o nombre del expediente" />
        </Field>
      )}

      {serie && destino === 'existente' && (
        <Field label="Expediente abierto">
          <select value={expedienteNumero} onChange={(e) => setExpedienteNumero(e.target.value)}>
            <option value="">— seleccione —</option>
            {candidatos.map((e) => (
              <option key={e.numero} value={e.numero}>
                {e.numero} · {e.titulo}
              </option>
            ))}
          </select>
        </Field>
      )}

      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="modal-acciones">
        <Boton variante="ghost" onClick={onClose}>
          Cancelar
        </Boton>
        <Boton onClick={submit} disabled={enviando}>
          {enviando ? '…' : 'Clasificar'}
        </Boton>
      </div>
    </Modal>
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

  const cfg: Record<
    Exclude<AccionId, 'responder' | 'comunicado' | 'clasificar'>,
    { titulo: string; path: string; campos: string[] }
  > = {
    asignar: { titulo: 'Asignar radicado', path: `/radicados/${numero}/asignar`, campos: ['dependenciaId', 'funcionarioId', 'observacion'] },
    aceptar: { titulo: 'Aceptar trámite', path: `/radicados/${numero}/aceptar`, campos: ['observacion'] },
    trasladar: { titulo: 'Trasladar', path: `/radicados/${numero}/trasladar`, campos: ['dependenciaId', 'funcionarioId', 'motivo'] },
    devolver: { titulo: 'Devolver', path: `/radicados/${numero}/devolver`, campos: ['motivo'] },
    reasignar: { titulo: 'Reasignar', path: `/radicados/${numero}/reasignar`, campos: ['funcionarioId', 'motivo'] },
    reabrir: { titulo: 'Reabrir', path: `/radicados/${numero}/reabrir`, campos: ['motivo'] },
    anular: { titulo: 'Anular radicado', path: `/radicados/${numero}/anulacion`, campos: ['motivo', 'justificacion'] },
  };
  const c = cfg[accion as Exclude<AccionId, 'responder' | 'comunicado' | 'clasificar'>];
  const [evidencias, setEvidencias] = useState<File[]>([]);

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
      const body: Record<string, unknown> = { ...campos };
      if (!body.funcionarioId) delete body.funcionarioId;
      if (evidencias.length) body.adjuntos = await subirEvidencias(evidencias);
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
          ) : k === 'justificacion' || k === 'motivo' || k === 'observacion' ? (
            <textarea value={campos[k] ?? ''} onChange={(e) => set(k, e.target.value)} rows={3} />
          ) : (
            <input value={campos[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
          )}
        </label>
      ))}
      <CampoEvidencias
        files={evidencias}
        setFiles={setEvidencias}
        label="Evidencias / soporte (opcional)"
      />
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
