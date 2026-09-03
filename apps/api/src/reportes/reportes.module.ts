import { Controller, Get, Module, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { ReportesService } from './reportes.service';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';
import { BitacoraService } from '../bitacora/bitacora.service';

@ApiTags('reportes')
@ApiBearerAuth()
@Controller('reportes')
@Roles(ROLES.JEFE, ROLES.RADICADOR, ROLES.AUDITOR, ROLES.ARCHIVISTA)
class ReportesController {
  constructor(
    private readonly reportes: ReportesService,
    private readonly bitacora: BitacoraService,
  ) {}

  @Get(':tipo')
  @ApiOperation({
    summary:
      'Genera un reporte (formato=json|xlsx). Tipos: recibidos, enviados, pendientes, vencidos, ' +
      'por-dependencia, por-funcionario, tiempo-respuesta, derechos-peticion, documentos-por-serie, anulados',
  })
  async generar(
    @Param('tipo') tipo: string,
    @Auditoria() ctx: AuditCtx,
    @Res({ passthrough: true }) res: Response,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('dependenciaId') dependenciaId?: string,
    @Query('vigencia') vigencia?: string,
    @Query('formato') formato?: string,
  ) {
    const filtro = {
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
      dependenciaId,
      vigencia: vigencia ? Number(vigencia) : undefined,
    };
    const reporte = await this.reportes.generar(tipo, filtro);

    await this.bitacora.registrar({
      ctx,
      entidad: 'reporte',
      entidadId: tipo,
      accion: 'EXPORTAR',
      despues: { formato: formato ?? 'json', filas: reporte.filas.length },
    });

    if (formato === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(reporte.titulo.slice(0, 31));
      ws.addRow([reporte.titulo]);
      ws.addRow([`Generado: ${reporte.generado}`]);
      ws.addRow([]);
      ws.addRow(reporte.columnas);
      ws.getRow(4).font = { bold: true };
      reporte.filas.forEach((f) => ws.addRow(f));
      ws.columns.forEach((c) => (c.width = 22));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="reporte-${tipo}-${Date.now()}.xlsx"`,
      );
      const buffer = await wb.xlsx.writeBuffer();
      res.end(Buffer.from(buffer));
      return;
    }

    return reporte;
  }
}

@Module({
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
