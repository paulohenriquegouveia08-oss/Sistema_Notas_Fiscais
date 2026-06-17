import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, ILike } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { PaginatedResponse } from '../../shared/types';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    customerId?: string;
    status?: string;
    dataInicio?: string;
    dataFim?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Invoice>> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;
    const baseWhere: any = {};

    if (query.customerId) {
      baseWhere.customerId = query.customerId;
    }

    if (query.status) {
      baseWhere.status = query.status;
    }

    if (query.dataInicio && query.dataFim) {
      baseWhere.dataEmissao = Between(
        new Date(query.dataInicio),
        new Date(query.dataFim),
      );
    } else if (query.dataInicio) {
      baseWhere.dataEmissao = Between(
        new Date(query.dataInicio),
        new Date('9999-12-31'),
      );
    } else if (query.dataFim) {
      baseWhere.dataEmissao = Between(
        new Date('1970-01-01'),
        new Date(query.dataFim),
      );
    }

    let where: any = baseWhere;

    if (query.search) {
      const searchFields = [
        'chaveAcesso',
        'numero',
        'serie',
      ];
      where = searchFields.map((field) => ({
        ...baseWhere,
        [field]: ILike(`%${query.search}%`),
      }));
    }

    const sortFieldMap: Record<string, string> = {
      numero: 'numero',
      dataEmissao: 'dataEmissao',
      valorTotal: 'valorTotal',
      status: 'status',
      razaoSocial: 'customer.razaoSocial',
    };

    const order: any = {};
    if (query.sortBy && sortFieldMap[query.sortBy]) {
      order[sortFieldMap[query.sortBy]] = query.sortOrder || 'asc';
    } else {
      order.dataEmissao = 'DESC';
    }

    const [data, total] = await this.invoiceRepo.findAndCount({
      where,
      relations: ['customer', 'receivables'],
      skip,
      take: limit,
      order,
      select: {
        id: true,
        chaveAcesso: true,
        numero: true,
        serie: true,
        dataEmissao: true,
        dataEntrada: true,
        valorTotal: true,
        status: true,
        customerId: true,
        pdfPath: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['customer', 'receivables'],
    });
    if (!invoice) {
      throw new NotFoundException(`Nota fiscal ${id} não encontrada`);
    }
    return invoice;
  }

  async getReceivables(id: string) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['receivables', 'receivables.customer', 'receivables.payment'],
    });
    if (!invoice) {
      throw new NotFoundException(`Nota fiscal ${id} não encontrada`);
    }
    return invoice.receivables;
  }

  async createFromXml(nfeData: any): Promise<{ invoice: Invoice; isNew: boolean }> {
    const existing = await this.invoiceRepo.findOne({
      where: { chaveAcesso: nfeData.chaveAcesso },
    });
    if (existing) {
      return { invoice: existing, isNew: false };
    }

    const invoice = this.invoiceRepo.create(nfeData as any);
    const saved = await this.invoiceRepo.save(invoice as any);
    this.logger.log(`Nota fiscal criada: ${saved.chaveAcesso}`);
    return { invoice: saved as Invoice, isNew: true };
  }
}
