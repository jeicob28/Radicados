import { useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { Boton, ErrorMsg, Field } from '../ui';
import PieDePagina from '../components/PieDePagina';

export default function CambiarPasswordForzado() {
  const { usuario, logout, refrescarPerfil } = useAuth();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (nueva !== confirmar) return setError('Las contraseñas no coinciden');
    setEnviando(true);
    try {
      await api('/auth/cambiar-password', { method: 'POST', body: JSON.stringify({ actual, nueva }) });
      await refrescarPerfil();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login card" onSubmit={submit}>
        <div className="brand">
          <img src="/cootracir.png" alt="Cootracir" className="marca-logo lg" />
          <div>
            <h1>Cambio de contraseña obligatorio</h1>
            <p>{usuario?.nombre} — por política de seguridad debes actualizarla antes de continuar.</p>
          </div>
        </div>
        <Field label="Contraseña actual">
          <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} required autoFocus />
        </Field>
        <Field label="Nueva contraseña">
          <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} required />
        </Field>
        <Field label="Confirmar nueva contraseña">
          <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
        </Field>
        {error && <ErrorMsg>{error}</ErrorMsg>}
        <Boton tipo="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Cambiar contraseña'}
        </Boton>
        <button type="button" className="link" onClick={logout} style={{ marginTop: 4 }}>
          Cerrar sesión
        </button>
      </form>
      <PieDePagina compacto />
    </div>
  );
}
