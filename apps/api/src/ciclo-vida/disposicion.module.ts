import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
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
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { Auditoria, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';
import { DISPOSICIONES } from '../clasificacion/dto';

class SolicitarDisposicionDto {
  @ApiProperty({ enum: DISPOSICIONES })
  @IsEnum(DISPOSICIONES)
  disposicion!: (typeof DISPOSICIONES)[number];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  expedientes!: string[];

  @ApiProperty({ minLength: 15 })
  @IsString()
  @MinLength(15, { message: 'La disposición final exige una justificación detallada' })
  justificacion!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() normativa?: string;
}

@Injectable()
class DisposicionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
  ) {}

  async solicitar(dto: SolicitarDisposicionDto, ctx: AuditCtx) {
    const expedientes = await this.prisma.expediente.findMany({
      where: { numero: { in: dto.expedientes } },
    });
    if (expedientes.length !== dto.expedientes.length) {
      throw new BadRequestException('Uno o más expedientes no existen');
    }
    const abiertos = expedientes.filter((e) => e.estado === 'ABIERTO');
    if (abiertos.length) {
      throw new BadRequestException(
        `No se puede disponer de expedientes abiertos: ${abiertos.map((e) => e.numero).join(', ')}`,
      );
    }

    const anio = new Date().getUTCFullYear();
    const [{ fn_siguiente_secuencia: n }] = await this.prisma.$queryRaw<
      Array<{ fn_siguiente_secuencia: number }>
    >(Prisma.sql`SELECT fn_siguiente_secuencia(${`disp:${anio}`})`);
    const numero = `DF-${anio}-${String(n).padStart(4, '0')}`;

    const acta = await this.prisma.disposicionFinalActa.create({
      data: {
        numero,
        disposicion: dto.disposicion as never,
        justificacion: dto.justificacion,
        normativa: dto.normativa ?? null,
        solicitadoPorId: ctx.usuario?.id ?? null,
        items: {
          create: expedientes.map((e) => ({
            expedienteId: e.id,
            numeroExpediente: e.numero,
            titulo: e.titulo,
          })),
        },
      },
      include: { items: true },
    });

    await this.bitacora.registrar({
      ctx, entidad: 'disposicion_final', entidadId: acta.id, accion: 'CREAR',
      despues: { numero, disposicion: dto.disposicion, expedientes: dto.expedientes.length },
      observacion: dto.justificacion,
    });
    return acta;
  }

  async aprobar(numero: string, ctx: AuditCtx) {
    const acta = await this.prisma.disposicionFinalActa.findUnique({ where: { numero } });
    if (!acta) throw new NotFoundException('Acta no encontrada');
    if (['APROBADA', 'RECHAZADA', 'EJECUTADA'].includes(acta.estado)) {
      throw new BadRequestException(`El acta está ${acta.estado}`);
    }
    const uid = ctx.usuario?.id ?? null;
    if (acta.solicitadoPorId && acta.solicitadoPorId === uid && !acta.aprobacion1PorId) {
      throw new ForbiddenException('El solicitante no puede ser el primer aprobador');
    }

    let data: Prisma.DisposicionFinalActaUpdateInput;
    if (!acta.aprobacion1PorId) {
      data = { aprobacion1PorId: uid, aprobacion1En: new Date(), estado: 'APROBADA_PARCIAL' };
    } else {
      if (acta.aprobacion1PorId === uid) {
        throw new ForbiddenException('La segunda aprobación debe ser de otra persona');
      }
      data = { aprobacion2PorId: uid, aprobacion2En: new Date(), estado: 'APROBADA' };
    }

    const actualizada = await this.prisma.disposicionFinalActa.update({ where: { numero }, data });
    await this.bitacora.registrar({
      ctx, entidad: 'disposicion_final', entidadId: acta.id, accion: 'CAMBIAR_ESTADO',
      despues: { estado: actualizada.estado },
      observacion: actualizada.estado === 'APROBADA' ? 'Doble aprobación completa' : 'Primera aprobación',
    });
    return actualizada;
  }

  async rechazar(numero: string, motivo: string, ctx: AuditCtx) {
    const acta = await this.prisma.disposicionFinalActa.findUnique({ where: { numero } });
    if (!acta) throw new NotFoundException('Acta no encontrada');
    if (['EJECUTADA', 'RECHAZADA'].includes(acta.estado)) {
      throw new BadRequestException(`El acta está ${acta.estado}`);
    }
    const actualizada = await this.prisma.disposicionFinalActa.update({
      where: { numero },
      data: { estado: 'RECHAZADA' },
    });
    await this.bitacora.registrar({
      ctx, entidad: 'disposicion_final', entidadId: acta.id, accion: 'CAMBIAR_ESTADO',
      despues: { estado: 'RECHAZADA' }, observacion: motivo,
    });
    return actualizada;
  }

  async ejecutar(numero: string, ctx: AuditCtx) {
    const acta = await this.prisma.disposicionFinalActa.findUnique({
      where: { numero },
      include: { items: true },
    });
    if (!acta) throw new NotFoundException('Acta no encontrada');
    if (acta.estado !== 'APROBADA') {
      throw new BadRequestException('El acta requiere doble aprobación antes de ejecutarse');
    }

    const nuevoEstado =
      acta.disposicion === 'ELIMINACION' ? 'ELIMINADO'
      : acta.disposicion === 'CONSERVACION_TOTAL' ? 'CONSERVADO'
      : 'CONSERVADO';

    await this.prisma.$transaction([
      this.prisma.disposicionFinalActa.update({
        where: { numero },
        data: { estado: 'EJECUTADA', ejecutadoEn: new Date() },
      }),
      this.prisma.expediente.updateMany({
        where: { id: { in: acta.items.map((i) => i.expedienteId) } },
        data: { estado: nuevoEstado as never },
      }),
    ]);

    await this.bitacora.registrar({
      ctx, entidad: 'disposicion_final', entidadId: acta.id, accion: 'CAMBIAR_ESTADO',
      despues: { estado: 'EJECUTADA', disposicion: acta.disposicion, expedientes: acta.items.length },
    });
    return { numero, estado: 'EJECUTADA', expedientesAfectados: acta.items.length };
  }

  listar(estado?: string) {
    return this.prisma.disposicionFinalActa.findMany({
      where: estado ? { estado: estado as never } : {},
      orderBy: { creado: 'desc' },
      include: { _count: { select: { items: true } } },
    });
  }

  async obtener(numero: string) {
    const a = await this.prisma.disposicionFinalActa.findUnique({
      where: { numero },
      include: {
        items: true,
      },
    });
    if (!a) throw new NotFoundException('Acta no encontrada');
    return a;
  }
}

@ApiTags('ciclo de vida')
@ApiBearerAuth()
@Controller('disposicion-final')
class DisposicionController {
  constructor(private readonly disposicion: DisposicionService) {}

  @Post()
  @Roles(ROLES.ARCHIVISTA)
  @ApiOperation({ summary: 'Solicita una disposición final sobre uno o más expedientes' })
  solicitar(@Body() dto: SolicitarDisposicionDto, @Auditoria() ctx: AuditCtx) {
    return this.disposicion.solicitar(dto, ctx);
  }

  @Get()
  @Roles(ROLES.ARCHIVISTA, ROLES.AUDITOR)
  listar(@Query('estado') estado?: string) {
    return this.disposicion.listar(estado);
  }

  @Get(':numero')
  @Roles(ROLES.ARCHIVISTA, ROLES.AUDITOR)
  obtener(@Param('numero') numero: string) {
    return this.disposicion.obtener(numero);
  }

  @Post(':numero/aprobar')
  @Roles(ROLES.ARCHIVISTA, ROLES.ADMIN)
  @ApiOperation({ summary: 'Registra una aprobación (se requieren dos, de personas distintas)' })
  aprobar(@Param('numero') numero: string, @Auditoria() ctx: AuditCtx) {
    return this.disposicion.aprobar(numero, ctx);
  }

  @Post(':numero/rechazar')
  @Roles(ROLES.ARCHIVISTA, ROLES.ADMIN)
  rechazar(
    @Param('numero') numero: string,
    @Body() body: { motivo: string },
    @Auditoria() ctx: AuditCtx,
  ) {
    return this.disposicion.rechazar(numero, body?.motivo ?? 'Sin motivo', ctx);
  }

  @Post(':numero/ejecutar')
  @Roles(ROLES.ARCHIVISTA)
  @ApiOperation({ summary: 'Ejecuta la disposición final (solo tras la doble aprobación)' })
  ejecutar(@Param('numero') numero: string, @Auditoria() ctx: AuditCtx) {
    return this.disposicion.ejecutar(numero, ctx);
  }
}

@Module({
  controllers: [DisposicionController],
  providers: [DisposicionService],
})
export class DisposicionModule {}
