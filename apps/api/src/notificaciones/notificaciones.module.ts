import {
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/decorators';
import type { UsuarioActual } from '../auth/decorators';

@Injectable()
class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  listar(usuarioId: string, soloNoLeidas: boolean) {
    return this.prisma.notificacion.findMany({
      where: { usuarioId, ...(soloNoLeidas ? { leidaEn: null } : {}) },
      orderBy: { creado: 'desc' },
      take: 100,
    });
  }

  contar(usuarioId: string) {
    return this.prisma.notificacion
      .count({ where: { usuarioId, leidaEn: null } })
      .then((noLeidas) => ({ noLeidas }));
  }

  async marcarLeida(usuarioId: string, id: string) {
    await this.prisma.notificacion.updateMany({
      where: { id, usuarioId },
      data: { leidaEn: new Date() },
    });
    return { ok: true };
  }

  async marcarTodas(usuarioId: string) {
    const r = await this.prisma.notificacion.updateMany({
      where: { usuarioId, leidaEn: null },
      data: { leidaEn: new Date() },
    });
    return { marcadas: r.count };
  }
}

@ApiTags('notificaciones')
@ApiBearerAuth()
@Controller('notificaciones')
class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Get()
  listar(@CurrentUser() user: UsuarioActual, @Query('noLeidas') noLeidas?: string) {
    return this.notificaciones.listar(user.id, noLeidas === 'true');
  }

  @Get('contador')
  contador(@CurrentUser() user: UsuarioActual) {
    return this.notificaciones.contar(user.id);
  }

  @Post(':id/leida')
  leida(@CurrentUser() user: UsuarioActual, @Param('id') id: string) {
    return this.notificaciones.marcarLeida(user.id, id);
  }

  @Post('leer-todas')
  leerTodas(@CurrentUser() user: UsuarioActual) {
    return this.notificaciones.marcarTodas(user.id);
  }
}

@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
})
export class NotificacionesModule {}
