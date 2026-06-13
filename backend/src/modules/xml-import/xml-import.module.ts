import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { XmlImportController } from './controllers/xml-import.controller';
import { XmlImportService } from './services/xml-import.service';
import { NfeXmlParser } from './parser/nfe-xml.parser';
import { NfePdfParser } from './parser/nfe-pdf.parser';
import { XmlValidator } from './validators/xml.validator';
import { Customer } from '../customers/entities/customer.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Receivable } from '../receivables/entities/receivable.entity';
import { Payment } from '../payments/entities/payment.entity';
import { SefazModule } from '../../integrations/sefaz/sefaz.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Invoice, Receivable, Payment]),
    SefazModule,
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  ],
  controllers: [XmlImportController],
  providers: [XmlImportService, NfeXmlParser, NfePdfParser, XmlValidator],
  exports: [XmlImportService],
})
export class XmlImportModule {}
