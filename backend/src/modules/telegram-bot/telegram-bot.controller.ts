import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TelegramBotService } from './telegram-bot.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@ApiTags('Telegram Bot')
@Controller('telegram')
export class TelegramBotController {
  private readonly botToken: string;

  constructor(
    private readonly telegramBotService: TelegramBotService,
    private readonly configService: ConfigService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recebe atualizações do Telegram (webhook)' })
  async webhook(@Body() update: any): Promise<{ ok: boolean }> {
    await this.telegramBotService.handleUpdate(update);
    return { ok: true };
  }

  @Post('set-webhook')
  @ApiOperation({ summary: 'Configura o webhook do Telegram' })
  async setWebhook(): Promise<{ ok: boolean; url: string }> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const baseUrl = frontendUrl.split(',')[0].trim();
    const webhookUrl = `${baseUrl}/api/v1/telegram/webhook`;

    await axios.post(
      `https://api.telegram.org/bot${this.botToken}/setWebhook`,
      { url: webhookUrl },
      { timeout: 15000 },
    );

    return { ok: true, url: webhookUrl };
  }
}
