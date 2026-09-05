import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Alerta, Card, ErrorMsg, useAsync } from '../ui';

const ROLES_VISIBILIDAD_TOTAL = ['VENTANILLA', 'ARCHIVISTA', 'AUDITOR', 'RADICADOR'];

interface Indicadores {
  abiertos: number;
  vencidos: number;
  porVencer: number;
  cerrados: number;
  respondidos: number;
  tiempoPromedioRespuestaHoras: number | null;
  semaforo: Record<string, number>;
}

interface Venc {
  numero: string;
  asunto: string;
  dependencia?: string;
  responsable?: string | null;
  fechaVencimiento: string | null;
  nivelAlerta: string;
  diasHabilesRestantes: number | null;
}

export default function Dashboard() {
  const { tieneRol } = useAuth();
  const soloMiDependencia = !tieneRol(...ROLES_VISIBILIDAD_TOTAL);
  const ind = useAsync(() => api<Indicadores>('/seguimiento/indicadores'), []);
  const venc = useAsync(() => api<Venc[]>('/seguimiento/vencimientos'), []);

  return (
    <div className="page">
      <h1>Panel</h1>
      {soloMiDependencia && (
        <p className="vacio" style={{ textAlign: 'left', padding: '0 0 10px' }}>
          Los indicadores y vencimientos son solo de tu dependencia.
        </p>
      )}

      {ind.error && <ErrorMsg>{ind.error}</ErrorMsg>}
      {ind.data && (
        <div className="tiles">
          <div className="tile">
            <strong>{ind.data.abiertos}</strong>
            <span>Radicados abiertos</span>
          </div>
          <div className="tile crit">
            <strong>{ind.data.vencidos}</strong>
            <span>Vencidos</span>
          </div>
          <div className="tile warn">
            <strong>{ind.data.porVencer}</strong>
            <span>Por vencer</span>
          </div>
          <div className="tile">
            <strong>{ind.data.cerrados}</strong>
            <span>Cerrados</span>
          </div>
          <div className="tile">
            <strong>
              {ind.data.tiempoPromedioRespuestaHoras != null
                ? `${ind.data.tiempoPromedioRespuestaHoras} h`
                : '—'}
            </strong>
            <span>Tiempo prom. respuesta</span>
          </div>
        </div>
      )}

      <Card title="Vencimientos próximos" actions={<Link to="/consulta?vencidos=true">Ver todos</Link>}>
        {venc.error && <ErrorMsg>{venc.error}</ErrorMsg>}
        {venc.data && venc.data.length === 0 && <p className="vacio">Sin radicados con vencimiento activo.</p>}
        {venc.data && venc.data.length > 0 && (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Radicado</th>
                  <th>Asunto</th>
                  <th>Dependencia</th>
                  <th>Responsable</th>
                  <th>Días háb.</th>
                  <th>Alerta</th>
                </tr>
              </thead>
              <tbody>
                {venc.data.slice(0, 15).map((r) => (
                  <tr key={r.numero}>
                    <td>
                      <Link to={`/radicados/${r.numero}`} className="rad">
                        {r.numero}
                      </Link>
                    </td>
                    <td>{r.asunto}</td>
                    <td>{r.dependencia ?? '—'}</td>
                    <td>{r.responsable ?? '—'}</td>
                    <td className="num">{r.diasHabilesRestantes ?? '—'}</td>
                    <td>
                      <Alerta nivel={r.nivelAlerta} />
                    </td>
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
