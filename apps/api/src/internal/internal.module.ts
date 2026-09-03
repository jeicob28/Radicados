import { Controller, Module, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/decorators';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { AlertasService } from '../seguimiento/alertas.service';
import { SeguimientoModule } from '../seguimiento/seguimiento.module';

@ApiExcludeController()
@Public()
@UseGuards(InternalTokenGuard)
@Controller('internal')
class InternalController {
  constructor(private readonly alertas: AlertasService) {}

  @Post('recalcular-alertas')
  recalcular() {
    return this.alertas.recalcular();
  }
}

@Module({
  imports: [SeguimientoModule],
  controllers: [InternalController],
})
export class InternalModule {}
