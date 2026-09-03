import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Protege endpoints internos invocados por el `worker` (no por usuarios).
 * Exige la cabecera X-Internal-Token con el valor de INTERNAL_TOKEN.
 * Combínalo con @Public() para saltar la autenticación JWT.
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const esperado = process.env.INTERNAL_TOKEN;
    if (!esperado) throw new ForbiddenException('INTERNAL_TOKEN no configurado');
    const req = ctx.switchToHttp().getRequest();
    if (req.headers['x-internal-token'] !== esperado) {
      throw new ForbiddenException('Token interno inválido');
    }
    return true;
  }
}
