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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { BitacoraService } from '../bitacora/bitacora.service';
import { RadicacionService } from '../radicacion/radicacion.service';
import { RadicacionModule } from '../radicacion/radicacion.module';
import { Auditoria, Public, Roles } from '../auth/decorators';
import type { AuditCtx } from '../auth/decorators';
import { ROLES } from '../auth/roles';
import { InternalTokenGuard } from '../auth/internal-token.guard';

class AdjuntoCorreoDto {
  @ApiProperty() @IsString() nombre!: string;
  @ApiProperty() @IsString() objectKey!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contentType?: string;
  @ApiPropertyOptional() @IsOptional() checksumSha256?: string;
  @ApiPropertyOptional() @IsOptional() tamanoBytes?: number;
}

class CapturarCorreoDto {
  @ApiProperty() @IsString() messageId!: string;
  @ApiProperty() @IsEmail() de!: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) para!: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) cc?: string[];
  @ApiProperty() @IsString() asunto!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cuerpoTexto?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cuerpoHtml?: string;
  @ApiProperty() @IsISO8601() fecha!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objectKeyOriginal?: string;
  @ApiPropertyOptional({ type: [AdjuntoCorreoDto] })
  @IsOptional()
  @IsArray()
  adjuntos?: AdjuntoCorreoDto[];
}

class RadicarCorreoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() tipoComunicacion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() terceroId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dependenciaId?: string;
}

class DescartarCorreoDto {
  @ApiProperty() @IsString() motivo!: string;
}

@Injectable()
class CorreoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bitacora: BitacoraService,
    private readonly radicacion: RadicacionService,
  ) {}

  async capturar(dto: CapturarCorreoDto) {
    const existe = await this.prisma.comunicacionCorreo.findUnique({
      where: { messageId: dto.messageId },
    });
    if (existe) return { id: existe.id, estado: existe.estado, duplicado: true };

    const c = await this.prisma.comunicacionCorreo.create({
      data: {
        messageId: dto.messageId,
        de: dto.de,
        para: dto.para,
        cc: dto.cc ?? [],
        asunto: dto.asunto,
        cuerpoTexto: dto.cuerpoTexto ?? null,
        cuerpoHtml: dto.cuerpoHtml ?? null,
        fecha: new Date(dto.fecha),
        objectKeyOriginal: dto.objectKeyOriginal ?? null,
        adjuntos: (dto.adjuntos ?? []) as never,
      },
    });
    return { id: c.id, estado: c.estado, duplicado: false };
  }

  pendientes() {
    return this.prisma.comunicacionCorreo.findMany({
      where: { estado: 'PENDIENTE' },
      orderBy: { fecha: 'desc' },
      take: 200,
    });
  }

  async obtener(id: string) {
    const c = await this.prisma.comunicacionCorreo.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Correo no encontrado');
    return c;
  }

  async radicar(id: string, dto: RadicarCorreoDto, ctx: AuditCtx) {
    const c = await this.obtener(id);
    if (c.estado !== 'PENDIENTE') throw new BadRequestException('El correo ya fue procesado');

    const adjuntos = (c.adjuntos as Array<Record<string, unknown>>).map((a) => ({
      objectKey: String(a.objectKey),
      nombre: String(a.nombre),
      contentType: a.contentType ? String(a.contentType) : undefined,
      checksumSha256: a.checksumSha256 ? String(a.checksumSha256) : undefined,
      tamanoBytes: typeof a.tamanoBytes === 'number' ? a.tamanoBytes : undefined,
    }));
    if (c.objectKeyOriginal) {
      adjuntos.unshift({
        objectKey: c.objectKeyOriginal,
        nombre: `${c.messageId.replace(/[^\w.-]/g, '_')}.eml`,
        contentType: 'message/rfc822',
        checksumSha256: undefined,
        tamanoBytes: undefined,
      });
    }

    const radicado = await this.radicacion.radicar(
      {
        tipo: 'ENT',
        canal: 'CORREO',
        terceroId: dto.terceroId,
        dependenciaId: dto.dependenciaId,
        asunto: c.asunto || '(sin asunto)',
        tipoComunicacion: (dto.tipoComunicacion as never) ?? 'GENERAL',
        medioRespuesta: `Correo electrónico: ${c.de}`,
        adjuntos,
      },
      ctx,
    );

    await this.prisma.comunicacionCorreo.update({
      where: { id },
      data: {
        estado: 'RADICADO',
        radicadoNumero: radicado.numero,
        procesadoPorId: ctx.usuario?.id ?? null,
        procesado: new Date(),
      },
    });
    await this.bitacora.registrar({
      ctx, entidad: 'comunicacion_correo', entidadId: id, accion: 'CREAR',
      despues: { radicado: radicado.numero, de: c.de },
    });
    return { correo: id, radicado: radicado.numero };
  }

  async descartar(id: string, motivo: string, ctx: AuditCtx) {
    const c = await this.obtener(id);
    if (c.estado !== 'PENDIENTE') throw new BadRequestException('El correo ya fue procesado');
    await this.prisma.comunicacionCorreo.update({
      where: { id },
      data: {
        estado: 'DESCARTADO',
        motivoDescarte: motivo,
        procesadoPorId: ctx.usuario?.id ?? null,
        procesado: new Date(),
      },
    });
    await this.bitacora.registrar({
      ctx, entidad: 'comunicacion_correo', entidadId: id, accion: 'ACTUALIZAR',
      despues: { estado: 'DESCARTADO', motivo },
    });
    return { ok: true };
  }
}

@ApiTags('correo')
@Controller('correo')
class CorreoController {
  constructor(private readonly correo: CorreoService) {}

  @Public()
  @UseGuards(InternalTokenGuard)
  @Post('capturar')
  @ApiOperation({ summary: 'Ingresa un correo al buzón de radicación (worker IMAP, token interno)' })
  capturar(@Body() dto: CapturarCorreoDto) {
    return this.correo.capturar(dto);
  }

  @ApiBearerAuth()
  @Get('pendientes')
  @Roles(ROLES.VENTANILLA, ROLES.RADICADOR)
  pendientes() {
    return this.correo.pendientes();
  }

  @ApiBearerAuth()
  @Get(':id')
  @Roles(ROLES.VENTANILLA, ROLES.RADICADOR)
  obtener(@Param('id') id: string) {
    return this.correo.obtener(id);
  }

  @ApiBearerAuth()
  @Post(':id/radicar')
  @Roles(ROLES.VENTANILLA, ROLES.RADICADOR)
  @ApiOperation({ summary: 'Radica el correo como comunicación oficial de entrada' })
  radicar(@Param('id') id: string, @Body() dto: RadicarCorreoDto, @Auditoria() ctx: AuditCtx) {
    return this.correo.radicar(id, dto, ctx);
  }

  @ApiBearerAuth()
  @Post(':id/descartar')
  @Roles(ROLES.VENTANILLA, ROLES.RADICADOR)
  descartar(@Param('id') id: string, @Body() dto: DescartarCorreoDto, @Auditoria() ctx: AuditCtx) {
    return this.correo.descartar(id, dto.motivo, ctx);
  }
}

@Module({
  imports: [RadicacionModule],
  controllers: [CorreoController],
  providers: [CorreoService],
})
export class CorreoModule {}
