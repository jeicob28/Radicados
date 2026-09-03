import { Module } from '@nestjs/common';
import { RadicacionService } from './radicacion.service';
import { RadicacionController } from './radicacion.controller';
import { AdjuntosService } from './adjuntos.service';

@Module({
  controllers: [RadicacionController],
  providers: [RadicacionService, AdjuntosService],
  exports: [RadicacionService],
})
export class RadicacionModule {}
