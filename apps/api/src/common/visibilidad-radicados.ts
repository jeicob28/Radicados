import type { UsuarioActual } from '../auth/decorators';
import { ROLES } from '../auth/roles';

/**
 * Roles con visibilidad total sobre los radicados, sin importar la
 * dependencia: VENTANILLA (ventanilla única, recibe y reparte todo),
 * ARCHIVISTA (debe ver lo sin clasificar de cualquier área), AUDITOR
 * (lectura total por definición) y RADICADOR (coordina el consecutivo y
 * anula, función transversal). ADMIN siempre tiene acceso total (superrol,
 * ver RolesGuard) aunque no esté en esta lista. Cualquier otro rol
 * (FUNCIONARIO, JEFE) solo ve lo asignado a su propia dependencia.
 *
 * Ver Requerimientos §21.1 (ventanilla única centralizada).
 */
export const ROLES_VISIBILIDAD_TOTAL: string[] = [
  ROLES.ADMIN,
  ROLES.DEV,
  ROLES.VENTANILLA,
  ROLES.ARCHIVISTA,
  ROLES.AUDITOR,
  ROLES.RADICADOR,
];

/** true si el usuario ve todos los radicados sin importar la dependencia. */
export function tieneVisibilidadTotal(usuario?: UsuarioActual): boolean {
  const roles = usuario?.roles ?? [];
  return ROLES_VISIBILIDAD_TOTAL.some((r) => roles.includes(r));
}

/**
 * Resuelve el alcance de dependencia para un usuario en las consultas de
 * radicados. `undefined` de usuario = llamada interna de confianza (sin
 * restricción). Devuelve:
 *  - `null`  → ve todo (no filtrar por dependencia)
 *  - `''`    → no ve nada (rol restringido sin dependencia asignada)
 *  - string  → solo esa dependencia
 */
export function alcanceDependencia(usuario?: UsuarioActual): string | null {
  if (!usuario || tieneVisibilidadTotal(usuario)) return null;
  return usuario.dependenciaId ?? '';
}

/**
 * ¿Puede este usuario tramitar (aceptar, responder, cerrar, trasladar,
 * devolver) este radicado? Ver Requerimientos §21.2 — aplica a **todos los
 * roles salvo AUDITOR** (que solo entra a validar), sobre los radicados
 * asignados a la persona o a su dependencia. ADMIN siempre puede.
 */
export function puedeTramitar(
  usuario: UsuarioActual | undefined,
  radicado: { dependenciaId: string | null; funcionarioId: string | null },
): boolean {
  const roles = usuario?.roles ?? [];
  if (roles.includes(ROLES.ADMIN) || roles.includes(ROLES.DEV)) return true;
  if (roles.includes(ROLES.AUDITOR)) return false;
  if (!usuario) return false;
  if (radicado.funcionarioId && radicado.funcionarioId === usuario.id) return true;
  return !!usuario.dependenciaId && usuario.dependenciaId === radicado.dependenciaId;
}
