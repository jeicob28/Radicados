import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import IORedis from 'ioredis';
import { Queue, Worker } from 'bullmq';

export const COLA_VENCIMIENTOS = 'radicados-vencimientos';

/**
 * Establece la conexión con Redis y registra los procesadores de las colas.
 * Fase 0: sólo verifica conectividad y procesa trabajos de prueba.
 */
@Injectable()
export class ColasService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ColasService.name);
  private connection?: IORedis;
  private queue?: Queue;
  private worker?: Worker;

  async onModuleInit() {
    const url = process.env.REDIS_URL ?? 'redis://redis:6379';
    this.connection = new IORedis(url, { maxRetriesPerRequest: null });

    this.queue = new Queue(COLA_VENCIMIENTOS, { connection: this.connection });
    this.worker = new Worker(
      COLA_VENCIMIENTOS,
      async (job) => {
        this.logger.log(`Procesando trabajo "${job.name}" (${job.id})`);
      },
      { connection: this.connection },
    );

    this.worker.on('failed', (job, err) =>
      this.logger.error(`Trabajo ${job?.id} falló: ${err.message}`),
    );

    this.logger.log(`Conectado a Redis (${url}); cola "${COLA_VENCIMIENTOS}" lista`);
  }

  getQueue(): Queue | undefined {
    return this.queue;
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }
}
