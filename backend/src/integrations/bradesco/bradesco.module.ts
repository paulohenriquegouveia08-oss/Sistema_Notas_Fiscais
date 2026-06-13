import { Module } from '@nestjs/common';
import { BradescoAuthService } from './auth/bradesco-auth.service';
import { BoletoService } from './boleto/boleto.service';

@Module({
  providers: [BradescoAuthService, BoletoService],
  exports: [BradescoAuthService, BoletoService],
})
export class BradescoModule {}
