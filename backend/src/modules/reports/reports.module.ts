import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Receivable } from '../receivables/entities/receivable.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CompanySettings } from '../settings/entities/company-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, Receivable, Payment, Customer, CompanySettings])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
