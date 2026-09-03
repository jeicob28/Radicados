import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ColasService } from './colas/colas.service';
import { VencimientosService } from './vencimientos/vencimientos.service';
import { ImapService } from './correo/imap.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ColasService, VencimientosService, ImapService],
})
export class AppModule {}
