import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanySettings } from '../../../modules/settings/entities/company-settings.entity';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    @InjectRepository(CompanySettings)
    private readonly settingsRepo: Repository<CompanySettings>,
  ) {}

  async getHttpsAgent(): Promise<https.Agent | null> {
    const settings = await this.settingsRepo.findOne({ where: {} as any });
    if (!settings?.certificateB64 || !settings?.certificatePassword) {
      return null;
    }

    try {
      const pfxBuffer = Buffer.from(settings.certificateB64, 'base64');
      return new https.Agent({
        pfx: pfxBuffer,
        passphrase: settings.certificatePassword,
        rejectUnauthorized: false,
      });
    } catch (err: any) {
      this.logger.error(`Erro ao criar agente HTTPS: ${err.message}`);
      return null;
    }
  }

  async isConfigured(): Promise<boolean> {
    const settings = await this.settingsRepo.findOne({ where: {} as any });
    return !!(settings?.certificateB64 && settings?.certificatePassword);
  }

  async getAmbiente(): Promise<string> {
    const settings = await this.settingsRepo.findOne({ where: {} as any });
    return settings?.sefazAmbiente || 'homologacao';
  }
}
