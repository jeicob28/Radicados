import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { CommonModule } from './common/common.module';
import { BitacoraModule } from './bitacora/bitacora.module';
import { HealthModule } from './health/health.module';
import { InfoModule } from './info/info.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { RolesModule } from './roles/roles.module';
import { DependenciasModule } from './dependencias/dependencias.module';
import { TercerosModule } from './terceros/terceros.module';
import { ParametrosModule } from './parametros/parametros.module';
import { RadicacionModule } from './radicacion/radicacion.module';
import { ConsecutivosModule } from './consecutivos/consecutivos.module';
import { SeguimientoModule } from './seguimiento/seguimiento.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { ClasificacionModule } from './clasificacion/clasificacion.module';
import { ReportesModule } from './reportes/reportes.module';
import { CorreoModule } from './correo/correo.module';
import { ContingenciaModule } from './contingencia/contingencia.module';
import { TransferenciasModule } from './ciclo-vida/transferencias.module';
import { DisposicionModule } from './ciclo-vida/disposicion.module';
import { InternalModule } from './internal/internal.module';
import { CopiasModule } from './copias/copias.module';
import { AyudaModule } from './ayuda/ayuda.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { MantenimientoGuard } from './common/mantenimiento.guard';
import { BitacoraInterceptor } from './common/interceptors/bitacora.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    JwtModule.register({ global: true }),
    PrismaModule,
    StorageModule,
    CommonModule,
    BitacoraModule,
    HealthModule,
    InfoModule,
    AuthModule,
    UsuariosModule,
    RolesModule,
    DependenciasModule,
    TercerosModule,
    ParametrosModule,
    RadicacionModule,
    ConsecutivosModule,
    SeguimientoModule,
    NotificacionesModule,
    ClasificacionModule,
    ReportesModule,
    CorreoModule,
    ContingenciaModule,
    TransferenciasModule,
    DisposicionModule,
    InternalModule,
    CopiasModule,
    AyudaModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: MantenimientoGuard },
    { provide: APP_INTERCEPTOR, useClass: BitacoraInterceptor },
  ],
})
export class AppModule {}
