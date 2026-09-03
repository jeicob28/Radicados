import { api, download } from '../api';
import { Boton, Card, ErrorMsg, fechaHora, useAsync } from '../ui';

interface Entrada {
  id: string;
  fechaHora: string;
  usuarioNombre: string | null;
  ip: string | null;
  entidad: string;
  entidadId: string | null;
  accion: string;
  observacion: string | null;
  hash: string;
}
interface Lista {
  items: Entrada[];
  siguienteCursor: string | null;
}

export default function Bitacora() {
  const verif = useAsync<{ total: number; ok: boolean; rupturaEnId: string | null }>(
    () => api('/bitacora/verificacion'),
    [],
  );
  const log = useAsync<Lista>(() => api('/bitacora?limit=100'), []);

  return (
    <div className="page">
      <h1>Auditoría</h1>

      <Card
        title="Integridad de la cadena"
        actions={
          <Boton variante="ghost" onClick={() => download('/bitacora/exportar', 'bitacora-firmada.json')}>
            Exportar firmada
          </Boton>
        }
      >
        {verif.error && <ErrorMsg>{verif.error}</ErrorMsg>}
        {verif.data && (
          <p className={verif.data.ok ? 'integridad ok' : 'integridad bad'}>
            {verif.data.ok
              ? `✓ Cadena íntegra — ${verif.data.total} entradas verificadas`
              : `✗ Ruptura detectada en la entrada ${verif.data.rupturaEnId}`}
          </p>
        )}
      </Card>

      <Card title="Registro">
        {log.error && <ErrorMsg>{log.error}</ErrorMsg>}
        {log.data && (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>IP</th>
                  <th>Entidad</th>
                  <th>Acción</th>
                  <th>Observación</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {log.data.items.map((e) => (
                  <tr key={e.id}>
                    <td>{fechaHora(e.fechaHora)}</td>
                    <td>{e.usuarioNombre ?? '—'}</td>
                    <td>{e.ip ?? '—'}</td>
                    <td>
                      {e.entidad}
                      {e.entidadId ? ` · ${e.entidadId.slice(0, 8)}` : ''}
                    </td>
                    <td>
                      <span className="pill muted">{e.accion}</span>
                    </td>
                    <td>{e.observacion ?? '—'}</td>
                    <td className="mono">{e.hash.slice(0, 12)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
