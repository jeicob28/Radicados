import { useLayoutEffect, useRef, useState } from 'react';

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
  // Justo al soltar el trazo, algunos navegadores disparan un "click"
  // adicional que puede terminar cayendo sobre "Limpiar" (que se acaba de
  // habilitar) en vez de sobre el lienzo, borrando la firma recién hecha.
  // Este candado ignora cualquier click sobre "Limpiar" en la fracción de
  // segundo posterior a terminar de dibujar; un click deliberado del
  // usuario, un momento después, sigue funcionando con normalidad.
  const bloquearLimpiar = useRef(false);
  const bloquearLimpiarTimeout = useRef<number | undefined>(undefined);

  // El lienzo se dibuja en su tamaño real en pantalla (el CSS lo estira a
  // 100% del ancho del formulario), no en el tamaño fijo por defecto de un
  // <canvas> (300×150) ni en un ancho fijo distinto al del CSS. Sin esto,
  // los trazos se calculan en píxeles de pantalla pero se pintan en un
  // lienzo de otro tamaño: al firmar, buena parte del trazo cae fuera del
  // lienzo real y no se ve nada, como si "se borrara" al soltar el mouse.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    canvas.getContext('2d')?.scale(ratio, ratio);
  }, []);

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
  };

  const terminar = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    bloquearLimpiar.current = true;
    window.clearTimeout(bloquearLimpiarTimeout.current);
    bloquearLimpiarTimeout.current = window.setTimeout(() => {
      bloquearLimpiar.current = false;
    }, 300);
    setTieneTrazo(true);
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
    if (bloquearLimpiar.current) return;
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
