import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { api, mantenimientoActivo, mantenimientoMotivo, onMantenimiento } from './api';
import Login from './pages/Login';
import CambiarPasswordForzado from './pages/CambiarPasswordForzado';
import Dashboard from './pages/Dashboard';
import PieDePagina from './components/PieDePagina';
import Radicar from './pages/Radicar';
import Consulta from './pages/Consulta';
import RadicadoDetalle from './pages/RadicadoDetalle';
import Bandeja from './pages/Bandeja';
import { ExpedienteDetalle, ExpedientesLista } from './pages/Expedientes';
import Bitacora from './pages/Bitacora';
import Reportes from './pages/Reportes';
import Ayuda from './pages/Ayuda';
import MarcoLegal from './pages/MarcoLegal';
import Usuarios from './pages/admin/Usuarios';
import Roles from './pages/admin/Roles';
import Dependencias from './pages/admin/Dependencias';
import Copias from './pages/admin/Copias';

const NAV = [
  { to: '/', label: 'Panel', icon: '▤', roles: [] as string[] },
  // Ventanilla única: solo VENTANILLA radica (ADMIN siempre puede, es
  // superrol — ver tieneRol en auth.tsx), tanto entrada como salida.
  { to: '/radicar', label: 'Radicar', icon: '＋', roles: ['VENTANILLA'] },
  { to: '/consulta', label: 'Consulta', icon: '⌕', roles: [] },
  { to: '/bandeja', label: 'Mi bandeja', icon: '☰', roles: ['FUNCIONARIO', 'JEFE'] },
  { to: '/expedientes', label: 'Expedientes', icon: '▦', roles: [] },
  { to: '/reportes', label: 'Reportes', icon: '▧', roles: ['JEFE', 'RADICADOR', 'AUDITOR', 'ARCHIVISTA'] },
  { to: '/bitacora', label: 'Auditoría', icon: '⛨', roles: ['AUDITOR'] },
  { to: '/ayuda', label: 'Ayuda', icon: '?', roles: [] },
  { to: '/marco-legal', label: 'Marco legal', icon: '§', roles: [] },
];

const NAV_ADMIN = [
  { to: '/admin/usuarios', label: 'Usuarios', icon: '◍' },
  { to: '/admin/roles', label: 'Roles', icon: '◈' },
  { to: '/admin/dependencias', label: 'Dependencias', icon: '◫' },
  { to: '/admin/copias', label: 'Copias de seguridad', icon: '⛁' },
];

function Layout({ children }: { children: React.ReactNode }) {
  const { usuario, logout, tieneRol } = useAuth();
  const [noLeidas, setNoLeidas] = useState(0);
  const loc = useLocation();

  useEffect(() => {
    api<{ noLeidas: number }>('/notificaciones/contador')
      .then((r) => setNoLeidas(r.noLeidas))
      .catch(() => undefined);
  }, [loc.pathname]);

  return (
    <div className="shell">
      <aside>
        <div className="logo">
          <img src="/cootracir.png" alt="Cootracir" className="marca-logo" />
          <div className="marca-txt">
            <strong>Cootracir</strong>
            <span title="Sistema de Gestión de Documentos Electrónicos de Archivo">SGDEA</span>
          </div>
        </div>
        <nav>
          {NAV.filter((n) => n.roles.length === 0 || tieneRol(...n.roles)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              <span className="ico">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
          {tieneRol('ADMIN') && (
            <>
              <div className="nav-sep">Administración</div>
              {NAV_ADMIN.map((n) => (
                <NavLink key={n.to} to={n.to}>
                  <span className="ico">{n.icon}</span>
                  {n.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="user">
          <strong>{usuario?.nombre}</strong>
          <span>{usuario?.roles.join(' · ')}</span>
          {noLeidas > 0 && <span className="badge">{noLeidas} notificación(es)</span>}
          <button className="link" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main>
        {children}
        <PieDePagina />
      </main>
    </div>
  );
}

function SoloAdmin({ children }: { children: React.ReactNode }) {
  const { tieneRol } = useAuth();
  if (!tieneRol('ADMIN')) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function SoloVentanilla({ children }: { children: React.ReactNode }) {
  const { tieneRol } = useAuth();
  if (!tieneRol('VENTANILLA')) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function useMantenimiento() {
  const [, tick] = useState(0);
  useEffect(() => onMantenimiento(() => tick((n) => n + 1)), []);
  return { activo: mantenimientoActivo(), motivo: mantenimientoMotivo() };
}

function PantallaMantenimiento({ motivo }: { motivo: string }) {
  useEffect(() => {
    const t = setInterval(() => {
      api('/notificaciones/contador')
        .then(() => location.reload())
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="login-wrap">
      <div className="card" style={{ maxWidth: 460, textAlign: 'center' }}>
        <img src="/cootracir.png" alt="Cootracir" className="marca-logo" style={{ margin: '0 auto 12px' }} />
        <h2>Sistema en mantenimiento</h2>
        <p className="vacio">
          {motivo || 'Se está realizando una tarea de administración. Vuelve a intentarlo en unos minutos.'}
        </p>
        <button className="btn ghost" onClick={() => location.reload()}>
          Reintentar
        </button>
      </div>
      <PieDePagina compacto />
    </div>
  );
}

function Privado() {
  const { usuario, cargando } = useAuth();
  const mant = useMantenimiento();
  if (cargando) return <div className="loading">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.debeCambiarPassword) return <CambiarPasswordForzado />;
  if (mant.activo && !usuario.roles.includes('ADMIN')) return <PantallaMantenimiento motivo={mant.motivo} />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/radicar" element={<SoloVentanilla><Radicar /></SoloVentanilla>} />
        <Route path="/consulta" element={<Consulta />} />
        <Route path="/radicados/:numero" element={<RadicadoDetalle />} />
        <Route path="/bandeja" element={<Bandeja />} />
        <Route path="/expedientes" element={<ExpedientesLista />} />
        <Route path="/expedientes/:numero" element={<ExpedienteDetalle />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/bitacora" element={<Bitacora />} />
        <Route path="/ayuda" element={<Ayuda />} />
        <Route path="/marco-legal" element={<MarcoLegal />} />
        <Route path="/admin/usuarios" element={<SoloAdmin><Usuarios /></SoloAdmin>} />
        <Route path="/admin/roles" element={<SoloAdmin><Roles /></SoloAdmin>} />
        <Route path="/admin/dependencias" element={<SoloAdmin><Dependencias /></SoloAdmin>} />
        <Route path="/admin/copias" element={<SoloAdmin><Copias /></SoloAdmin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function Root() {
  const { usuario, cargando } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={cargando ? <div className="loading">…</div> : usuario ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/*" element={<Privado />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  );
}
