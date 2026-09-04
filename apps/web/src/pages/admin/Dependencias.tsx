import { useState } from 'react';
import { api } from '../../api';
import { Boton, Card, ErrorMsg, Field, Modal, fechaHora, useAsync } from '../../ui';

interface DepNodo {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  hijos: DepNodo[];
}
interface DepDetalle {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  parent: { id: string; codigo: string; nombre: string } | null;
  hijos: { id: string; codigo: string; nombre: string; activa: boolean }[];
  usuarios: { id: string; nombre: string; email: string; roles: string[]; activo: boolean; ultimoAcceso: string | null }[];
  _count: { radicados: number; expedientes: number };
}

function Nodo({ n, nivel, onSelect, seleccionado }: { n: DepNodo; nivel: number; onSelect: (id: string) => void; seleccionado: string | null }) {
  return (
    <>
      <button
        className={`dep-nodo ${seleccionado === n.id ? 'sel' : ''}`}
        style={{ paddingLeft: 10 + nivel * 18 }}
        onClick={() => onSelect(n.id)}
      >
        <span className="mono">{n.codigo}</span> {n.nombre}
        {!n.activa && <span className="pill crit" style={{ marginLeft: 6 }}>inactiva</span>}
      </button>
      {n.hijos.map((h) => (
        <Nodo key={h.id} n={h} nivel={nivel + 1} onSelect={onSelect} seleccionado={seleccionado} />
      ))}
    </>
  );
}

export default function Dependencias() {
  const { data: arbol, error, cargando, recargar } = useAsync<DepNodo[]>(() => api('/dependencias'), []);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<null | { parentId?: string }>(null);
  const [editar, setEditar] = useState(false);

  const detalle = useAsync<DepDetalle | null>(
    () => (seleccionado ? api(`/dependencias/${seleccionado}`) : Promise.resolve(null)),
    [seleccionado],
  );

  const quitarDeDependencia = async (usuarioId: string) => {
    await api(`/usuarios/${usuarioId}`, { method: 'PATCH', body: JSON.stringify({ dependenciaId: null }) });
    detalle.recargar();
  };

  return (
    <div className="page">
      <h1>Dependencias</h1>
      <div className="cols" style={{ gridTemplateColumns: '340px 1fr' }}>
        <Card title="Organigrama" actions={<Boton variante="ghost" onClick={() => setNuevo({})}>+ Nueva</Boton>}>
          {error && <ErrorMsg>{error}</ErrorMsg>}
          {cargando && <p className="vacio">Cargando…</p>}
          <div className="dep-arbol">
            {(arbol ?? []).map((n) => (
              <Nodo key={n.id} n={n} nivel={0} onSelect={setSeleccionado} seleccionado={seleccionado} />
            ))}
          </div>
        </Card>

        <Card>
          {!seleccionado && <p className="vacio">Seleccione una dependencia del organigrama.</p>}
          {seleccionado && detalle.data && (
            <>
              <div className="detalle-h" style={{ marginBottom: 12 }}>
                <div>
                  <h2 style={{ margin: '0 0 4px' }}>
                    {detalle.data.codigo} · {detalle.data.nombre}
                  </h2>
                  <p className="vacio" style={{ padding: 0, textAlign: 'left' }}>
                    {detalle.data.parent ? `Depende de ${detalle.data.parent.nombre}` : 'Dependencia raíz'} ·{' '}
                    {detalle.data._count.radicados} radicados · {detalle.data._count.expedientes} expedientes
                  </p>
                </div>
                <div className="chips">
                  <Boton variante="ghost" onClick={() => setNuevo({ parentId: seleccionado })}>
                    + Sub-dependencia
                  </Boton>
                  <Boton variante="ghost" onClick={() => setEditar(true)}>
                    Editar
                  </Boton>
                </div>
              </div>

              <h4>Personal ({detalle.data.usuarios.length})</h4>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Roles</th>
                      <th>Último acceso</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.data.usuarios.map((u) => (
                      <tr key={u.id}>
                        <td>{u.nombre}</td>
                        <td>{u.email}</td>
                        <td>{u.roles.join(', ')}</td>
                        <td>{fechaHora(u.ultimoAcceso)}</td>
                        <td>
                          <span className={`pill ${u.activo ? 'ok' : 'crit'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                        </td>
                        <td>
                          <button className="link" onClick={() => quitarDeDependencia(u.id)}>
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {detalle.data.usuarios.length === 0 && (
                      <tr>
                        <td colSpan={6} className="vacio">
                          Sin personal asignado. Agrégalo desde <em>Usuarios</em> eligiendo esta dependencia.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      {nuevo && (
        <DependenciaModal
          parentId={nuevo.parentId}
          onClose={() => setNuevo(null)}
          onDone={() => {
            setNuevo(null);
            recargar();
          }}
        />
      )}
      {editar && detalle.data && (
        <DependenciaModal
          dependencia={detalle.data}
          onClose={() => setEditar(false)}
          onDone={() => {
            setEditar(false);
            recargar();
            detalle.recargar();
          }}
        />
      )}
    </div>
  );
}

function DependenciaModal({
  dependencia,
  parentId,
  onClose,
  onDone,
}: {
  dependencia?: DepDetalle;
  parentId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const esNueva = !dependencia;
  const [codigo, setCodigo] = useState(dependencia?.codigo ?? '');
  const [nombre, setNombre] = useState(dependencia?.nombre ?? '');
  const [activa, setActiva] = useState(dependencia?.activa ?? true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async () => {
    setEnviando(true);
    setError(null);
    try {
      if (esNueva) {
        await api('/dependencias', {
          method: 'POST',
          body: JSON.stringify({ codigo: codigo.toUpperCase(), nombre, parentId }),
        });
      } else {
        await api(`/dependencias/${dependencia!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ nombre, activa }),
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
    <Modal title={esNueva ? 'Nueva dependencia' : `Editar · ${dependencia!.nombre}`} onClose={onClose}>
      {esNueva && (
        <Field label="Código" hint="2-12 caracteres, MAYÚSCULAS">
          <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
        </Field>
      )}
      <Field label="Nombre">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Field>
      {!esNueva && (
        <label className="rolchip" style={{ display: 'inline-flex' }}>
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
          Dependencia activa
        </label>
      )}
      {error && <ErrorMsg>{error}</ErrorMsg>}
      <div className="modal-acciones">
        <Boton variante="ghost" onClick={onClose}>
          Cancelar
        </Boton>
        <Boton onClick={guardar} disabled={enviando || !nombre || (esNueva && !codigo)}>
          Guardar
        </Boton>
      </div>
    </Modal>
  );
}
