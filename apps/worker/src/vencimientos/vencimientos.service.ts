import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Cada hora pide a la API que recalcule el semáforo de cumplimiento y genere
 * las notificaciones de vencimiento. La lógica vive en la API (tiene el acceso
 * a la base de datos y al calendario de festivos); el worker sólo dispara.
 */
@Injectable()
export class VencimientosService {
  private readonly logger = new Logger(VencimientosService.name);
  private readonly apiUrl = process.env.API_INTERNAL_URL ?? 'http://api:3000/api/v1';
  private readonly token = process.env.INTERNAL_TOKEN ?? '';

  @Cron(CronExpression.EVERY_30_MINUTES)
  async recalcularAlertas() {
    if (!this.token) {
      this.logger.warn('INTERNAL_TOKEN no configurado; se omite el recálculo de alertas');
      return;
    }
    try {
      const res = await fetch(`${this.apiUrl}/internal/recalcular-alertas`, {
        method: 'POST',
        headers: { 'X-Internal-Token': this.token },
      });
      if (!res.ok) {
        this.logger.error(`Recálculo de alertas: HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      this.logger.log(
        `Alertas recalculadas: ${data.revisados} revisados, ${data.actualizados} cambios, ${data.notificaciones} notificaciones`,
      );
    } catch (e) {
      this.logger.error(`Recálculo de alertas falló: ${(e as Error).message}`);
    }
  }
}
