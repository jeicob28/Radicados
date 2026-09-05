import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ApiError } from './api';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(() => {
    setCargando(true);
    setError(null);
    fn()
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(recargar, [recargar]);
  return { data, error, cargando, recargar, setData };
}

const NIVEL: Record<string, { label: string; cls: string }> = {
  VERDE: { label: 'A tiempo', cls: 'ok' },
  AMARILLO: { label: 'Por vencer', cls: 'warn' },
  ROJO: { label: 'Urgente', cls: 'crit' },
  VENCIDO: { label: 'Vencido', cls: 'crit' },
  NA: { label: '—', cls: 'muted' },
};

export function Alerta({ nivel }: { nivel: string }) {
  const n = NIVEL[nivel] ?? NIVEL.NA;
  return <span className={`pill ${n.cls}`}>{n.label}</span>;
}

const ESTADO_CLS: Record<string, string> = {
  RADICADO: 'acc',
  CLASIFICADO: 'acc',
  ASIGNADO: 'warn',
  EN_TRAMITE: 'warn',
  RESPONDIDO: 'ok',
  POR_COMUNICAR: 'warn',
  CERRADO: 'ok',
  REABIERTO: 'warn',
  ANULADO: 'crit',
};

export function EstadoPill({ estado }: { estado: string }) {
  return <span className={`pill ${ESTADO_CLS[estado] ?? 'muted'}`}>{estado.replace('_', ' ')}</span>;
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-h">
          {title && <h2>{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <em>{hint}</em>}
    </label>
  );
}

export function Boton({
  children,
  onClick,
  tipo = 'button',
  variante = 'primary',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  tipo?: 'button' | 'submit';
  variante?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <button type={tipo} className={`btn ${variante}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="vacio">{children}</p>;
}

export function ErrorMsg({ children }: { children: ReactNode }) {
  return <div className="error">{children}</div>;
}

export function fechaCorta(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
export function fechaHora(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
