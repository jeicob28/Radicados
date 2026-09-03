import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export interface UsuarioActual {
  id: string;
  email: string;
  nombre: string;
  roles: string[];
  dependenciaId: string | null;
}

/** Inyecta el usuario autenticado (payload del JWT) en el parámetro del handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioActual => {
    return ctx.switchToHttp().getRequest().user;
  },
);

export interface AuditCtx {
  usuario?: UsuarioActual;
  ip?: string;
  userAgent?: string;
}

/** Extrae el contexto de auditoría (usuario + IP + user-agent) de la petición. */
export const Auditoria = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuditCtx => {
    const req = ctx.switchToHttp().getRequest();
    return {
      usuario: req.user,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    };
  },
);
