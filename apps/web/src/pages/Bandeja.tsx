import { Link } from 'react-router-dom';
import { api } from '../api';
import { Alerta, Card, EstadoPill, ErrorMsg, fechaCorta, useAsync } from '../ui';

interface Item {
  numero: string;
  asunto: string;
  estado: string;
  tipoComunicacion: string;
  remitente: string | null;
  fechaVencimiento: string | null;
  nivelAlerta: string;
  diasHabilesRestantes: number | null;
}

export default function Bandeja() {
  const { data, error, cargando } = useAsync<Item[]>(() => api('/bandeja'), []);

  return (
    <div className="page">
      <h1>Mi bandeja</h1>
      <Card>
        {error && <ErrorMsg>{error}</ErrorMsg>}
        {cargando && <p className="vacio">Cargando…</p>}
        {data && data.length === 0 && <p className="vacio">No tiene radicados asignados.</p>}
        {data && data.length > 0 && (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Radicado</th>
                  <th>Asunto</th>
                  <th>Remitente</th>
                  <th>Vence</th>
                  <th>Días háb.</th>
                  <th>Estado</th>
                  <th>Alerta</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.numero}>
                    <td>
                      <Link to={`/radicados/${r.numero}`} className="rad">
                        {r.numero}
                      </Link>
                    </td>
                    <td>{r.asunto}</td>
                    <td>{r.remitente ?? '—'}</td>
                    <td>{fechaCorta(r.fechaVencimiento)}</td>
                    <td className="num">{r.diasHabilesRestantes ?? '—'}</td>
                    <td>
                      <EstadoPill estado={r.estado} />
                    </td>
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
