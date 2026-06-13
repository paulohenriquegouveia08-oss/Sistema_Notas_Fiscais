import { Controller, Delete, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Receivable } from '../receivables/entities/receivable.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Customer } from '../customers/entities/customer.entity';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    @InjectRepository(Receivable)
    private readonly receivableRepo: Repository<Receivable>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  @Delete('data')
  @ApiOperation({ summary: 'Limpar todos os dados do sistema' })
  async clearData() {
    this.logger.warn('Limpando todos os dados do sistema...');

    await this.receivableRepo.query('DELETE FROM receivables');
    await this.customerRepo.query('DELETE FROM payments');
    await this.invoiceRepo.query('DELETE FROM invoices');
    await this.customerRepo.query('DELETE FROM customers');

    this.logger.warn('Dados limpos com sucesso');
    return { message: 'Todos os dados foram removidos com sucesso' };
  }
}
