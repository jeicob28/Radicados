import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';
import { ActualizarConsecutivoDto } from '../radicacion/dto';

@Injectable()
class ConsecutivosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  async listar() {
    const filas = await this.prisma.consecutivo.findMany({
      orderBy: [{ vigencia: 'desc' }, { tipo: 'asc' }],
    });
    return filas.map((c) => ({
      id: c.id,
      vigencia: c.vigencia,
      tipo: c.tipo,
      formato: c.formato,
      ultimoNumero: c.ultimoNumero,
      proximo: c.ultimoNumero + 1,
      contingencia:
        c.rangoContingenciaDesde != null
          ? { desde: c.rangoContingenciaDesde, hasta: c.rangoContingenciaHasta }
          : null,
    }));
  }

  async actualizar(id: string, dto: ActualizarConsecutivoDto, ctx: AuditCtx) {
    const antes = await this.prisma.consecutivo.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Consecutivo no encontrado');

    if (dto.formato && !/\{numero(:06)?\}/.test(dto.formato)) {
      throw new BadRequestException('El formato debe incluir {numero} o {numero:06}');
    }
    const desde = dto.rangoContingenciaDesde ?? antes.rangoContingenciaDesde ?? undefined;
    const hasta = dto.rangoContingenciaHasta ?? antes.rangoContingenciaHasta ?? undefined;
    if (desde != null && hasta != null && desde > hasta) {
      throw new BadRequestException('El rango de contingencia es inválido (desde > hasta)');
    }
    if (desde != null && desde <= antes.ultimoNumero) {
      throw new BadRequestException(
        'El rango de contingencia debe estar por delante del último número usado',
      );
    }

    const actualizado = await this.prisma.consecutivo.update({
      where: { id },
      data: {
        formato: dto.formato ?? antes.formato,
        rangoContingenciaDesde: dto.rangoContingenciaDesde ?? antes.rangoContingenciaDesde,
        rangoContingenciaHasta: dto.rangoContingenciaHasta ?? antes.rangoContingenciaHasta,
      },
    });

    await this.bitacora.registrar({
      ctx,
      entidad: 'consecutivo',
      entidadId: id,
      accion: 'ACTUALIZAR',
      antes: { formato: antes.formato, contingenciaDesde: antes.rangoContingenciaDesde },
      despues: { formato: actualizado.formato, contingenciaDesde: actualizado.rangoContingenciaDesde },
    });

    return actualizado;
  }
}

@ApiTags('radicación')
@ApiBearerAuth()
@Controller('consecutivos')
class ConsecutivosController {
  constructor(private readonly consecutivos: ConsecutivosService) {}

  @Get()
  @ApiOperation({ summary: 'Estado de los consecutivos por vigencia y tipo' })
  listar() {
    return this.consecutivos.listar();
  }

  @Patch(':id')
  @Roles(ROLES.RADICADOR)
  @ApiOperation({ summary: 'Ajusta el formato o el rango de contingencia de un consecutivo' })
  actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarConsecutivoDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.consecutivos.actualizar(id, dto, ctx);
  }
}

@Module({
  controllers: [ConsecutivosController],
  providers: [ConsecutivosService],
})
export class ConsecutivosModule {}
