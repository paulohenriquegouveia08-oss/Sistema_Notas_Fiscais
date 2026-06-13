import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NfeImportService } from './nfe-import.service';
import { NfeParserService } from './nfe-parser.service';
import { Customer } from '../customers/entities/customer.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Receivable } from '../receivables/entities/receivable.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Invoice, Receivable]),
  ],
  providers: [NfeImportService, NfeParserService],
  exports: [NfeImportService, NfeParserService],
})
export class NfeImportModule {}
