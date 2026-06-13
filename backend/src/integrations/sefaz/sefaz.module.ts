import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificateService } from './services/certificate.service';
import { SefazConsultaService } from './services/sefaz-consulta.service';
import { CompanySettings } from '../../modules/settings/entities/company-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CompanySettings])],
  providers: [CertificateService, SefazConsultaService],
  exports: [CertificateService, SefazConsultaService],
})
export class SefazModule {}
