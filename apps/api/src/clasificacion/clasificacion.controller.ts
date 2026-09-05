import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrdService } from './trd.service';
import { ExpedientesService } from './expedientes.service';
import { ClasificacionService } from './clasificacion.service';
import {
  ActualizarSerieDto,
  ClasificarRadicadoDto,
  CrearExpedienteDto,
  CrearSerieDto,
  CrearSubserieDto,
  CrearTipoDocumentalDto,
  IncorporarDocumentoDto,
} from './dto';
import { Auditoria, CurrentUser, Roles } from '../auth/decorators';
import type { AuditCtx, UsuarioActual } from '../auth/decorators';
import { ROLES } from '../auth/roles';

@ApiTags('gestión documental')
@ApiBearerAuth()
@Controller()
export class ClasificacionController {
  constructor(
    private readonly trd: TrdService,
    private readonly expedientes: ExpedientesService,
    private readonly clasificacion: ClasificacionService,
  ) {}

  // ---- TRD / cuadro de clasificación --------------------------------------
  @Get('trd')
  @ApiOperation({ summary: 'Cuadro de clasificación documental con reglas de retención' })
  cuadro() {
    return this.trd.cuadro();
  }

  @Get('series')
  listarSeries(@Query('dependenciaId') dependenciaId?: string) {
    return this.trd.listarSeries(dependenciaId);
  }

  @Post('series')
  @Roles(ROLES.ARCHIVISTA)
  crearSerie(@Body() dto: CrearSerieDto, @Auditoria() ctx: AuditCtx) {
    return this.trd.crearSerie(dto, ctx);
  }

  @Patch('series/:id')
  @Roles(ROLES.ARCHIVISTA)
  actualizarSerie(@Param('id') id: string, @Body() dto: ActualizarSerieDto, @Auditoria() ctx: AuditCtx) {
    return this.trd.actualizarSerie(id, dto, ctx);
  }

  @Post('series/:id/subseries')
  @Roles(ROLES.ARCHIVISTA)
  crearSubserie(@Param('id') id: string, @Body() dto: CrearSubserieDto, @Auditoria() ctx: AuditCtx) {
    return this.trd.crearSubserie(id, dto, ctx);
  }

  @Get('tipos-documentales')
  listarTipos() {
    return this.trd.listarTiposDocumentales();
  }

  @Post('tipos-documentales')
  @Roles(ROLES.ARCHIVISTA)
  crearTipo(@Body() dto: CrearTipoDocumentalDto, @Auditoria() ctx: AuditCtx) {
    return this.trd.crearTipoDocumental(dto, ctx);
  }

  // ---- Expedientes --------------------------------------------------------
  @Post('expedientes')
  @Roles(ROLES.ARCHIVISTA)
  @ApiOperation({ summary: 'Abre un expediente y genera su número' })
  crearExpediente(@Body() dto: CrearExpedienteDto, @Auditoria() ctx: AuditCtx) {
    return this.expedientes.crear(dto, ctx);
  }

  @Get('expedientes')
  listarExpedientes(
    @CurrentUser() usuario: UsuarioActual,
    @Query('estado') estado?: string,
    @Query('serieId') serieId?: string,
    @Query('dependenciaId') dependenciaId?: string,
    @Query('q') q?: string,
  ) {
    return this.expedientes.listar({ estado, serieId, dependenciaId, q }, usuario);
  }

  @Get('expedientes/:numero')
  obtenerExpediente(@Param('numero') numero: string, @CurrentUser() usuario: UsuarioActual) {
    return this.expedientes.obtener(numero, usuario);
  }

  @Get('expedientes/:numero/indice')
  @ApiOperation({ summary: 'Hoja de control / índice del expediente' })
  indice(@Param('numero') numero: string, @CurrentUser() usuario: UsuarioActual) {
    return this.expedientes.indice(numero, usuario);
  }

  @Post('expedientes/:numero/documentos')
  @Roles(ROLES.ARCHIVISTA, ROLES.FUNCIONARIO, ROLES.JEFE)
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('file'))
  incorporarDocumento(
    @Param('numero') numero: string,
    @Body() dto: IncorporarDocumentoDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.expedientes.incorporarDocumentoSimple(
      numero,
      dto,
      file
        ? { originalname: file.originalname, mimetype: file.mimetype, size: file.size, buffer: file.buffer }
        : undefined,
      ctx,
    );
  }

  @Post('expedientes/:numero/foliar')
  @Roles(ROLES.ARCHIVISTA)
  @ApiOperation({ summary: 'Recalcula el foliado consecutivo del expediente' })
  foliar(@Param('numero') numero: string, @Auditoria() ctx: AuditCtx) {
    return this.expedientes.foliar(numero, ctx);
  }

  @Post('expedientes/:numero/cerrar')
  @Roles(ROLES.ARCHIVISTA)
  @ApiOperation({ summary: 'Cierra el expediente y calcula las fechas límite de retención' })
  cerrarExpediente(@Param('numero') numero: string, @Auditoria() ctx: AuditCtx) {
    return this.expedientes.cerrar(numero, ctx);
  }

  @Post('expedientes/:numero/verificar-integridad')
  @Roles(ROLES.ARCHIVISTA, ROLES.AUDITOR)
  verificarIntegridad(@Param('numero') numero: string, @Auditoria() ctx: AuditCtx) {
    return this.expedientes.verificarIntegridad(numero, ctx);
  }

  // ---- Clasificación de radicados ---------------------------------------
  @Post('radicados/:numero/clasificar')
  @Roles(ROLES.ARCHIVISTA, ROLES.VENTANILLA)
  @ApiOperation({ summary: 'Clasifica el radicado (serie/subserie) y lo incorpora a un expediente' })
  clasificar(
    @Param('numero') numero: string,
    @Body() dto: ClasificarRadicadoDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.clasificacion.clasificar(numero, dto, ctx);
  }
}
