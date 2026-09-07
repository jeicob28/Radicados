// Cliente HTTP del SGDEA. Guarda el access token en memoria; el refresh vive en
// una cookie httpOnly y se rota de forma transparente ante un 401.

let accessToken: string | null = null;
const listeners = new Set<() => void>();

export function setToken(t: string | null) {
  accessToken = t;
  listeners.forEach((l) => l());
}
export function getToken() {
  return accessToken;
}
export function onAuthChange(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---- modo mantenimiento (la API responde 503 con { mantenimiento: true }) ----
let enMantenimiento = false;
let motivoMantenimiento = '';
const mantListeners = new Set<() => void>();
export function mantenimientoActivo() {
  return enMantenimiento;
}
export function mantenimientoMotivo() {
  return motivoMantenimiento;
}
export function onMantenimiento(l: () => void) {
  mantListeners.add(l);
  return () => mantListeners.delete(l);
}
function setMantenimiento(activo: boolean, motivo = '') {
  if (activo === enMantenimiento && motivo === motivoMantenimiento) return;
  enMantenimiento = activo;
  motivoMantenimiento = motivo;
  mantListeners.forEach((l) => l());
}

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function raw(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(BASE + path, { ...init, headers, credentials: 'include' });

  if (res.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/login') {
    const ok = await tryRefresh();
    if (ok) return raw(path, init, false);
  }
  return res;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await raw(path, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (res.status === 503 && data?.mantenimiento) {
    setMantenimiento(true, typeof data.message === 'string' ? data.message : '');
  } else if (res.ok) {
    setMantenimiento(false);
  }
  if (!res.ok) {
    const msg = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(' · ')
        : data.message
      : `Error ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export async function download(path: string, filename: string) {
  const res = await raw(path);
  if (!res.ok) throw new ApiError(res.status, 'No se pudo descargar');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Como `download`, pero para mostrar el archivo inline (p. ej. una firma en un <img>)
 * en vez de forzar la descarga. Quien la llama debe revocar la URL cuando ya no la use. */
export async function blobUrl(path: string): Promise<string> {
  const res = await raw(path);
  if (!res.ok) throw new ApiError(res.status, 'No se pudo cargar el archivo');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(BASE + '/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) {
      setToken(null);
      return false;
    }
    const data = await res.json();
    setToken(data.accessToken);
    return true;
  } catch {
    setToken(null);
    return false;
  }
}

export async function bootstrapSession(): Promise<Usuario | null> {
  const ok = await tryRefresh();
  if (!ok) return null;
  try {
    return await api<Usuario>('/auth/me');
  } catch {
    return null;
  }
}

// ---- tipos ----
export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  roles: string[];
  dependenciaId: string | null;
  debeCambiarPassword: boolean;
  mfaHabilitado?: boolean;
}

export interface RadicadoLista {
  numero: string;
  asunto: string;
  tipo: string;
  estado: string;
  tipoComunicacion: string;
  nivelAlerta: string;
  fechaHoraRadicacion: string;
  fechaVencimiento: string | null;
  tercero?: { nombre: string } | null;
  dependencia?: { codigo: string; nombre: string } | null;
  funcionario?: { nombre: string } | null;
  _count?: { anexos: number };
}
