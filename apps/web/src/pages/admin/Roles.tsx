import { useState } from 'react';
import { api } from '../../api';
import { Boton, Card, ErrorMsg, Field, Modal, useAsync } from '../../ui';

interface Rol {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  sistema: boolean;
}

export default function Roles() {
  const { data, error, cargando, recargar } = useAsync<Rol[]>(() => api('/roles'), []);
  const [editando, setEditando] = useState<Rol | 'nuevo' | null>(null);

  return (
    <div className="page">
      <h1>Roles</h1>
      <Card actions={<Boton variante="ghost" onClick={() => setEditando('nuevo')}>+ Nuevo rol</Boton>}>
        {error && <ErrorMsg>{error}</ErrorMsg>}
        {cargando && <p className="vacio">Cargando…</p>}
        {data && (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Permisos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.codigo}>
                    <td className="mono">{r.codigo}</td>
                    <td>{r.nombre}</td>
                    <td>{r.descripcion ?? '—'}</td>
                    <td>{r.permisos.join(', ') || '—'}</td>
                    <td>
                      <button className="link" onClick={() => setEditando(r)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editando && (
        <RolModal
          rol={editando === 'nuevo' ? null : editando}
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

function RolModal({ rol, onClose, onDone }: { rol: Rol | null; onClose: () => void; onDone: () => void }) {
  const esNuevo = !rol;
  const [codigo, setCodigo] = useState(rol?.codigo ?? '');
  const [nombre, setNombre] = useState(rol?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? '');
  const [permisos, setPermisos] = useState((rol?.permisos ?? []).join(', '));
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    setEnviando(true);
    setError(null);
    const permisosArr = permisos
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    try {
      if (esNuevo) {
        await api('/roles', {
          method: 'POST',
          body: JSON.stringify({ codigo: codigo.toUpperCase(), nombre, descripcion, permisos: permisosArr }),
        });
      } else {
        await api(`/roles/${rol!.codigo}`, {
          method: 'PATCH',
          body: JSON.stringify({ nombre, descripcion, permisos: permisosArr }),
        });
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal title={esNuevo ? 'Nuevo rol' : `Rol · ${rol!.nombre}`} onClose={onClose}>
      {esNuevo && (
        <Field label="Código" hint="MAYÚSCULAS_CON_GUIONES_BAJOS">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
        </Field>
      )}
      <Field label="Nombre">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Field>
      <Field label="Descripción">
        <textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </Field>
      <Field label="Permisos" hint="separados por coma, p. ej. radicado:leer, radicado:crear">
        <textarea rows={2} value={permisos} onChange={(e) => setPermisos(e.target.value)} disabled={rol?.sistema} />
      </Field>
      {rol?.sistema && <p className="vacio">Rol del sistema: los permisos no son editables.</p>}
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="modal-acciones">
        <Boton variante="ghost" onClick={onClose}>
          Cancelar
        </Boton>
        <Boton onClick={guardar} disabled={enviando || !nombre || (esNuevo && !codigo)}>
          Guardar
        </Boton>
      </div>
    </Modal>
  );
}
