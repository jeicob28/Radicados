import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES } from '../auth/roles';

/**
 * Modo mantenimiento. Cuando el parámetro `sistema.mantenimiento` está activo
 * (lo pone el módulo de copias durante una restauración), todo usuario que no
 * sea ADMIN recibe 503 con `mantenimiento: true`. El valor se cachea 5 s para
 * no consultar la BD en cada petición. Se ejecuta después de JwtAuthGuard y
 * RolesGuard: si la ruta es pública no hay `req.user` y se deja pasar.
 */
@Injectable()
export class MantenimientoGuard implements CanActivate {
  private cache: { hasta: number; activo: boolean; motivo?: string } = { hasta: 0, activo: false };

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return true;
    const roles = user.roles ?? [];
    if (roles.includes(ROLES.ADMIN) || roles.includes(ROLES.DEV)) return true;
    // deja pasar identidad/sesión para que la SPA pueda mostrar el aviso
    const ruta: string = req.path ?? req.url ?? '';
    if (ruta.startsWith('/api/v1/auth') || ruta.startsWith('/api/v1/health')) return true;

    const now = Date.now();
    if (now > this.cache.hasta) {
      try {
        const p = await this.prisma.parametro.findUnique({ where: { clave: 'sistema.mantenimiento' } });
        const v = (p?.valor ?? {}) as { activo?: boolean; motivo?: string };
        this.cache = { hasta: now + 5000, activo: !!v.activo, motivo: v.motivo };
      } catch {
        this.cache = { hasta: now + 5000, activo: false };
      }
    }

    if (this.cache.activo) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        mantenimiento: true,
        message:
          this.cache.motivo ||
          'El sistema está temporalmente en mantenimiento. Vuelva a intentarlo en unos minutos.',
      });
    }
    return true;
  }
}
