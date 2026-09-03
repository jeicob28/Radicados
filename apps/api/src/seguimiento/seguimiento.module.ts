import { Module } from '@nestjs/common';
import { SeguimientoService } from './seguimiento.service';
import { AlertasService } from './alertas.service';
import { SeguimientoController } from './seguimiento.controller';

@Module({
  controllers: [SeguimientoController],
  providers: [SeguimientoService, AlertasService],
  exports: [SeguimientoService, AlertasService],
})
export class SeguimientoModule {}
