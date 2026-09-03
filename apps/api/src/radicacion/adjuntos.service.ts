import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StorageService } from '../storage/storage.service';

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const EXT_PERMITIDAS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'doc', 'docx', 'xls', 'xlsx',
  'ppt', 'pptx', 'txt', 'csv', 'zip', 'eml', 'msg', 'xml', 'json',
]);

export interface DescriptorAdjunto {
  objectKey: string;
  nombre: string;
  contentType: string;
  tamanoBytes: number;
  checksumSha256: string;
}

@Injectable()
export class AdjuntosService {
  constructor(private readonly storage: StorageService) {}

  private sanitizar(nombre: string): string {
    return nombre.replace(/[^\w.\- ]+/g, '_').slice(0, 180) || 'adjunto';
  }

  async recibir(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }): Promise<DescriptorAdjunto> {
    if (!file?.buffer?.length) throw new BadRequestException('Archivo vacío');
    if (file.size > MAX_BYTES) throw new BadRequestException('El archivo supera 50 MB');

    const nombre = this.sanitizar(file.originalname);
    const ext = nombre.includes('.') ? nombre.split('.').pop()!.toLowerCase() : '';
    if (ext && !EXT_PERMITIDAS.has(ext)) {
      throw new BadRequestException(`Tipo de archivo no permitido: .${ext}`);
    }

    const anio = new Date().getUTCFullYear();
    const objectKey = `adjuntos/${anio}/${randomUUID()}/${nombre}`;
    const res = await this.storage.subir(objectKey, file.buffer, file.mimetype);

    return {
      objectKey: res.objectKey,
      nombre,
      contentType: file.mimetype,
      tamanoBytes: res.tamanoBytes,
      checksumSha256: res.checksumSha256,
    };
  }
}
