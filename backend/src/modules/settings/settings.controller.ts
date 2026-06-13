import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  UploadedFile,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Obter configurações da empresa' })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  @ApiOperation({ summary: 'Atualizar configurações da empresa' })
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  @Post('certificate')
  @ApiOperation({ summary: 'Upload certificado A1 SEFAZ' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCertificate(
    @UploadedFile() file: Express.Multer.File,
    @Body('password') password?: string,
    @Body('ambiente') ambiente?: string,
  ) {
    if (!file) {
      return { success: false, message: 'Arquivo de certificado não enviado' };
    }

    await this.settingsService.saveCertificate(
      file.buffer.toString('base64'),
      password || '',
      ambiente || 'homologacao',
    );

    return { success: true, message: 'Certificado salvo com sucesso' };
  }

  @Delete('certificate')
  @ApiOperation({ summary: 'Remover certificado SEFAZ' })
  async removeCertificate() {
    await this.settingsService.removeCertificate();
    return { success: true, message: 'Certificado removido' };
  }
}
