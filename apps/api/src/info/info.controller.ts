import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators';

@ApiTags('sistema')
@Public()
@Controller('info')
export class InfoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Metadatos del sistema y estado de los consecutivos' })
  async info() {
    const [radicados, dependencias, usuarios, consecutivos, festivos] = await Promise.all([
      this.prisma.radicado.count(),
      this.prisma.dependencia.count(),
      this.prisma.usuario.count(),
      this.prisma.consecutivo.findMany({ orderBy: [{ vigencia: 'asc' }, { tipo: 'asc' }] }),
      this.prisma.festivo.count(),
    ]);

    return {
      sistema: 'SGDEA — Radicación y Gestión Documental',
      fase: 'F6 — SGDEA completo',
      normativa: 'Acuerdo 001 de 2024 (AGN)',
      totales: { radicados, dependencias, usuarios, festivos },
      consecutivos: consecutivos.map((c) => ({
        vigencia: c.vigencia,
        tipo: c.tipo,
        formato: c.formato,
        ultimoNumero: c.ultimoNumero,
        contingencia:
          c.rangoContingenciaDesde != null
            ? `${c.rangoContingenciaDesde}-${c.rangoContingenciaHasta}`
            : null,
      })),
    };
  }
}
