import { useEffect, useRef, useState } from 'react';
import { api, ApiError, download } from '../../api';
import { Boton, Card, ErrorMsg, Field, Modal, fechaHora, useAsync } from '../../ui';

interface Manifest {
  creado?: string;
  cifrado?: string;
  base_datos?: {
    radicados?: number;
    anexos?: number;
    bitacora?: number;
    cadena_integra?: boolean;
  };
  objetos_minio?: number;
}
interface Copia {
  carpeta: string;
  creado: string;
  bytes: number;
  cifrada: boolean;
  completa: boolean;
  archivos: string[];
  manifest: Manifest | null;
}
interface Job {
  id: string;
  tipo: 'backup' | 'restore';
  estado: 'EN_CURSO' | 'OK' | 'ERROR';
  alcance?: string;
  carpeta?: string;
  solicitante?: string;
  inicio?: string;
  fin?: string;
  resumen?: string;
}
interface Estado {
  servicioActivo: boolean;
  heartbeat: string | null;
  job: Job | null;
  historial: Job[];
  mantenimiento: { activo: boolean; motivo?: string; desde?: string };
  discoLibreMb: number | null;
  config: {
    cron: string;
    retencionDias: number;
    minLibreMb: number;
    cifradoConfigurado: boolean;
    offsiteConfigurado: boolean;
  };
}
interface Respuesta extends Estado {
  copias: Copia[];
}

function tam(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function Copias() {
  const { data, error, cargando, recargar } = useAsync<Respuesta>(() => api('/copias'), []);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [restaurar, setRestaurar] = useState<Copia | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const job = data?.job ?? null;
  const jobEnCurso = job?.estado === 'EN_CURSO';

  // Mientras hay un trabajo en curso (o acaba de lanzarse), refresca cada 3 s.
  useEffect(() => {
    if (!jobEnCurso) return;
    const t = setInterval(recargar, 3000);
    return () => clearInterval(t);
  }, [jobEnCurso, recargar]);

  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(null);
    setMsg(null);
    setOcupado(true);
    try {
      await fn();
      setMsg(ok);
      recargar();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  const hacerCopia = () =>
    accion(() => api('/copias/ejecutar', { method: 'POST' }), 'Copia lanzada. Puede tardar un momento.');

  const importar = async (file: File) => {
    const fd = new FormData();
    fd.append('archivo', file);
    await accion(
      () => api('/copias/importar', { method: 'POST', body: fd }),
      'Copia importada. Ya aparece en la lista.',
    );
    if (fileRef.current) fileRef.current.value = '';
  };

  const toggleMantenimiento = (activo: boolean) =>
    accion(
      () =>
        api('/copias/mantenimiento', {
          method: 'POST',
          body: JSON.stringify({ activo, motivo: activo ? 'Mantenimiento manual' : undefined }),
        }),
      activo ? 'Modo mantenimiento activado.' : 'Modo mantenimiento desactivado.',
    );

  const cfg = data?.config;
  const disco = data?.discoLibreMb ?? null;
  const discoBajo = disco != null && cfg != null && disco < cfg.minLibreMb;

  return (
    <div className="page">
      <h1>Copias de seguridad</h1>
      <p className="vacio" style={{ textAlign: 'left', padding: 0, marginTop: -8 }}>
        Copia completa de la base de datos, los documentos y la configuración. Se hace una
        automática cada día; aquí puede lanzar una manual, descargarla para guardarla fuera del
        servidor, o restaurar una copia anterior.
      </p>

      {msg && <div className="exito" style={{ margin: '10px 0' }}>{msg}</div>}
      {err && <ErrorMsg>{err}</ErrorMsg>}
      {error && <ErrorMsg>{error}</ErrorMsg>}

      {/* ── estado del servicio ── */}
      <Card title="Estado">
        {cargando && <p className="vacio">Cargando…</p>}
        {data && (
          <div className="cols" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            <div>
              <strong>Servicio</strong>
              <div>
                <span className={`pill ${data.servicioActivo ? 'ok' : 'crit'}`}>
                  {data.servicioActivo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              {!data.servicioActivo && (
                <em className="vacio" style={{ padding: 0 }}>
                  El proceso de copias solo corre en el servidor de producción.
                </em>
              )}
            </div>
            <div>
              <strong>Programada</strong>
              <div className="mono">{cfg?.cron}</div>
              <em className="vacio" style={{ padding: 0 }}>retención {cfg?.retencionDias} días</em>
            </div>
            <div>
              <strong>Disco libre</strong>
              <div className={discoBajo ? 'crit' : ''}>
                {disco != null ? `${(disco / 1024).toFixed(1)} GB` : '—'}
              </div>
              {discoBajo && <em className="crit">por debajo del mínimo ({cfg?.minLibreMb} MB)</em>}
            </div>
            <div>
              <strong>Cifrado</strong>
              <div>
                <span className={`pill ${cfg?.cifradoConfigurado ? 'ok' : 'muted'}`}>
                  {cfg?.cifradoConfigurado ? 'Activado' : 'No'}
                </span>
              </div>
              <em className="vacio" style={{ padding: 0 }}>
                copia fuera del servidor: {cfg?.offsiteConfigurado ? 'sí' : 'no'}
              </em>
            </div>
          </div>
        )}

        <div className="chips" style={{ marginTop: 14 }}>
          <Boton onClick={hacerCopia} disabled={ocupado || jobEnCurso || !data?.servicioActivo}>
            Hacer copia ahora
          </Boton>
          <Boton variante="ghost" onClick={() => fileRef.current?.click()} disabled={ocupado || jobEnCurso}>
            Importar copia (.tar)
          </Boton>
          <input
            ref={fileRef}
            type="file"
            accept=".tar,.tgz,.gz"
            hidden
            onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])}
          />
          {data?.mantenimiento.activo ? (
            <Boton variante="danger" onClick={() => toggleMantenimiento(false)} disabled={ocupado || jobEnCurso}>
              Salir de mantenimiento
            </Boton>
          ) : (
            <Boton variante="ghost" onClick={() => toggleMantenimiento(true)} disabled={ocupado}>
              Activar mantenimiento
            </Boton>
          )}
        </div>
      </Card>

      {/* ── trabajo en curso / último ── */}
      {job && (
        <Card title={jobEnCurso ? 'Operación en curso' : 'Última operación'}>
          <p>
            <strong>{job.tipo === 'backup' ? 'Copia de seguridad' : 'Restauración'}</strong>
            {job.carpeta ? ` · ${job.carpeta}` : ''}
            {job.alcance && job.tipo === 'restore' ? ` (${job.alcance})` : ''}
            {' — '}
            <span className={`pill ${job.estado === 'OK' ? 'ok' : job.estado === 'ERROR' ? 'crit' : 'warn'}`}>
              {job.estado === 'EN_CURSO' ? 'en curso…' : job.estado}
            </span>
          </p>
          {job.resumen && <p className="mono" style={{ fontSize: 13 }}>{job.resumen}</p>}
          <em className="vacio" style={{ padding: 0 }}>
            {job.solicitante ? `Solicitó ${job.solicitante} · ` : ''}
            {fechaHora(job.inicio)}
            {job.fin ? ` → ${fechaHora(job.fin)}` : ''}
          </em>
          {jobEnCurso && (
            <p className="vacio" style={{ padding: 0, marginTop: 6 }}>
              No cierre esta página; el estado se actualiza solo.
            </p>
          )}
        </Card>
      )}

      {data?.mantenimiento.activo && !jobEnCurso && (
        <div className="error" style={{ margin: '10px 0' }}>
          El sistema está en <strong>modo mantenimiento</strong>: los usuarios que no son
          administradores no pueden entrar. Use “Salir de mantenimiento” cuando termine.
        </div>
      )}

      {/* ── lista de copias ── */}
      <Card title={`Copias disponibles (${data?.copias.length ?? 0})`}>
        {data && data.copias.length === 0 && <p className="vacio">Todavía no hay copias.</p>}
        {data && data.copias.length > 0 && (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tamaño</th>
                  <th>Contenido</th>
                  <th>Cadena bitácora</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.copias.map((c) => {
                  const bd = c.manifest?.base_datos;
                  return (
                    <tr key={c.carpeta}>
                      <td>
                        <div className="mono">{c.carpeta}</div>
                        <em className="vacio" style={{ padding: 0 }}>{fechaHora(c.creado)}</em>
                        {c.cifrada && <span className="pill acc" style={{ marginLeft: 4 }}>cifrada</span>}
                        {!c.completa && <span className="pill crit" style={{ marginLeft: 4 }}>incompleta</span>}
                      </td>
                      <td>{tam(c.bytes)}</td>
                      <td>
                        {bd ? (
                          <span>
                            {bd.radicados ?? '?'} radicados · {c.manifest?.objetos_minio ?? '?'} docs
                          </span>
                        ) : (
                          <em className="vacio" style={{ padding: 0 }}>sin manifiesto</em>
                        )}
                      </td>
                      <td>
                        {bd?.cadena_integra == null ? (
                          '—'
                        ) : (
                          <span className={`pill ${bd.cadena_integra ? 'ok' : 'crit'}`}>
                            {bd.cadena_integra ? 'íntegra' : 'ROTA'}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="chips">
                          <button
                            className="link"
                            onClick={() => download(`/copias/${c.carpeta}/paquete`, `sgdea-${c.carpeta}.tar`)}
                          >
                            Descargar
                          </button>
                          <button
                            className="link"
                            onClick={() => setRestaurar(c)}
                            disabled={jobEnCurso}
                          >
                            Restaurar
                          </button>
                          <button
                            className="link crit"
                            onClick={() =>
                              confirm(`¿Eliminar la copia ${c.carpeta}?`) &&
                              accion(
                                () => api(`/copias/${c.carpeta}`, { method: 'DELETE' }),
                                'Copia eliminada.',
                              )
                            }
                            disabled={jobEnCurso}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {restaurar && (
        <RestaurarModal
          copia={restaurar}
          onClose={() => setRestaurar(null)}
          onHecho={(m) => {
            setRestaurar(null);
            setMsg(m);
            recargar();
          }}
        />
      )}
    </div>
  );
}

function RestaurarModal({
  copia,
  onClose,
  onHecho,
}: {
  copia: Copia;
  onClose: () => void;
  onHecho: (msg: string) => void;
}) {
  const [alcance, setAlcance] = useState<'db' | 'objetos' | 'todo'>('todo');
  const [passphrase, setPassphrase] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setErr(null);
    setEnviando(true);
    try {
      await api(`/copias/${copia.carpeta}/restaurar`, {
        method: 'POST',
        body: JSON.stringify({
          alcance,
          confirmacion,
          passphrase: passphrase || undefined,
        }),
      });
      onHecho('Restauración iniciada. El sistema queda en mantenimiento hasta que termine.');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
      setEnviando(false);
    }
  };

  return (
    <Modal title={`Restaurar copia ${copia.carpeta}`} onClose={onClose}>
      <div className="error" style={{ marginBottom: 12 }}>
        Esto <strong>sobrescribe los datos actuales</strong> con los de la copia. El sistema
        entra en mantenimiento y los usuarios no podrán trabajar mientras dure. Haga una copia
        nueva antes si quiere poder volver atrás.
      </div>

      <Field label="Qué restaurar">
        <select value={alcance} onChange={(e) => setAlcance(e.target.value as typeof alcance)}>
          <option value="todo">Base de datos y documentos</option>
          <option value="db">Solo la base de datos</option>
          <option value="objetos">Solo los documentos</option>
        </select>
      </Field>

      {copia.cifrada && (
        <Field label="Frase de cifrado" hint="La copia está cifrada; sin la frase no se puede restaurar.">
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
          />
        </Field>
      )}

      <Field label="Escriba RESTAURAR para confirmar">
        <input
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          placeholder="RESTAURAR"
          autoComplete="off"
        />
      </Field>

      {err && <ErrorMsg>{err}</ErrorMsg>}

      <div className="chips" style={{ marginTop: 12 }}>
        <Boton
          variante="danger"
          onClick={enviar}
          disabled={enviando || confirmacion !== 'RESTAURAR' || (copia.cifrada && !passphrase)}
        >
          {enviando ? 'Iniciando…' : 'Restaurar ahora'}
        </Boton>
        <Boton variante="ghost" onClick={onClose}>
          Cancelar
        </Boton>
      </div>
    </Modal>
  );
}
