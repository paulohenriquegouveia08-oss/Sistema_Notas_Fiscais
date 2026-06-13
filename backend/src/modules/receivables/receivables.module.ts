import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ReceivablesController } from './receivables.controller';
import { ReceivablesService } from './receivables.service';
import { OverdueJob } from './jobs/overdue.job';
import { Receivable } from './entities/receivable.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Invoice } from '../invoices/entities/invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Receivable, Payment, Invoice]),
    ScheduleModule.forRoot(),
  ],
  controllers: [ReceivablesController],
  providers: [ReceivablesService, OverdueJob],
  exports: [ReceivablesService],
})
export class ReceivablesModule {}
