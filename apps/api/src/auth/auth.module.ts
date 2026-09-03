import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

// JwtModule se registra como global en AppModule.
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
