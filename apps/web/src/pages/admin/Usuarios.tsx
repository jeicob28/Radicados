import { useState } from 'react';
import { api } from '../../api';
import { Boton, Card, ErrorMsg, Field, Modal, fechaHora, useAsync } from '../../ui';

interface RolLista {
  codigo: string;
  nombre: string;
}
interface DepPlano {
  id: string;
  codigo: string;
  nombre: string;
}
interface UsuarioLista {
  id: string;
  documento: string;
  nombre: string;
  email: string;
  roles: string[];
  activo: boolean;
  dependenciaId: string | null;
  dependencia?: { codigo: string; nombre: string } | null;
  ultimoAcceso: string | null;
  debeCambiarPassword: boolean;
  mfaHabilitado: boolean;
}

function aplanar(nodos: any[], nivel = 0): DepPlano[] {
  return nodos.flatMap((n) => [
    { id: n.id, codigo: n.codigo, nombre: `${'— '.repeat(nivel)}${n.codigo} · ${n.nombre}` },
    ...aplanar(n.hijos ?? [], nivel + 1),
  ]);
}

export default function Usuarios() {
  const [q, setQ] = useState('');
  const [depFiltro, setDepFiltro] = useState('');
  const [activoFiltro, setActivoFiltro] = useState('');
  const { data: roles } = useAsync<RolLista[]>(() => api('/roles'), []);
  const { data: depArbol } = useAsync<any[]>(() => api('/dependencias'), []);
  const deps = depArbol ? aplanar(depArbol) : [];

  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (depFiltro) qs.set('dependenciaId', depFiltro);
  if (activoFiltro) qs.set('activo', activoFiltro);

  const { data, error, cargando, recargar } = useAsync<UsuarioLista[]>(
    () => api(`/usuarios?${qs.toString()}`),
    [q, depFiltro, activoFiltro],
  );

  const [editando, setEditando] = useState<UsuarioLista | 'nuevo' | null>(null);

  return (
    <div className="page">
      <h1>Usuarios</h1>
      <Card
        actions={
          <Boton variante="ghost" onClick={() => setEditando('nuevo')}>
            + Nuevo usuario
          </Boton>
        }
      >
        <div className="filtros">
          <input placeholder="Buscar por nombre, correo o documento…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={depFiltro} onChange={(e) => setDepFiltro(e.target.value)}>
            <option value="">Toda dependencia</option>
            {deps.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
          <select value={activoFiltro} onChange={(e) => setActivoFiltro(e.target.value)}>
            <option value="">Activos e inactivos</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
          </select>
        </div>

        {error && <ErrorMsg>{error}</ErrorMsg>}
        {cargando && <p className="vacio">Cargando…</p>}
        {data && (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Roles</th>
                  <th>Dependencia</th>
                  <th>Último acceso</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nombre}</td>
                    <td>{u.email}</td>
                    <td>
                      {u.roles.map((r) => (
                        <span key={r} className="pill acc" style={{ marginRight: 4 }}>
                          {r}
                        </span>
                      ))}
                    </td>
                    <td>{u.dependencia?.codigo ?? '—'}</td>
                    <td>{fechaHora(u.ultimoAcceso)}</td>
                    <td>
                      <span className={`pill ${u.activo ? 'ok' : 'crit'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                      {u.debeCambiarPassword && <span className="pill warn" style={{ marginLeft: 4 }}>debe cambiar clave</span>}
                    </td>
                    <td>
                      <button className="link" onClick={() => setEditando(u)}>
                        Gestionar
                      </button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="vacio">
                      Sin usuarios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editando && (
        <UsuarioModal
          usuario={editando === 'nuevo' ? null : editando}
          roles={roles ?? []}
          deps={deps}
          onClose={() => setEditando(null)}
          onDone={() => {
            setEditando(null);
            recargar();
          }}
        />
      )}
    </div>
  );
}

function UsuarioModal({
  usuario,
  roles,
  deps,
  onClose,
  onDone,
}: {
  usuario: UsuarioLista | null;
  roles: RolLista[];
  deps: DepPlano[];
  onClose: () => void;
  onDone: () => void;
}) {
  const esNuevo = !usuario;
  const [documento, setDocumento] = useState(usuario?.documento ?? '');
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [rolesSel, setRolesSel] = useState<string[]>(usuario?.roles ?? []);
  const [dependenciaId, setDependenciaId] = useState(usuario?.dependenciaId ?? '');
  const [activo, setActivo] = useState(usuario?.activo ?? true);

  const [nuevaPassword, setNuevaPassword] = useState('');
  const [forzarCambio, setForzarCambio] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const toggleRol = (r: string) =>
    setRolesSel((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));

  const guardarDatos = async () => {
    setEnviando(true);
    setError(null);
    setOk(null);
    try {
      if (esNuevo) {
        const res = await api<{ usuario: UsuarioLista; passwordTemporal?: string }>('/usuarios', {
          method: 'POST',
          body: JSON.stringify({ documento, nombre, email, roles: rolesSel, dependenciaId: dependenciaId || undefined }),
        });
        if (res.passwordTemporal) {
          setOk(`Usuario creado. Contraseña temporal: ${res.passwordTemporal}`);
        } else {
          onDone();
        }
      } else {
        await api(`/usuarios/${usuario!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ nombre, email, roles: rolesSel, dependenciaId: dependenciaId || null, activo }),
        });
        onDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  const restablecerTemporal = async () => {
    setError(null);
    try {
      const r = await api<{ passwordTemporal: string }>(`/usuarios/${usuario!.id}/reset-password`, { method: 'POST' });
      setOk(`Nueva contraseña temporal: ${r.passwordTemporal}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const fijarPassword = async () => {
    if (!nuevaPassword) return setError('Escriba la contraseña a fijar');
    setError(null);
    try {
      await api(`/usuarios/${usuario!.id}/password`, {
        method: 'POST',
        body: JSON.stringify({ password: nuevaPassword, forzarCambio }),
      });
      setOk('Contraseña actualizada.');
      setNuevaPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const cerrarSesiones = async () => {
    setError(null);
    try {
      await api(`/usuarios/${usuario!.id}/cerrar-sesiones`, { method: 'POST' });
      setOk('Sesiones cerradas.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Modal title={esNuevo ? 'Nuevo usuario' : `Usuario · ${usuario!.nombre}`} onClose={onClose}>
      {esNuevo && (
        <Field label="Documento">
          <input value={documento} onChange={(e) => setDocumento(e.target.value)} />
        </Field>
      )}
      <Field label="Nombre completo">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Field>
      <Field label="Correo">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Dependencia">
        <select value={dependenciaId} onChange={(e) => setDependenciaId(e.target.value)}>
          <option value="">— sin asignar —</option>
          {deps.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Roles">
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {roles.map((r) => (
            <label key={r.codigo} className={`rolchip ${rolesSel.includes(r.codigo) ? 'sel' : ''}`}>
              <input
                type="checkbox"
                checked={rolesSel.includes(r.codigo)}
                onChange={() => toggleRol(r.codigo)}
              />
              {r.nombre}
            </label>
          ))}
        </div>
      </Field>
      {!esNuevo && (
        <Field label="Estado">
          <label className="rolchip" style={{ display: 'inline-flex' }}>
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Cuenta activa
          </label>
        </Field>
      )}

      {error && <ErrorMsg>{error}</ErrorMsg>}
      {ok && <p className="integridad ok">{ok}</p>}

      <div className="modal-acciones">
        <Boton variante="ghost" onClick={onClose}>
          Cerrar
        </Boton>
        <Boton onClick={guardarDatos} disabled={enviando || !nombre || !email || rolesSel.length === 0}>
          {esNuevo ? 'Crear usuario' : 'Guardar cambios'}
        </Boton>
      </div>

      {!esNuevo && (
        <>
          <hr className="soft" />
          <h4 style={{ margin: '4px 0 10px' }}>Contraseña y sesiones</h4>
          <div className="chips" style={{ marginBottom: 10 }}>
            <Boton variante="ghost" onClick={restablecerTemporal}>
              Restablecer (temporal)
            </Boton>
            <Boton variante="ghost" onClick={cerrarSesiones}>
              Cerrar sesiones
            </Boton>
          </div>
          <Field label="Fijar contraseña específica">
            <input
              type="text"
              placeholder="Nueva contraseña…"
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
            />
          </Field>
          <label className="rolchip" style={{ display: 'inline-flex', marginBottom: 10 }}>
            <input type="checkbox" checked={forzarCambio} onChange={(e) => setForzarCambio(e.target.checked)} />
            Exigir cambio en el próximo ingreso
          </label>
          <div className="modal-acciones" style={{ justifyContent: 'flex-start' }}>
            <Boton variante="ghost" onClick={fijarPassword}>
              Fijar contraseña
            </Boton>
          </div>
        </>
      )}
    </Modal>
  );
}
