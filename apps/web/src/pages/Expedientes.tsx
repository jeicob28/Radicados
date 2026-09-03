import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Boton, Card, ErrorMsg, fechaCorta, useAsync } from '../ui';

interface ExpLista {
  numero: string;
  titulo: string;
  estado: string;
  serie: { codigo: string; nombre: string };
  _count: { documentos: number; radicados: number };
}

export function ExpedientesLista() {
  const { tieneRol } = useAuth();
  const nav = useNavigate();
  const { data, error, recargar } = useAsync<ExpLista[]>(() => api('/expedientes'), []);
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
                <th>Número</th>
                <th>Título</th>
                <th>Serie</th>
                <th>Estado</th>
                <th>Documentos</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((e) => (
                <tr key={e.numero}>
                  <td>
                    <Link to={`/expedientes/${e.numero}`} className="rad">
                      {e.numero}
                    </Link>
                  </td>
                  <td>{e.titulo}</td>
                  <td>{e.serie.codigo}</td>
                  <td>
                    <span className="pill muted">{e.estado.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="num">{e._count.documentos + e._count.radicados}</td>
                </tr>
              ))}
              {data && data.length === 0 && (
                <tr>
                  <td colSpan={5} className="vacio">
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
        {tieneRol('ARCHIVISTA') && e.estado === 'ABIERTO' && (
          <div className="chips">
            <Boton variante="ghost" onClick={() => accion('foliar')}>
              Foliar
            </Boton>
            <Boton variante="ghost" onClick={() => accion('verificar-integridad')}>
              Verificar integridad
            </Boton>
            <Boton onClick={() => accion('cerrar')}>Cerrar expediente</Boton>
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
    </div>
  );
}
