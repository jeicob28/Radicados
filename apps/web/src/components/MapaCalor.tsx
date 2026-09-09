// Mapa de calor de riesgos 5×5 — eje X: probabilidad (1→5), eje Y: impacto (5→1).
// `matriz[fila][col]` con fila 0 = impacto 5 … fila 4 = impacto 1; col 0 = prob 1.

export function banda(nivel: number): 'bajo' | 'medio' | 'alto' | 'extremo' {
  return nivel <= 4 ? 'bajo' : nivel <= 9 ? 'medio' : nivel <= 15 ? 'alto' : 'extremo';
}

export function MapaCalor({
  matriz,
  onCelda,
}: {
  matriz: number[][];
  onCelda?: (probabilidad: number, impacto: number) => void;
}) {
  return (
    <div className="mapa-calor">
      <div className="mc-ejeY">Impacto</div>
      <table>
        <tbody>
          {matriz.map((fila, f) => {
            const impacto = 5 - f;
            return (
              <tr key={impacto}>
                <th>{impacto}</th>
                {fila.map((n, c) => {
                  const prob = c + 1;
                  const b = banda(prob * impacto);
                  const Cell = onCelda ? 'button' : 'div';
                  return (
                    <td key={prob}>
                      <Cell
                        className={`mc-celda rz-${b}${n ? '' : ' mc-vacia'}`}
                        onClick={onCelda ? () => onCelda(prob, impacto) : undefined}
                        title={`Probabilidad ${prob} × Impacto ${impacto} — nivel ${prob * impacto} (${b})`}
                      >
                        {n || ''}
                      </Cell>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr>
            <th aria-hidden />
            {[1, 2, 3, 4, 5].map((p) => (
              <td key={p} className="mc-xlab">{p}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <div className="mc-ejeX">Probabilidad</div>
      <ul className="mc-leyenda">
        <li><span className="mc-pt rz-bajo" /> Bajo (1–4)</li>
        <li><span className="mc-pt rz-medio" /> Medio (5–9)</li>
        <li><span className="mc-pt rz-alto" /> Alto (10–15)</li>
        <li><span className="mc-pt rz-extremo" /> Extremo (16–25)</li>
      </ul>
    </div>
  );
}
