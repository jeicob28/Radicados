import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, download } from '../api';
import { useAuth } from '../auth';
import { Boton, Card, ErrorMsg, Field, fechaCorta, useAsync } from '../ui';

interface Manual {
  id: string;
  nombre: string;
  descripcion: string | null;
  nombreArchivo: string;
  contentType: string;
  tamanoBytes: number;
  subidoEn: string;
  subidoPor: string | null;
}
interface Respuesta {
  manuales: Manual[];
  manualEnLineaUrl: string;
}

function tam(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function Ayuda() {
  const { tieneRol } = useAuth();
  const admin = tieneRol('ADMIN');
  const { data, error, cargando, recargar } = useAsync<Respuesta>(() => api('/ayuda/manuales'), []);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const op = async (fn: () => Promise<unknown>, ok: string) => {
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      recargar();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    }
  };

  const subir = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setErr('Elige un archivo.');
    if (!nombre.trim()) return setErr('Ponle un nombre al documento.');
    setSubiendo(true);
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('nombre', nombre.trim());
    if (descripcion.trim()) fd.append('descripcion', descripcion.trim());
    await op(() => api('/ayuda/manuales', { method: 'POST', body: fd }), 'Documento subido.');
    setSubiendo(false);
    setNombre('');
    setDescripcion('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="page">
      <h1>Ayuda</h1>
      <p className="vacio" style={{ textAlign: 'left', padding: 0, marginTop: -8, maxWidth: 760 }}>
        Manuales, guías y documentos de apoyo para usar el sistema.
      </p>

      {msg && <div className="exito" style={{ margin: '10px 0' }}>{msg}</div>}
      {err && <ErrorMsg>{err}</ErrorMsg>}
      {error && <ErrorMsg>{error}</ErrorMsg>}

      <Card title="Manual en línea">
        <p>
          El manual completo por rol (Super Administrador, Ventanilla Única y Funcionario), con el
          ciclo de vida del radicado, está publicado en línea y se puede imprimir o guardar como PDF.
        </p>
        {data?.manualEnLineaUrl && (
          <p>
            <a href={data.manualEnLineaUrl} target="_blank" rel="noopener noreferrer">
              Abrir el manual en línea ↗
            </a>
          </p>
        )}
      </Card>

      <Card title={`Documentos y manuales (${data?.manuales.length ?? 0})`}>
        {cargando && <p className="vacio">Cargando…</p>}
        {data && data.manuales.length === 0 && (
          <p className="vacio">Todavía no hay documentos cargados.</p>
        )}
        {data && data.manuales.length > 0 && (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Tamaño</th>
                  <th>Actualizado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.manuales.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.nombre}</strong>
                      {m.descripcion && (
                        <div className="vacio" style={{ padding: 0, textAlign: 'left' }}>{m.descripcion}</div>
                      )}
                      <div className="mono">{m.nombreArchivo}</div>
                    </td>
                    <td>{tam(m.tamanoBytes)}</td>
                    <td>
                      {fechaCorta(m.subidoEn)}
                      {m.subidoPor && (
                        <div className="vacio" style={{ padding: 0 }}>por {m.subidoPor}</div>
                      )}
                    </td>
                    <td>
                      <div className="chips">
                        <button
                          className="link"
                          onClick={() => download(`/ayuda/manuales/${m.id}/descargar`, m.nombreArchivo)}
                        >
                          Descargar
                        </button>
                        {admin && (
                          <button
                            className="link crit"
                            onClick={() =>
                              confirm(`¿Eliminar "${m.nombre}"?`) &&
                              op(() => api(`/ayuda/manuales/${m.id}`, { method: 'DELETE' }), 'Documento eliminado.')
                            }
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {admin && (
          <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <h4 style={{ margin: '0 0 10px' }}>Subir un documento</h4>
            <div className="form-grid">
              <Field label="Nombre">
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Manual de Ventanilla Única" />
              </Field>
              <Field label="Descripción (opcional)">
                <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
              </Field>
              <Field label="Archivo" hint="PDF, Word, HTML, texto o imagen. Máx. 25 MB.">
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.odt,.txt,.md,.html,.htm,.png,.jpg,.jpeg,.ppt,.pptx" />
              </Field>
            </div>
            <Boton onClick={subir} disabled={subiendo}>
              {subiendo ? 'Subiendo…' : 'Subir documento'}
            </Boton>
          </div>
        )}
      </Card>

      <Card title="Marco legal">
        <p>
          La normativa colombiana sobre la que se construyó el sistema y en la que se apoya
          legalmente está en <Link to="/marco-legal">Marco legal y normativa</Link>.
        </p>
      </Card>

      <Card title="Primeros pasos">
        <ul>
          <li><strong>Entrar</strong> — con el correo y la contraseña que te entregó el administrador. En el primer ingreso el sistema te obliga a cambiarla.</li>
          <li><strong>La campana</strong> (arriba a la izquierda) — te avisa de radicados asignados, devoluciones y vencimientos próximos.</li>
          <li><strong>Consulta</strong> — busca cualquier radicado por número, asunto o tercero (ves los de tu dependencia).</li>
          <li><strong>Cerrar sesión</strong> — al terminar, sobre todo en un equipo compartido.</li>
          <li>Si te cambian el rol o la dependencia, <strong>cierra y vuelve a entrar</strong> para que tome efecto.</li>
        </ul>
      </Card>
    </div>
  );
}
