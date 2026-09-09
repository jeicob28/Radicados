// Gráficas mínimas sin dependencias: barras (CSS) y dona (SVG).

export interface Punto {
  clave: string;
  label: string;
  valor: number;
  color?: string;
}

const PALETA = ['#2f6f8f', '#3f8f6f', '#9c6b12', '#7a4b8f', '#b23a2e', '#4f8fb2', '#6f9c3f', '#8f6f4f'];
export const color = (i: number) => PALETA[i % PALETA.length];

/** Barras horizontales; cada fila es un botón si se pasa onClick. */
export function Barras({
  datos,
  onClick,
  sufijo,
}: {
  datos: Punto[];
  onClick?: (p: Punto) => void;
  sufijo?: string;
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  if (!datos.length) return <p className="vacio">Sin datos.</p>;
  return (
    <div className="g-barras">
      {datos.map((d, i) => {
        const Fila = onClick ? 'button' : 'div';
        return (
          <Fila
            key={d.clave}
            className={`g-fila${onClick ? ' g-clic' : ''}`}
            onClick={onClick ? () => onClick(d) : undefined}
          >
            <span className="g-etq" title={d.label}>{d.label}</span>
            <span className="g-track">
              <span
                className="g-bar"
                style={{ width: `${(d.valor / max) * 100}%`, background: d.color ?? color(i) }}
              />
            </span>
            <span className="g-val">
              {d.valor}
              {sufijo}
            </span>
          </Fila>
        );
      })}
    </div>
  );
}

/** Dona + leyenda. */
export function Dona({ datos, titulo }: { datos: Punto[]; titulo?: string }) {
  const total = datos.reduce((a, d) => a + d.valor, 0);
  const size = 148;
  const R = size / 2 - 12;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="g-dona">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="var(--surface-2, #eee)" strokeWidth={16} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {total > 0 &&
            datos.map((d, i) => {
              const frac = d.valor / total;
              const el = (
                <circle
                  key={d.clave}
                  cx={size / 2}
                  cy={size / 2}
                  r={R}
                  fill="none"
                  stroke={d.color ?? color(i)}
                  strokeWidth={16}
                  strokeDasharray={`${frac * C} ${C}`}
                  strokeDashoffset={-acc * C}
                />
              );
              acc += frac;
              return el;
            })}
        </g>
        <text x="50%" y="47%" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text, #222)">
          {total}
        </text>
        <text x="50%" y="62%" textAnchor="middle" fontSize="9" fill="var(--muted, #888)">
          {titulo ?? 'total'}
        </text>
      </svg>
      <ul className="g-leyenda">
        {datos.map((d, i) => (
          <li key={d.clave}>
            <span className="g-punto" style={{ background: d.color ?? color(i) }} />
            {d.label} <strong>{d.valor}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
