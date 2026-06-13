import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { Receivable } from '../receivables/entities/receivable.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Customer } from '../customers/entities/customer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Receivable, Invoice, Customer]),
  ],
  controllers: [AdminController],
})
export class AdminModule {}
