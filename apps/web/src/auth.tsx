import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, bootstrapSession, setToken, type Usuario } from './api';

interface AuthCtx {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string, codigo?: string) => Promise<void>;
  logout: () => Promise<void>;
  refrescarPerfil: () => Promise<void>;
  /** ADMIN y DEV son superroles: satisfacen cualquier requisito de rol. */
  tieneRol: (...roles: string[]) => boolean;
  /** Soporte técnico / superusuario (marca, copias, parámetros, SGSI técnico). */
  esDev: boolean;
}

const Ctx = createContext<AuthCtx>(null as never);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    bootstrapSession().then((u) => {
      setUsuario(u);
      setCargando(false);
    });
  }, []);

  const login = async (email: string, password: string, codigo?: string) => {
    const res = await api<{ accessToken: string; usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, codigo }),
    });
    setToken(res.accessToken);
    setUsuario(res.usuario);
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setToken(null);
    setUsuario(null);
  };

  const refrescarPerfil = async () => {
    setUsuario(await api<Usuario>('/auth/me'));
  };

  const tieneRol = (...roles: string[]) =>
    !!usuario &&
    (usuario.roles.includes('ADMIN') ||
      usuario.roles.includes('DEV') ||
      roles.some((r) => usuario.roles.includes(r)));

  const esDev = usuario?.roles.includes('DEV') ?? false;

  return (
    <Ctx.Provider value={{ usuario, cargando, login, logout, refrescarPerfil, tieneRol, esDev }}>
      {children}
    </Ctx.Provider>
  );
}
