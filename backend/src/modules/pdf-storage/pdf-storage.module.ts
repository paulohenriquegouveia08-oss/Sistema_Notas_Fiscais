import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { PdfStorageController } from './pdf-storage.controller';
import { PdfStorageService } from './pdf-storage.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { PdfDocument } from './entities/pdf-document.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { CompanySettings } from '../settings/entities/company-settings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PdfDocument, Invoice, CompanySettings]),
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  ],
  controllers: [PdfStorageController],
  providers: [PdfStorageService, PdfGeneratorService],
  exports: [PdfGeneratorService],
})
export class PdfStorageModule {}
