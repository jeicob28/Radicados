import { Injectable, Logger } from '@nestjs/common';
import { EstadoRadicado, NivelAlerta } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiasHabilesService } from '../common/dias-habiles.service';

const ABIERTOS: EstadoRadicado[] = [
  EstadoRadicado.RADICADO,
  EstadoRadicado.CLASIFICADO,
  EstadoRadicado.ASIGNADO,
  EstadoRadicado.EN_TRAMITE,
  EstadoRadicado.REABIERTO,
];

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly diasHabiles: DiasHabilesService,
  ) {}

  private nivel(restantes: number, umbral: { amarillo: number; rojo: number }): NivelAlerta {
    if (restantes < 0) return 'VENCIDO';
    if (restantes <= umbral.rojo) return 'ROJO';
    if (restantes <= umbral.amarillo) return 'AMARILLO';
    return 'VERDE';
  }

  /**
   * Recalcula el nivel de alerta y los días hábiles restantes de todos los
   * radicados abiertos con fecha de vencimiento. Genera notificaciones para
   * los que entran en ROJO o VENCIDO.
   */
  async recalcular(): Promise<{ revisados: number; actualizados: number; notificaciones: number }> {
    const umbral = await this.diasHabiles.umbralesAlerta();
    const radicados = await this.prisma.radicado.findMany({
      where: { estado: { in: ABIERTOS }, fechaVencimiento: { not: null } },
      select: {
        id: true,
        numero: true,
        asunto: true,
        fechaVencimiento: true,
        nivelAlerta: true,
        diasHabilesRestantes: true,
        funcionarioId: true,
        dependenciaId: true,
      },
    });

    let actualizados = 0;
    const notificaciones: {
      usuarioId: string;
      tipo: string;
      titulo: string;
      cuerpo: string | null;
      radicadoNumero: string;
    }[] = [];

    for (const r of radicados) {
      const restantes = await this.diasHabiles.habilesRestantes(r.fechaVencimiento!);
      const nuevo = this.nivel(restantes, umbral);
      if (nuevo !== r.nivelAlerta) {
        await this.prisma.radicado.update({
          where: { id: r.id },
          data: { nivelAlerta: nuevo, diasHabilesRestantes: restantes },
        });
        actualizados++;

        if ((nuevo === 'ROJO' || nuevo === 'VENCIDO') && r.funcionarioId) {
          notificaciones.push({
            usuarioId: r.funcionarioId,
            tipo: nuevo === 'VENCIDO' ? 'VENCIDO' : 'VENCIMIENTO_PROXIMO',
            titulo:
              nuevo === 'VENCIDO'
                ? `Radicado ${r.numero} VENCIDO`
                : `Radicado ${r.numero} por vencer (${restantes} día(s) hábiles)`,
            cuerpo: r.asunto,
            radicadoNumero: r.numero,
          });
        }
      } else if (r.diasHabilesRestantes !== restantes) {
        await this.prisma.radicado.update({
          where: { id: r.id },
          data: { diasHabilesRestantes: restantes },
        });
      }
    }

    let creadas = 0;
    if (notificaciones.length) {
      const res = await this.prisma.notificacion.createMany({
        data: notificaciones,
        skipDuplicates: true,
      });
      creadas = res.count;
    }

    this.logger.log(
      `Alertas: ${radicados.length} revisados, ${actualizados} actualizados, ${creadas} notificaciones`,
    );
    return { revisados: radicados.length, actualizados, notificaciones: creadas };
  }
}
