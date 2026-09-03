import { Global, Module } from '@nestjs/common';
import { DiasHabilesService } from './dias-habiles.service';

@Global()
@Module({
  providers: [DiasHabilesService],
  exports: [DiasHabilesService],
})
export class CommonModule {}
