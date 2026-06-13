import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { PdfStorageController } from './pdf-storage.controller';
import { PdfStorageService } from './pdf-storage.service';
import { PdfDocument } from './entities/pdf-document.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PdfDocument]),
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  ],
  controllers: [PdfStorageController],
  providers: [PdfStorageService],
})
export class PdfStorageModule {}
