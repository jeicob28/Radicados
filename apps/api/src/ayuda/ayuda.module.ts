import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';

const PARAM_MANUALES = 'ayuda.manuales';
const PARAM_MANUAL_URL = 'ayuda.manual_url';
const MANUAL_URL_DEFECTO = 'https://claude.ai/code/artifact/172348b8-1c3c-4ab6-a7ce-282ccc4b149e';
const MAX_BYTES = 25 * 1024 * 1024;
const TIPOS_OK = [
  'application/pdf',
  'text/html',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
];

interface Manual {
  id: string;
  nombre: string;
  descripcion: string | null;
  archivo: string; // objectKey en MinIO
  nombreArchivo: string;
  contentType: string;
  tamanoBytes: number;
  subidoEn: string;
  subidoPor: string | null;
}

class MetaManualDto {
  @IsString() @MaxLength(160) nombre!: string;
  @IsOptional() @IsString() @MaxLength(500) descripcion?: string;
}
class ActualizarManualDto {
  @IsOptional() @IsString() @MaxLength(160) nombre?: string;
  @IsOptional() @IsString() @MaxLength(500) descripcion?: string;
}
class ManualUrlDto {
  @IsUrl({ require_tld: false }) url!: string;
}

@Injectable()
export class AyudaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly bitacora: BitacoraService,
  ) {}

  private async leer(): Promise<Manual[]> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: PARAM_MANUALES } });
    const v = p?.valor;
    return Array.isArray(v) ? (v as unknown as Manual[]) : [];
  }

  private async guardar(lista: Manual[]) {
    await this.prisma.parametro.upsert({
      where: { clave: PARAM_MANUALES },
      update: { valor: lista as never },
      create: { clave: PARAM_MANUALES, valor: lista as never, descripcion: 'Manuales y documentos del centro de ayuda' },
    });
  }

  async manualUrl(): Promise<string> {
    const p = await this.prisma.parametro.findUnique({ where: { clave: PARAM_MANUAL_URL } });
    return typeof p?.valor === 'string' && p.valor ? p.valor : MANUAL_URL_DEFECTO;
  }

  async setManualUrl(url: string, ctx: AuditCtx) {
    await this.prisma.parametro.upsert({
      where: { clave: PARAM_MANUAL_URL },
      update: { valor: url as never },
      create: { clave: PARAM_MANUAL_URL, valor: url as never, descripcion: 'Enlace al manual en línea' },
    });
    await this.bitacora.registrar({ ctx, entidad: 'ayuda', entidadId: PARAM_MANUAL_URL, accion: 'ACTUALIZAR', despues: { url } });
    return { url };
  }

  async listar() {
    const manuales = (await this.leer())
      .map(({ archivo, ...resto }) => resto) // no exponer la ruta interna de MinIO
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return { manuales, manualEnLineaUrl: await this.manualUrl() };
  }

  async subir(file: Express.Multer.File, dto: MetaManualDto, ctx: AuditCtx) {
    if (!file?.buffer?.length) throw new BadRequestException('No se recibió ningún archivo');
    if (file.size > MAX_BYTES) throw new BadRequestException('El archivo supera los 25 MB');
    const tipo = file.mimetype || 'application/octet-stream';
    if (!TIPOS_OK.includes(tipo)) {
      throw new BadRequestException('Tipo de archivo no permitido (PDF, Word, texto, HTML o imagen)');
    }
    const id = randomUUID();
    const limpio = (file.originalname || 'manual').replace(/[^\w.\- ]+/g, '_').slice(-120);
    const objectKey = `ayuda/${id}-${limpio}`;
    const { tamanoBytes } = await this.storage.subir(objectKey, file.buffer, tipo);

    const manual: Manual = {
      id,
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion?.trim() || null,
      archivo: objectKey,
      nombreArchivo: limpio,
      contentType: tipo,
      tamanoBytes,
      subidoEn: new Date().toISOString(),
      subidoPor: ctx.usuario?.nombre ?? null,
    };
    const lista = await this.leer();
    lista.push(manual);
    await this.guardar(lista);
    await this.bitacora.registrar({
      ctx,
      entidad: 'ayuda',
      entidadId: id,
      accion: 'CREAR',
      despues: { nombre: manual.nombre, nombreArchivo: limpio, tamanoBytes },
    });
    const { archivo, ...pub } = manual;
    return pub;
  }

  async actualizar(id: string, dto: ActualizarManualDto, ctx: AuditCtx) {
    const lista = await this.leer();
    const m = lista.find((x) => x.id === id);
    if (!m) throw new NotFoundException('El documento no existe');
    if (dto.nombre !== undefined) m.nombre = dto.nombre.trim();
    if (dto.descripcion !== undefined) m.descripcion = dto.descripcion.trim() || null;
    await this.guardar(lista);
    await this.bitacora.registrar({ ctx, entidad: 'ayuda', entidadId: id, accion: 'ACTUALIZAR', despues: { nombre: m.nombre } });
    const { archivo, ...pub } = m;
    return pub;
  }

  async eliminar(id: string, ctx: AuditCtx) {
    const lista = await this.leer();
    const m = lista.find((x) => x.id === id);
    if (!m) throw new NotFoundException('El documento no existe');
    await this.storage.client.removeObject(this.storage.bucket, m.archivo).catch(() => undefined);
    await this.guardar(lista.filter((x) => x.id !== id));
    await this.bitacora.registrar({ ctx, entidad: 'ayuda', entidadId: id, accion: 'ANULAR', antes: { nombre: m.nombre } });
    return { ok: true };
  }

  async descargar(id: string, res: Response) {
    const m = (await this.leer()).find((x) => x.id === id);
    if (!m) throw new NotFoundException('El documento no existe');
    const stream = await this.storage.descargar(m.archivo);
    const inline = m.contentType === 'application/pdf' || m.contentType.startsWith('image/') || m.contentType === 'text/html';
    res.setHeader('Content-Type', m.contentType);
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(m.nombreArchivo)}"`,
    );
    stream.pipe(res);
  }
}

@ApiTags('ayuda')
@ApiBearerAuth()
@Controller('ayuda')
export class AyudaController {
  constructor(private readonly ayuda: AyudaService) {}

  @Get('manuales')
  @ApiOperation({ summary: 'Lista los manuales y documentos del centro de ayuda' })
  listar() {
    return this.ayuda.listar();
  }

  @Get('manuales/:id/descargar')
  @ApiOperation({ summary: 'Descarga o muestra un documento de ayuda' })
  descargar(@Param('id') id: string, @Res() res: Response) {
    return this.ayuda.descargar(id, res);
  }

  @Post('manuales')
  @Roles(ROLES.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Sube un manual o documento de ayuda (PDF, Word, HTML…)' })
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES } }))
  subir(@UploadedFile() archivo: Express.Multer.File, @Body() dto: MetaManualDto, @Auditoria() ctx: AuditCtx) {
    return this.ayuda.subir(archivo, dto, ctx);
  }

  @Patch('manuales/:id')
  @Roles(ROLES.ADMIN)
  @ApiOperation({ summary: 'Renombra o cambia la descripción de un documento' })
  actualizar(@Param('id') id: string, @Body() dto: ActualizarManualDto, @Auditoria() ctx: AuditCtx) {
    return this.ayuda.actualizar(id, dto, ctx);
  }

  @Delete('manuales/:id')
  @Roles(ROLES.ADMIN)
  @ApiOperation({ summary: 'Elimina un documento de ayuda' })
  eliminar(@Param('id') id: string, @Auditoria() ctx: AuditCtx) {
    return this.ayuda.eliminar(id, ctx);
  }

  @Patch('manual-url')
  @Roles(ROLES.ADMIN)
  @ApiOperation({ summary: 'Fija el enlace al manual en línea' })
  setUrl(@Body() dto: ManualUrlDto, @Auditoria() ctx: AuditCtx) {
    return this.ayuda.setManualUrl(dto.url, ctx);
  }
}

@Module({
  controllers: [AyudaController],
  providers: [AyudaService],
})
export class AyudaModule {}
