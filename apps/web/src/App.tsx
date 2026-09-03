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
import { api } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Radicar from './pages/Radicar';
import Consulta from './pages/Consulta';
import RadicadoDetalle from './pages/RadicadoDetalle';
import Bandeja from './pages/Bandeja';
import { ExpedienteDetalle, ExpedientesLista } from './pages/Expedientes';
import Bitacora from './pages/Bitacora';
import Reportes from './pages/Reportes';

const NAV = [
  { to: '/', label: 'Panel', icon: '▤', roles: [] as string[] },
  { to: '/radicar', label: 'Radicar', icon: '＋', roles: ['VENTANILLA', 'FUNCIONARIO', 'RADICADOR', 'JEFE'] },
  { to: '/consulta', label: 'Consulta', icon: '⌕', roles: [] },
  { to: '/bandeja', label: 'Mi bandeja', icon: '☰', roles: ['FUNCIONARIO', 'JEFE'] },
  { to: '/expedientes', label: 'Expedientes', icon: '▦', roles: [] },
  { to: '/reportes', label: 'Reportes', icon: '▧', roles: ['JEFE', 'RADICADOR', 'AUDITOR', 'ARCHIVISTA'] },
  { to: '/bitacora', label: 'Auditoría', icon: '⛨', roles: ['AUDITOR'] },
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
          <span className="mark">SGDEA</span>
        </div>
        <nav>
          {NAV.filter((n) => n.roles.length === 0 || tieneRol(...n.roles)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              <span className="ico">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
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
      <main>{children}</main>
    </div>
  );
}

function Privado() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="loading">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/radicar" element={<Radicar />} />
        <Route path="/consulta" element={<Consulta />} />
        <Route path="/radicados/:numero" element={<RadicadoDetalle />} />
        <Route path="/bandeja" element={<Bandeja />} />
        <Route path="/expedientes" element={<ExpedientesLista />} />
        <Route path="/expedientes/:numero" element={<ExpedienteDetalle />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/bitacora" element={<Bitacora />} />
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
