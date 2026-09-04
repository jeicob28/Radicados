import { Global, Module } from '@nestjs/common';
import { DiasHabilesService } from './dias-habiles.service';
import { PasswordPolicyService } from './password-policy.service';

@Global()
@Module({
  providers: [DiasHabilesService, PasswordPolicyService],
  exports: [DiasHabilesService, PasswordPolicyService],
})
export class CommonModule {}
