import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

import { SettingsModule } from './modules/settings/settings.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ReceivablesModule } from './modules/receivables/receivables.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { XmlImportModule } from './modules/xml-import/xml-import.module';
import { AdminModule } from './modules/admin/admin.module';
import { PdfStorageModule } from './modules/pdf-storage/pdf-storage.module';
import { SefazModule } from './integrations/sefaz/sefaz.module';
import { BradescoModule } from './integrations/bradesco/bradesco.module';
import { AiModule } from './integrations/ai/ai.module';
import { ServerMonitorModule } from './integrations/server-monitor/server-monitor.module';
import { TelegramBotModule } from './modules/telegram-bot/telegram-bot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, context }) => {
              return `${timestamp} [${context || 'Application'}] ${level}: ${message}`;
            }),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    }),
    SettingsModule,
    CustomersModule,
    InvoicesModule,
    ReceivablesModule,
    PaymentsModule,
    DashboardModule,
    XmlImportModule,
    AdminModule,
    PdfStorageModule,
    SefazModule,
    BradescoModule,
    AiModule,
    ServerMonitorModule,
    TelegramBotModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
