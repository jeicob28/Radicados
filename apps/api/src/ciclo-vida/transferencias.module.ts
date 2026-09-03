import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';

const TIPOS = ['PRIMARIA', 'SECUNDARIA'] as const;

class CrearTransferenciaDto {
  @ApiProperty({ enum: TIPOS }) @IsEnum(TIPOS) tipo!: (typeof TIPOS)[number];
  @ApiProperty() @IsString() dependenciaOrigenId!: string;

  @ApiProperty({ type: [String], description: 'Números de expedientes cerrados a transferir' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  expedientes!: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() observaciones?: string;
}

class RecibirTransferenciaDto {
  @ApiPropertyOptional() @IsOptional() @IsString() observaciones?: string;
}

@Injectable()
class TransferenciasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  private fmtDate(d: Date | null) {
    return d ? d.toISOString().slice(0, 10) : null;
  }

  async crear(dto: CrearTransferenciaDto, ctx: AuditCtx) {
    const dep = await this.prisma.dependencia.findUnique({ where: { id: dto.dependenciaOrigenId } });
    if (!dep) throw new BadRequestException('Dependencia de origen inexistente');

    const expedientes = await this.prisma.expediente.findMany({
      where: { numero: { in: dto.expedientes } },
      include: { serie: { select: { codigo: true, nombre: true } } },
    });
    if (expedientes.length !== dto.expedientes.length) {
      throw new BadRequestException('Uno o más expedientes no existen');
    }
    const noCerrados = expedientes.filter((e) => e.estado !== 'CERRADO' && e.estado !== 'TRANSFERIDO_CENTRAL');
    if (noCerrados.length) {
      throw new BadRequestException(
        `Solo se transfieren expedientes cerrados. Pendientes: ${noCerrados.map((e) => e.numero).join(', ')}`,
      );
    }

    const anio = new Date().getUTCFullYear();
    const [{ fn_siguiente_secuencia: n }] = await this.prisma.$queryRaw<
      Array<{ fn_siguiente_secuencia: number }>
    >(Prisma.sql`SELECT fn_siguiente_secuencia(${`transf:${anio}`})`);
    const numero = `TRF-${anio}-${String(n).padStart(4, '0')}`;

    const transferencia = await this.prisma.transferencia.create({
      data: {
        numero,
        tipo: dto.tipo,
        dependenciaOrigenId: dto.dependenciaOrigenId,
        elaboradoPorId: ctx.usuario?.id ?? null,
        observaciones: dto.observaciones ?? null,
        items: {
          create: expedientes.map((e) => ({
            expedienteId: e.id,
            numeroExpediente: e.numero,
            titulo: e.titulo,
            serie: `${e.serie.codigo} · ${e.serie.nombre}`,
            fechaInicio: e.fechaInicioExtrema,
            fechaFin: e.fechaFinExtrema,
            folios: e.totalFolios,
          })),
        },
      },
      include: { items: true },
    });

    await this.bitacora.registrar({
      ctx, entidad: 'transferencia', entidadId: transferencia.id, accion: 'CREAR',
      despues: { numero, tipo: dto.tipo, expedientes: dto.expedientes.length },
    });
    return transferencia;
  }

  async enviar(numero: string, ctx: AuditCtx) {
    const t = await this.prisma.transferencia.findUnique({ where: { numero } });
    if (!t) throw new NotFoundException('Transferencia no encontrada');
    if (t.estado !== 'BORRADOR') throw new BadRequestException('La transferencia ya fue enviada');
    const actualizada = await this.prisma.transferencia.update({
      where: { numero },
      data: { estado: 'ENVIADA', fechaEnvio: new Date() },
    });
    await this.bitacora.registrar({
      ctx, entidad: 'transferencia', entidadId: t.id, accion: 'CAMBIAR_ESTADO',
      antes: { estado: 'BORRADOR' }, despues: { estado: 'ENVIADA' },
    });
    return actualizada;
  }

  async recibir(numero: string, dto: RecibirTransferenciaDto, ctx: AuditCtx) {
    const t = await this.prisma.transferencia.findUnique({
      where: { numero },
      include: { items: true },
    });
    if (!t) throw new NotFoundException('Transferencia no encontrada');
    if (t.estado !== 'ENVIADA') throw new BadRequestException('La transferencia no está en tránsito');

    const nuevoEstadoExp = t.tipo === 'PRIMARIA' ? 'TRANSFERIDO_CENTRAL' : 'TRANSFERIDO_HISTORICO';

    await this.prisma.$transaction([
      this.prisma.transferencia.update({
        where: { numero },
        data: {
          estado: 'RECIBIDA',
          fechaRecepcion: new Date(),
          recibidoPorId: ctx.usuario?.id ?? null,
          observaciones: dto.observaciones ?? t.observaciones,
        },
      }),
      this.prisma.expediente.updateMany({
        where: { id: { in: t.items.map((i) => i.expedienteId) } },
        data: { estado: nuevoEstadoExp as never },
      }),
    ]);

    await this.bitacora.registrar({
      ctx, entidad: 'transferencia', entidadId: t.id, accion: 'CAMBIAR_ESTADO',
      antes: { estado: 'ENVIADA' },
      despues: { estado: 'RECIBIDA', expedientes: t.items.length, nuevoEstadoExpedientes: nuevoEstadoExp },
    });
    return this.obtener(numero);
  }

  listar(estado?: string) {
    return this.prisma.transferencia.findMany({
      where: estado ? { estado: estado as never } : {},
      orderBy: { creado: 'desc' },
      include: { _count: { select: { items: true } }, dependenciaOrigen: { select: { codigo: true } } },
    });
  }

  async obtener(numero: string) {
    const t = await this.prisma.transferencia.findUnique({
      where: { numero },
      include: {
        items: { orderBy: { numeroExpediente: 'asc' } },
        dependenciaOrigen: { select: { codigo: true, nombre: true } },
      },
    });
    if (!t) throw new NotFoundException('Transferencia no encontrada');
    return t;
  }

  /** Inventario documental (formato único de inventario). */
  async inventario(numero: string) {
    const t = await this.obtener(numero);
    return {
      transferencia: t.numero,
      tipo: t.tipo,
      estado: t.estado,
      dependenciaOrigen: t.dependenciaOrigen.nombre,
      fechaElaboracion: t.fechaElaboracion,
      totalExpedientes: t.items.length,
      totalFolios: t.items.reduce((a, i) => a + i.folios, 0),
      items: t.items.map((i, idx) => ({
        n: idx + 1,
        expediente: i.numeroExpediente,
        titulo: i.titulo,
        serie: i.serie,
        fechasExtremas: { inicio: this.fmtDate(i.fechaInicio), fin: this.fmtDate(i.fechaFin) },
        folios: i.folios,
      })),
    };
  }
}

@ApiTags('ciclo de vida')
@ApiBearerAuth()
@Controller('transferencias')
@Roles(ROLES.ARCHIVISTA)
class TransferenciasController {
  constructor(private readonly transferencias: TransferenciasService) {}

  @Post()
  @ApiOperation({ summary: 'Elabora una transferencia con su inventario de expedientes' })
  crear(@Body() dto: CrearTransferenciaDto, @Auditoria() ctx: AuditCtx) {
    return this.transferencias.crear(dto, ctx);
  }

  @Get()
  listar(@Query('estado') estado?: string) {
    return this.transferencias.listar(estado);
  }

  @Get(':numero')
  obtener(@Param('numero') numero: string) {
    return this.transferencias.obtener(numero);
  }

  @Get(':numero/inventario')
  inventario(@Param('numero') numero: string) {
    return this.transferencias.inventario(numero);
  }

  @Post(':numero/enviar')
  enviar(@Param('numero') numero: string, @Auditoria() ctx: AuditCtx) {
    return this.transferencias.enviar(numero, ctx);
  }

  @Post(':numero/recibir')
  @ApiOperation({ summary: 'Recibe la transferencia y cambia el estado de los expedientes' })
  recibir(
    @Param('numero') numero: string,
    @Body() dto: RecibirTransferenciaDto,
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.transferencias.recibir(numero, dto, ctx);
  }
}

@Module({
  controllers: [TransferenciasController],
  providers: [TransferenciasService],
})
export class TransferenciasModule {}
