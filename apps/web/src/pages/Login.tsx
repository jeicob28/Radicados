import { useState } from 'react';
import { useAuth } from '../auth';
import { ApiError } from '../api';
import { Boton, ErrorMsg, Field } from '../ui';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pideMfa, setPideMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await login(email, password, codigo || undefined);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      if (/MFA/i.test(msg)) setPideMfa(true);
      setError(msg);
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
            <h1>Cootracir · SGDEA</h1>
            <p>Cooperativa Integral de Transportadores de Circasia</p>
          </div>
        </div>

        <Field label="Correo">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Contraseña">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {pideMfa && (
          <Field label="Código del autenticador" hint="6 dígitos">
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" maxLength={6} />
          </Field>
        )}

        {error && <ErrorMsg>{error}</ErrorMsg>}
        <Boton tipo="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Boton>
      </form>
    </div>
  );
}
