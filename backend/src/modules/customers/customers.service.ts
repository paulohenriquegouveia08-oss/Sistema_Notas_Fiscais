import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginatedResponse } from '../../shared/types';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<PaginatedResponse<Customer>> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where = [
        { razaoSocial: ILike(`%${search}%`) },
        { nomeFantasia: ILike(`%${search}%`) },
        { cnpj: ILike(`%${search}%`) },
        { cpf: ILike(`%${search}%`) },
        { telefone: ILike(`%${search}%`) },
        { cidade: ILike(`%${search}%`) },
      ];
    }

    const [data, total] = await this.customerRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { razaoSocial: 'ASC' },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepo.findOne({
      where: { id },
      relations: ['invoices', 'receivables'],
    });
    if (!customer) {
      throw new NotFoundException(`Cliente ${id} não encontrado`);
    }
    const totalNfes = customer.invoices?.length || 0;
    const totalEmAberto =
      customer.receivables
        ?.filter((r) => r.status === 'PENDING' || r.status === 'OVERDUE')
        .reduce((sum, r) => sum + Number(r.valorReceber), 0) || 0;
    return Object.assign(customer, { totalNfes, totalEmAberto }) as Customer;
  }

  async findOrCreateByCnpjOrCpf(data: {
    cnpj?: string;
    cpf?: string;
    razaoSocial: string;
  }): Promise<{ customer: Customer; isNew: boolean }> {
    if (!data.cnpj && !data.cpf) {
      throw new Error('CNPJ ou CPF deve ser informado');
    }

    let where: any = {};
    if (data.cnpj) {
      where = { cnpj: data.cnpj };
    } else {
      where = { cpf: data.cpf };
    }

    let customer = await this.customerRepo.findOne({ where });
    if (customer) {
      return { customer, isNew: false };
    }

    customer = this.customerRepo.create(data);
    customer = await this.customerRepo.save(customer);
    this.logger.log(`Cliente criado: ${customer.razaoSocial} (${customer.id})`);
    return { customer, isNew: true };
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Cliente ${id} não encontrado`);
    }
    Object.assign(customer, dto);
    return this.customerRepo.save(customer);
  }

  async getReceivables(id: string) {
    const customer = await this.customerRepo.findOne({
      where: { id },
      relations: ['receivables'],
    });
    if (!customer) {
      throw new NotFoundException(`Cliente ${id} não encontrado`);
    }
    return customer.receivables;
  }

  async getInvoices(id: string) {
    const customer = await this.customerRepo.findOne({
      where: { id },
      relations: ['invoices'],
    });
    if (!customer) {
      throw new NotFoundException(`Cliente ${id} não encontrado`);
    }
    return customer.invoices;
  }
}
