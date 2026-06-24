import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    pessoaFisica?: boolean;
  }): Promise<PaginatedResponse<Invoice>> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const sortFieldMap: Record<string, string> = {
      numero: 'invoice.numero',
      dataEmissao: 'invoice.dataEmissao',
      valorTotal: 'invoice.valorTotal',
      status: 'invoice.status',
      razaoSocial: 'customer.razaoSocial',
    };

    const sortField = query.sortBy && sortFieldMap[query.sortBy];
    const orderField = sortField || 'invoice.dataEmissao';
    const orderDir: 'ASC' | 'DESC' =
      query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const qb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .leftJoinAndSelect('invoice.receivables', 'receivables')
      .skip(skip)
      .take(limit)
      .orderBy(orderField, orderDir)
      .select([
        'invoice.id',
        'invoice.chaveAcesso',
        'invoice.numero',
        'invoice.serie',
        'invoice.dataEmissao',
        'invoice.dataEntrada',
        'invoice.valorTotal',
        'invoice.status',
        'invoice.customerId',
        'invoice.pdfPath',
        'invoice.tipoPagamento',
        'invoice.qtdeParcelas',
        'invoice.createdAt',
        'invoice.updatedAt',
        'customer',
        'receivables',
      ]);

    if (query.customerId) {
      qb.andWhere('invoice.customerId = :customerId', {
        customerId: query.customerId,
      });
    }

    if (query.status) {
      qb.andWhere('invoice.status = :status', { status: query.status });
    }

    if (query.dataInicio && query.dataFim) {
      qb.andWhere('invoice.dataEmissao BETWEEN :dataInicio AND :dataFim', {
        dataInicio: query.dataInicio,
        dataFim: query.dataFim,
      });
    } else if (query.dataInicio) {
      qb.andWhere('invoice.dataEmissao >= :dataInicio', {
        dataInicio: query.dataInicio,
      });
    } else if (query.dataFim) {
      qb.andWhere('invoice.dataEmissao <= :dataFim', {
        dataFim: query.dataFim,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(invoice.chaveAcesso ILIKE :search OR invoice.numero ILIKE :search OR invoice.serie ILIKE :search OR customer.razaoSocial ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.pessoaFisica) {
      qb.andWhere('customer.cpf IS NOT NULL AND customer.cnpj IS NULL');
    }

    const [data, total] = await qb.getManyAndCount();

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

  async update(id: string, dto: Record<string, any>): Promise<Invoice> {
    const invoice = await this.findOne(id);
    const allowedFields = [
      'dataEmissao', 'dataEntrada', 'valorTotal', 'valorProdutos',
      'valorFrete', 'valorDesconto', 'valorTotalTributos',
      'tipoPagamento', 'qtdeParcelas', 'status', 'infCpl',
    ];
    const safeUpdate: Record<string, any> = {};
    for (const key of allowedFields) {
      if (dto[key] !== undefined) {
        safeUpdate[key] = dto[key];
      }
    }
    if (Object.keys(safeUpdate).length === 0) {
      return invoice;
    }
    await this.invoiceRepo.update(id, safeUpdate);
    return this.findOne(id);
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
