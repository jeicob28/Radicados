import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Fase 0: registra en el log toda petición que modifica estado.
 * Fase 1: pasará a persistir en la tabla `bitacora` con el contexto de autenticación
 * (usuario, IP, user-agent, antes/después). El hash encadenado ya lo calcula la base
 * de datos (trigger fn_bitacora_hash).
 */
@Injectable()
export class BitacoraInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Bitacora');
  private readonly mutating = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();

    if (!this.mutating.has(req.method)) {
      return next.handle();
    }

    const started = Date.now();
    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `${req.method} ${req.originalUrl} ip=${req.ip} (${Date.now() - started}ms)`,
        );
      }),
    );
  }
}
