import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RadicacionService } from './radicacion.service';
import { AdjuntosService } from './adjuntos.service';
import { AnularRadicadoDto, RadicarDto } from './dto';
import { Auditoria, CurrentUser, Roles } from '../auth/decorators';
import type { AuditCtx, UsuarioActual } from '../auth/decorators';
import { ROLES } from '../auth/roles';
import { BitacoraService } from '../bitacora/bitacora.service';
import { StorageService } from '../storage/storage.service';

@ApiTags('radicación')
@ApiBearerAuth()
@Controller('radicados')
export class RadicacionController {
  constructor(
    private readonly radicacion: RadicacionService,
    private readonly adjuntos: AdjuntosService,
    private readonly bitacora: BitacoraService,
    private readonly storage: StorageService,
  ) {}

  @Post('adjuntos')
  @Roles(ROLES.VENTANILLA)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Sube uno o varios archivos y devuelve sus descriptores (con checksum)' })
  @UseInterceptors(FilesInterceptor('files', 20))
  async subirAdjuntos(@UploadedFiles() files: Express.Multer.File[]) {
    const descriptores = await Promise.all(
      (files ?? []).map((f) =>
        this.adjuntos.recibir({
          originalname: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
          buffer: f.buffer,
        }),
      ),
    );
    return { adjuntos: descriptores };
  }

  @Post()
  @Roles(ROLES.VENTANILLA)
  @ApiOperation({
    summary:
      'Radica una comunicación (asigna consecutivo en transacción SERIALIZABLE). ' +
      'Ventanilla única: centraliza tanto la entrada como la salida (respuestas).',
  })
  radicar(@Body() dto: RadicarDto, @Auditoria() ctx: AuditCtx) {
    return this.radicacion.radicar(dto, ctx);
  }

  @Get()
  @ApiOperation({
    summary:
      'Consulta de radicados (número, asunto, remitente, estado, fechas…). ' +
      'Quien no tenga visibilidad total solo ve los de su propia dependencia.',
  })
  listar(
    @CurrentUser() usuario: UsuarioActual,
    @Query('q') q?: string,
    @Query('tipo') tipo?: string,
    @Query('estado') estado?: string,
    @Query('tipoComunicacion') tipoComunicacion?: string,
    @Query('dependenciaId') dependenciaId?: string,
    @Query('vigencia') vigencia?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('vencidos') vencidos?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.radicacion.listar(
      {
        q,
        tipo,
        estado,
        tipoComunicacion,
        dependenciaId,
        vigencia: vigencia ? Number(vigencia) : undefined,
        desde: desde ? new Date(desde) : undefined,
        hasta: hasta ? new Date(hasta) : undefined,
        soloVencidos: vencidos === 'true',
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
      usuario,
    );
  }

  @Get(':numero')
  obtener(@Param('numero') numero: string, @CurrentUser() usuario: UsuarioActual) {
    return this.radicacion.obtener(numero, usuario);
  }

  @Get(':numero/trazabilidad')
  trazabilidad(@Param('numero') numero: string, @CurrentUser() usuario: UsuarioActual) {
    return this.radicacion.trazabilidad(numero, usuario);
  }

  @Post(':numero/anulacion')
  @Roles(ROLES.RADICADOR)
  @ApiOperation({ summary: 'Anula un radicado conservando la evidencia y la justificación' })
  anular(
    @Param('numero') numero: string,
    @Body() dto: AnularRadicadoDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.radicacion.anular(numero, dto, ctx);
  }

  @Get(':numero/adjuntos/:anexoId/descarga')
  @ApiOperation({ summary: 'Descarga un anexo (queda registrado en la bitácora)' })
  async descargarAdjunto(
    @Param('numero') numero: string,
    @Param('anexoId') anexoId: string,
    @Auditoria() ctx: AuditCtx,
    @Res() res: Response,
  ) {
    const r = await this.radicacion.obtener(numero, ctx.usuario);
    const anexo = r.anexos.find((a) => a.id === anexoId);
    if (!anexo) {
      res.status(404).json({ message: 'Anexo no encontrado' });
      return;
    }
    await this.bitacora.registrar({
      ctx,
      entidad: 'anexo',
      entidadId: anexo.id,
      accion: 'DESCARGAR',
      observacion: `${anexo.nombre} del radicado ${numero}`,
    });
    const stream = await this.storage.descargar(anexo.objectKey);
    res.setHeader('Content-Type', anexo.contentType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(anexo.nombre)}"`);
    stream.pipe(res);
  }
}
