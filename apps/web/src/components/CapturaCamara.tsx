import { useEffect, useRef, useState } from 'react';
import { Boton, Modal } from '../ui';

interface Props {
  titulo?: string;
  onCapturar: (file: File) => void;
  onClose: () => void;
}

/**
 * Captura una foto con la cámara (webcam USB en PC, cámara del móvil).
 * getUserMedia exige un "contexto seguro" (HTTPS, o localhost): si el navegador
 * no lo permite, cae automáticamente al selector nativo de archivo/cámara del
 * sistema operativo, que sí funciona sobre HTTP (típico en un móvil).
 */
export default function CapturaCamara({ titulo = 'Tomar foto', onCapturar, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [dispositivos, setDispositivos] = useState<MediaDeviceInfo[]>([]);
  const [dispositivoId, setDispositivoId] = useState<string>('');
  const [foto, setFoto] = useState<string | null>(null); // data URL de la captura
  const [modoNativo, setModoNativo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detenerStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const iniciarCamara = async (deviceId?: string) => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' },
        audio: false,
      });
      detenerStream();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      const lista = await navigator.mediaDevices.enumerateDevices();
      setDispositivos(lista.filter((d) => d.kind === 'videoinput'));
    } catch (e) {
      setError(
        'No se pudo acceder a la cámara en vivo (' +
          (e instanceof Error ? e.message : String(e)) +
          '). Puede deberse a permisos o a que el sitio no usa HTTPS.',
      );
      setModoNativo(true);
    }
  };

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setModoNativo(true);
      return;
    }
    iniciarCamara();
    return () => detenerStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capturar = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    setFoto(canvas.toDataURL('image/jpeg', 0.9));
  };

  const usarFoto = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapturar(new File([blob], `captura-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        detenerStream();
        onClose();
      },
      'image/jpeg',
      0.9,
    );
  };

  const archivoNativo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      onCapturar(f);
      onClose();
    }
  };

  return (
    <Modal title={titulo} onClose={() => { detenerStream(); onClose(); }}>
      {modoNativo ? (
        <>
          {error && <p className="vacio" style={{ color: 'var(--crit)' }}>{error}</p>}
          <p className="vacio" style={{ padding: '4px 0 12px', textAlign: 'left' }}>
            En un móvil esto abre la cámara del equipo directamente.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={archivoNativo}
          />
        </>
      ) : (
        <>
          {dispositivos.length > 1 && (
            <label className="field">
              <span>Cámara</span>
              <select
                value={dispositivoId}
                onChange={(e) => {
                  setDispositivoId(e.target.value);
                  iniciarCamara(e.target.value);
                }}
              >
                <option value="">Predeterminada</option>
                {dispositivos.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Cámara ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="camara-visor">
            {!foto && <video ref={videoRef} autoPlay playsInline muted />}
            {foto && <img src={foto} alt="Captura" />}
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div className="modal-acciones">
            {!foto ? (
              <Boton onClick={capturar}>Capturar</Boton>
            ) : (
              <>
                <Boton variante="ghost" onClick={() => setFoto(null)}>
                  Repetir
                </Boton>
                <Boton onClick={usarFoto}>Usar esta foto</Boton>
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
