import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Boton, Card, ErrorMsg, Field, Modal, fechaCorta, useAsync } from '../ui';
import CapturaCamara from '../components/CapturaCamara';

interface ExpLista {
  numero: string;
  titulo: string;
  estado: string;
  serie: { codigo: string; nombre: string };
  subserie: { codigo: string; nombre: string } | null;
  dependencia?: { codigo: string; nombre: string };
  _count: { documentos: number; radicados: number };
}

/** Código de clasificación archivística: serie(.subserie). */
function clasifCodigo(e: ExpLista) {
  return e.subserie ? `${e.serie.codigo}.${e.subserie.codigo}` : e.serie.codigo;
}
function clasifNombre(e: ExpLista) {
  return e.subserie ? `${e.serie.nombre} / ${e.subserie.nombre}` : e.serie.nombre;
}

export function ExpedientesLista() {
  const { tieneRol } = useAuth();
  const nav = useNavigate();
  const { data, error } = useAsync<ExpLista[]>(() => api('/expedientes'), []);
  const [nuevo, setNuevo] = useState(false);

  return (
    <div className="page">
      <h1>Expedientes</h1>
      <Card
        actions={
          tieneRol('ARCHIVISTA') ? (
            <Boton variante="ghost" onClick={() => setNuevo(true)}>
              + Nuevo
            </Boton>
          ) : undefined
        }
      >
        {error && <ErrorMsg>{error}</ErrorMsg>}
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Clasificación (serie · subserie)</th>
                <th>Expediente</th>
                <th>Estado</th>
                <th>Documentos</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((e) => (
                <tr key={e.numero}>
                  <td>
                    <span className="mono">{clasifCodigo(e)}</span>
                    <div className="vacio" style={{ padding: 0, textAlign: 'left' }}>{clasifNombre(e)}</div>
                  </td>
                  <td>
                    <Link to={`/expedientes/${e.numero}`} className="rad">
                      {e.numero}
                    </Link>
                    {e.titulo && (
                      <div className="vacio" style={{ padding: 0, textAlign: 'left' }}>{e.titulo}</div>
                    )}
                  </td>
                  <td>
                    <span className="pill muted">{e.estado.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="num">{e._count.documentos + e._count.radicados}</td>
                </tr>
              ))}
              {data && data.length === 0 && (
                <tr>
                  <td colSpan={4} className="vacio">
                    Sin expedientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {nuevo && <NuevoExpediente onClose={() => setNuevo(false)} onDone={(n) => nav(`/expedientes/${n}`)} />}
    </div>
  );
}

function NuevoExpediente({ onClose, onDone }: { onClose: () => void; onDone: (n: string) => void }) {
  const series = useAsync<{ id: string; codigo: string; nombre: string; dependenciaId: string }[]>(
    () => api('/series'),
    [],
  );
  const [titulo, setTitulo] = useState('');
  const [serieId, setSerieId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = async () => {
    setError(null);
    const serie = series.data?.find((s) => s.id === serieId);
    if (!serie) return setError('Seleccione una serie');
    try {
      const r = await api<{ numero: string }>('/expedientes', {
        method: 'POST',
        body: JSON.stringify({ titulo, serieId, dependenciaId: serie.dependenciaId }),
      });
      onDone(r.numero);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Nuevo expediente</h3>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal-body">
          <label className="field">
            <span>Título</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>
          <label className="field">
            <span>Serie</span>
            <select value={serieId} onChange={(e) => setSerieId(e.target.value)}>
              <option value="">— seleccione —</option>
              {(series.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.codigo} · {s.nombre}
                </option>
              ))}
            </select>
          </label>
          {error && <ErrorMsg>{error}</ErrorMsg>}
          <div className="modal-acciones">
            <Boton variante="ghost" onClick={onClose}>
              Cancelar
            </Boton>
            <Boton onClick={crear}>Crear</Boton>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExpedienteDetalle() {
  const { numero } = useParams();
  const { tieneRol } = useAuth();
  const { data, error, cargando, recargar } = useAsync<any>(
    () => api(`/expedientes/${numero}`),
    [numero],
  );
  const indice = useAsync<any>(() => api(`/expedientes/${numero}/indice`), [numero]);

  const [incorporando, setIncorporando] = useState(false);

  const accion = async (path: string) => {
    await api(`/expedientes/${numero}/${path}`, { method: 'POST' });
    recargar();
    indice.recargar();
  };

  if (cargando) return <div className="page"><p className="vacio">Cargando…</p></div>;
  if (error) return <div className="page"><ErrorMsg>{error}</ErrorMsg></div>;
  const e = data;

  return (
    <div className="page">
      <div className="detalle-h">
        <div>
          <h1 className="rad-title">{e.numero}</h1>
          <div className="chips">
            <span className="pill muted">{e.estado.replace(/_/g, ' ')}</span>
            <span className="pill acc">{e.serie.codigo} · {e.serie.nombre}</span>
          </div>
        </div>
        {e.estado === 'ABIERTO' && (
          <div className="chips">
            {tieneRol('ARCHIVISTA', 'FUNCIONARIO', 'JEFE') && (
              <Boton variante="ghost" onClick={() => setIncorporando(true)}>
                + Incorporar documento
              </Boton>
            )}
            {tieneRol('ARCHIVISTA') && (
              <>
                <Boton variante="ghost" onClick={() => accion('foliar')}>
                  Foliar
                </Boton>
                <Boton variante="ghost" onClick={() => accion('verificar-integridad')}>
                  Verificar integridad
                </Boton>
                <Boton onClick={() => accion('cerrar')}>Cerrar expediente</Boton>
              </>
            )}
          </div>
        )}
      </div>

      <div className="cols">
        <Card title="Datos">
          <dl className="kv">
            <dt>Título</dt><dd>{e.titulo}</dd>
            <dt>Dependencia</dt><dd>{e.dependencia.nombre}</dd>
            <dt>Apertura</dt><dd>{fechaCorta(e.fechaApertura)}</dd>
            <dt>Cierre</dt><dd>{fechaCorta(e.fechaCierre)}</dd>
            <dt>Folios</dt><dd>{e.totalFolios}</dd>
            <dt>Fechas extremas</dt>
            <dd>{fechaCorta(e.fechaInicioExtrema)} — {fechaCorta(e.fechaFinExtrema)}</dd>
            {e.fechaLimiteArchivoGestion && (
              <>
                <dt>Retención</dt>
                <dd>
                  AG hasta {fechaCorta(e.fechaLimiteArchivoGestion)} · AC hasta{' '}
                  {fechaCorta(e.fechaLimiteArchivoCentral)}
                  <br />
                  Disposición: {e.disposicionFinal}
                </dd>
              </>
            )}
          </dl>
        </Card>

        <Card title={`Índice (${(indice.data?.documentos ?? []).length})`}>
          {indice.data && (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tipo</th>
                    <th>Título</th>
                    <th>Fecha</th>
                    <th>Folios</th>
                  </tr>
                </thead>
                <tbody>
                  {indice.data.documentos.map((d: any) => (
                    <tr key={d.orden}>
                      <td>{d.orden}</td>
                      <td>{d.tipo}</td>
                      <td>{d.titulo}</td>
                      <td>{fechaCorta(d.fecha)}</td>
                      <td>{d.folios ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title={`Radicados en el expediente (${e.radicados.length})`}>
        <ul className="anexos">
          {e.radicados.map((r: any) => (
            <li key={r.numero}>
              <Link to={`/radicados/${r.numero}`} className="rad">
                {r.numero}
              </Link>{' '}
              — {r.asunto}
            </li>
          ))}
        </ul>
      </Card>

      {incorporando && (
        <IncorporarDocumentoModal
          numero={numero!}
          onClose={() => setIncorporando(false)}
          onDone={() => {
            setIncorporando(false);
            recargar();
            indice.recargar();
          }}
        />
      )}
    </div>
  );
}

function IncorporarDocumentoModal({
  numero,
  onClose,
  onDone,
}: {
  numero: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [mostrarCamara, setMostrarCamara] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    if (!archivo) return setError('Adjunte un archivo o tome una foto');
    setEnviando(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('titulo', titulo || archivo.name);
      fd.append('file', archivo);
      await api(`/expedientes/${numero}/documentos`, { method: 'POST', body: fd });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal title="Incorporar documento" onClose={onClose}>
      <Field label="Título del documento">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Acta de reunión" />
      </Field>
      <Field label="Archivo" hint="Suba un archivo o fotografíe el documento físico">
        <div className="chips">
          <input type="file" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} style={{ flex: 1 }} />
          <Boton variante="ghost" onClick={() => setMostrarCamara(true)}>
            📷 Tomar foto
          </Boton>
        </div>
        {archivo && (
          <div className="capturas-lista">
            <div className="captura-item">
              {archivo.type.startsWith('image/') ? (
                <img src={URL.createObjectURL(archivo)} alt={archivo.name} />
              ) : (
                <span className="mono" style={{ fontSize: 10, padding: 4, display: 'block' }}>
                  {archivo.name}
                </span>
              )}
              <button type="button" onClick={() => setArchivo(null)} aria-label="Quitar">
                ×
              </button>
            </div>
          </div>
        )}
      </Field>
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="modal-acciones">
        <Boton variante="ghost" onClick={onClose}>
          Cancelar
        </Boton>
        <Boton onClick={guardar} disabled={enviando}>
          {enviando ? 'Subiendo…' : 'Incorporar'}
        </Boton>
      </div>

      {mostrarCamara && (
        <CapturaCamara
          titulo="Fotografiar documento"
          onCapturar={(f) => setArchivo(f)}
          onClose={() => setMostrarCamara(false)}
        />
      )}
    </Modal>
  );
}
