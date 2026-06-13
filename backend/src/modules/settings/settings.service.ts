import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanySettings } from './entities/company-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(CompanySettings)
    private readonly settingsRepo: Repository<CompanySettings>,
  ) {}

  private async getOrCreate(): Promise<CompanySettings> {
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepo.create();
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  async getSettings(): Promise<CompanySettings> {
    return this.getOrCreate();
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<CompanySettings> {
    const settings = await this.getOrCreate();
    Object.assign(settings, dto);
    return this.settingsRepo.save(settings);
  }

  async saveCertificate(base64: string, password: string, ambiente: string): Promise<void> {
    const settings = await this.getOrCreate();
    settings.certificateB64 = base64;
    settings.certificatePassword = password;
    settings.sefazAmbiente = ambiente;
    await this.settingsRepo.save(settings);
  }

  async removeCertificate(): Promise<void> {
    const settings = await this.getOrCreate();
    settings.certificateB64 = undefined;
    settings.certificatePassword = undefined;
    settings.sefazAmbiente = undefined;
    await this.settingsRepo.save(settings);
  }
}
