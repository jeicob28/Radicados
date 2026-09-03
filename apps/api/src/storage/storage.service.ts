import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  readonly client: Client;
  readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const s = this.config.get<{
      endpoint: string;
      port: number;
      useSSL: boolean;
      accessKey: string;
      secretKey: string;
      bucket: string;
    }>('storage')!;

    this.bucket = s.bucket;
    this.client = new Client({
      endPoint: s.endpoint,
      port: s.port,
      useSSL: s.useSSL,
      accessKey: s.accessKey,
      secretKey: s.secretKey,
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket creado: ${this.bucket}`);
      } else {
        this.logger.log(`Bucket disponible: ${this.bucket}`);
      }
    } catch (e) {
      this.logger.warn(`MinIO no disponible todavía: ${(e as Error).message}`);
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.bucketExists(this.bucket);
      return true;
    } catch {
      return false;
    }
  }

  /** Sube un buffer y devuelve el checksum SHA-256 calculado. */
  async subir(
    objectKey: string,
    contenido: Buffer,
    contentType = 'application/octet-stream',
  ): Promise<{ objectKey: string; checksumSha256: string; tamanoBytes: number }> {
    const checksumSha256 = createHash('sha256').update(contenido).digest('hex');
    await this.client.putObject(this.bucket, objectKey, contenido, contenido.length, {
      'Content-Type': contentType,
      'x-amz-meta-sha256': checksumSha256,
    });
    return { objectKey, checksumSha256, tamanoBytes: contenido.length };
  }

  async descargar(objectKey: string): Promise<Readable> {
    return this.client.getObject(this.bucket, objectKey);
  }

  async verificarChecksum(objectKey: string, esperado: string): Promise<boolean> {
    const stream = await this.client.getObject(this.bucket, objectKey);
    const hash = createHash('sha256');
    for await (const chunk of stream) hash.update(chunk as Buffer);
    return hash.digest('hex') === esperado;
  }

  urlDescargaTemporal(objectKey: string, segundos = 300): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectKey, segundos);
  }
}
