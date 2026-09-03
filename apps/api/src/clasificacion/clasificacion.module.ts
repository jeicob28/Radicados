import { Module } from '@nestjs/common';
import { TrdService } from './trd.service';
import { ExpedientesService } from './expedientes.service';
import { ClasificacionService } from './clasificacion.service';
import { ClasificacionController } from './clasificacion.controller';

@Module({
  controllers: [ClasificacionController],
  providers: [TrdService, ExpedientesService, ClasificacionService],
  exports: [ExpedientesService, TrdService],
})
export class ClasificacionModule {}
