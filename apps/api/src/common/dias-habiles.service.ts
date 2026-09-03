import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Cálculo de términos en días hábiles usando el calendario de festivos (tabla `festivo`)
 * y los parámetros `jornada.dias_habiles` y `plazos.dias_habiles`.
 */
@Injectable()
export class DiasHabilesService {
  private cache?: { cargadoEn: number; habiles: Set<number>; festivos: Set<string> };

  constructor(private readonly prisma: PrismaService) {}

  private clave(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private async cargar() {
    if (this.cache && Date.now() - this.cache.cargadoEn < 5 * 60 * 1000) return this.cache;

    const [paramHabiles, festivos] = await Promise.all([
      this.prisma.parametro.findUnique({ where: { clave: 'jornada.dias_habiles' } }),
      this.prisma.festivo.findMany({ select: { fecha: true } }),
    ]);

    const habiles = new Set<number>(
      (Array.isArray(paramHabiles?.valor) ? (paramHabiles!.valor as number[]) : [1, 2, 3, 4, 5]),
    );
    this.cache = {
      cargadoEn: Date.now(),
      habiles,
      festivos: new Set(festivos.map((f) => this.clave(f.fecha))),
    };
    return this.cache;
  }

  private esHabil(d: Date, c: { habiles: Set<number>; festivos: Set<string> }): boolean {
    const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    return c.habiles.has(dow) && !c.festivos.has(this.clave(d));
  }

  /** Suma `n` días hábiles a `desde` (sin contar el día de radicación). */
  async sumarHabiles(desde: Date, n: number): Promise<Date> {
    const c = await this.cargar();
    let fecha = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate()));
    let contados = 0;
    while (contados < n) {
      fecha = new Date(fecha.getTime() + DIA_MS);
      if (this.esHabil(fecha, c)) contados++;
    }
    return fecha;
  }

  /** Días hábiles entre hoy y `hasta` (negativo si ya venció). */
  async habilesRestantes(hasta: Date, ref = new Date()): Promise<number> {
    const c = await this.cargar();
    const fin = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate()));
    let cur = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
    if (fin.getTime() === cur.getTime()) return 0;

    const signo = fin > cur ? 1 : -1;
    let dias = 0;
    while (cur.getTime() !== fin.getTime()) {
      cur = new Date(cur.getTime() + signo * DIA_MS);
      if (this.esHabil(cur, c)) dias += signo;
    }
    return dias;
  }

  /** Plazo legal (días hábiles) configurado para un tipo de comunicación. */
  async plazoPara(tipoComunicacion: string): Promise<number | null> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: 'plazos.dias_habiles' } });
    const mapa = (p?.valor ?? {}) as Record<string, number>;
    const dias = mapa[tipoComunicacion];
    return dias && dias > 0 ? dias : null;
  }

  async umbralesAlerta(): Promise<{ amarillo: number; rojo: number }> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: 'alertas.dias_habiles' } });
    const v = (p?.valor ?? {}) as { amarillo?: number; rojo?: number };
    return { amarillo: v.amarillo ?? 5, rojo: v.rojo ?? 2 };
  }
}
