import { useRef, useState } from 'react';

interface Props {
  onChange: (file: File | null) => void;
}

/**
 * Campo de firma manuscrita: funciona con mouse, dedo (táctil) o lápiz óptico
 * (eventos de puntero unificados). Al soltar el trazo, exporta el lienzo como
 * PNG y lo entrega al padre; "Limpiar" lo vacía.
 */
export default function FirmaPad({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);

  const ctx = () => canvasRef.current?.getContext('2d') ?? null;

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const iniciar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dibujando.current = true;
    const c = ctx();
    if (!c) return;
    const { x, y } = punto(e);
    c.beginPath();
    c.moveTo(x, y);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return;
    const c = ctx();
    if (!c) return;
    const { x, y } = punto(e);
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    c.strokeStyle = '#23405c';
    c.lineTo(x, y);
    c.stroke();
    setTieneTrazo(true);
  };

  const terminar = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    exportar();
  };

  const exportar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onChange(new File([blob], 'firma-recepcion.png', { type: 'image/png' }));
    }, 'image/png');
  };

  const limpiar = () => {
    const canvas = canvasRef.current;
    const c = ctx();
    if (canvas && c) c.clearRect(0, 0, canvas.width, canvas.height);
    setTieneTrazo(false);
    onChange(null);
  };

  return (
    <div className="firma-wrap">
      <canvas
        ref={canvasRef}
        width={520}
        height={160}
        className="firma-canvas"
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
      />
      <div className="firma-linea" />
      <div className="firma-acciones">
        <span className="vacio" style={{ padding: 0 }}>
          {tieneTrazo ? 'Firma capturada' : 'Firme con el mouse, el dedo o el lápiz óptico'}
        </span>
        <button type="button" className="link" onClick={limpiar} disabled={!tieneTrazo}>
          Limpiar
        </button>
      </div>
    </div>
  );
}
