import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Receivable } from './entities/receivable.entity';
import { Payment } from '../payments/entities/payment.entity';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { PayReceivableDto } from './dto/pay-receivable.dto';
import { ReceivableStatus } from '../../shared/enums/receivable-status.enum';
import { PaymentMethod } from '../../shared/enums/payment-method.enum';
import { Invoice } from '../invoices/entities/invoice.entity';
import { PaginatedResponse } from '../../shared/types';

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

interface PaymentInfo {
  formaPagamento: string;
  valorTotal: number;
}

@Injectable()
export class ReceivablesService {
  private readonly logger = new Logger(ReceivablesService.name);

  constructor(
    @InjectRepository(Receivable)
    private readonly receivableRepo: Repository<Receivable>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    status?: string;
    customerId?: string;
    invoiceId?: string;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<PaginatedResponse<Receivable>> {
    const page = query.page || 1;
    const limit = query.limit || 200;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.invoiceId) {
      where.invoiceId = query.invoiceId;
    }

    if (query.dataInicio && query.dataFim) {
      where.dataVencimento = Between(query.dataInicio, query.dataFim);
    } else if (query.dataInicio) {
      where.dataVencimento = MoreThanOrEqual(query.dataInicio);
    } else if (query.dataFim) {
      where.dataVencimento = LessThanOrEqual(query.dataFim);
    }

    const [data, total] = await this.receivableRepo.findAndCount({
      where,
      relations: ['customer', 'invoice', 'payment'],
      skip,
      take: limit,
      order: { invoice: { numero: 'DESC', serie: 'DESC' } },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Receivable> {
    const receivable = await this.receivableRepo.findOne({
      where: { id },
      relations: ['customer', 'invoice', 'payment'],
    });
    if (!receivable) {
      throw new NotFoundException(`Recebível ${id} não encontrado`);
    }
    return receivable;
  }

  async createFromInvoice(
    invoice: Invoice,
    paymentInfo: { detPag: any[] },
  ): Promise<Receivable[]> {
    const receivables: Receivable[] = [];

    const payments = paymentInfo.detPag || [];
    for (const pag of payments) {
      const tPag = pag.tPag || '99';
      const valor = parseFloat(pag.vPag || '0');
      const installments = this.parseInstallments(pag);

      if (installments.length > 0) {
        for (const inst of installments) {
          const receivable = this.receivableRepo.create({
            parcela: inst.parcela,
            valorOriginal: inst.valor,
            valorReceber: inst.valor,
            dataVencimento: inst.dataVencimento,
            status: this.getStatusByTPag(tPag),
            formaPagamento: tPag,
            customerId: invoice.customerId,
            invoiceId: invoice.id,
          });
          receivables.push(await this.receivableRepo.save(receivable));
        }
      } else {
        const receivable = this.receivableRepo.create({
          parcela: 1,
          valorOriginal: valor,
          valorReceber: valor,
          dataVencimento: this.calculateDueDate(tPag),
          status: this.getStatusByTPag(tPag),
          formaPagamento: tPag,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
        });
        receivables.push(await this.receivableRepo.save(receivable));
      }
    }

    this.logger.log(`${receivables.length} recebíveis criados para invoice ${invoice.id}`);
    return receivables;
  }

  private parseInstallments(pag: any): { parcela: number; valor: number; dataVencimento: string }[] {
    const result: { parcela: number; valor: number; dataVencimento: string }[] = [];

    if (pag.detPag && Array.isArray(pag.detPag)) {
      for (const dp of pag.detPag) {
        result.push({
          parcela: parseInt(dp.nParcela || '1', 10),
          valor: parseFloat(dp.vParcela || '0'),
          dataVencimento: dp.dVenc || this.getDefaultDueDate(),
        });
      }
    }

    if (pag.card && Array.isArray(pag.card)) {
      for (const tp of pag.card) {
        result.push({
          parcela: parseInt(tp.nParcela || '1', 10),
          valor: parseFloat(tp.vParcela || '0'),
          dataVencimento: tp.dVenc || this.getDefaultDueDate(),
        });
      }
    }

    return result;
  }

  private getStatusByTPag(tPag: string): ReceivableStatus {
    switch (tPag) {
      case '01':
        return ReceivableStatus.PAID;
      case '03':
        return ReceivableStatus.PENDING;
      case '15':
        return ReceivableStatus.PENDING;
      case '17':
        return ReceivableStatus.PAID;
      default:
        return ReceivableStatus.PENDING;
    }
  }

  private calculateDueDate(tPag: string): string {
    switch (tPag) {
      case '15': {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      }
      default:
        return getTodayStr();
    }
  }

  private getDefaultDueDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  async pay(
    id: string,
    dto: PayReceivableDto,
  ): Promise<Receivable> {
    const receivable = await this.findOne(id);

    if (receivable.status === ReceivableStatus.PAID) {
      throw new BadRequestException('Recebível já está pago');
    }

    if (receivable.status === ReceivableStatus.CANCELLED) {
      throw new BadRequestException('Recebível está cancelado');
    }

    const payment = this.paymentRepo.create({
      valorPago: dto.valorPago,
      paymentMethod: dto.paymentMethod,
      dataPagamento: dto.dataPagamento,
      juros: dto.juros || 0,
      multa: dto.multa || 0,
      observacao: dto.observacao,
      customerId: receivable.customerId,
    });
    const savedPayment = await this.paymentRepo.save(payment);

    receivable.valorPago = dto.valorPago;
    receivable.dataPagamento = dto.dataPagamento;
    receivable.juros = dto.juros || 0;
    receivable.multa = dto.multa || 0;
    receivable.observacao = dto.observacao;
    receivable.status = ReceivableStatus.PAID;
    receivable.paymentId = savedPayment.id;

    const saved = await this.receivableRepo.save(receivable);
    this.logger.log(`Recebível ${id} pago via ${dto.paymentMethod}`);
    return saved;
  }

  async unpay(id: string): Promise<Receivable> {
    const receivable = await this.findOne(id);

    if (receivable.status !== ReceivableStatus.PAID) {
      throw new BadRequestException('Apenas recebíveis pagos podem ter pagamento desfeito');
    }

    receivable.valorPago = undefined;
    receivable.dataPagamento = undefined;
    receivable.juros = undefined;
    receivable.multa = undefined;
    receivable.status = ReceivableStatus.PENDING;
    receivable.paymentId = undefined;

    const saved = await this.receivableRepo.save(receivable);
    this.logger.log(`Pagamento do recebível ${id} desfeito`);
    return saved;
  }

  async cancel(id: string): Promise<Receivable> {
    const receivable = await this.findOne(id);

    if (receivable.status === ReceivableStatus.PAID) {
      throw new BadRequestException('Recebível pago não pode ser cancelado');
    }

    receivable.status = ReceivableStatus.CANCELLED;
    receivable.dataCancelamento = getTodayStr();
    const saved = await this.receivableRepo.save(receivable);
    this.logger.log(`Recebível ${id} cancelado`);
    return saved;
  }

  async markOverdue(): Promise<number> {
    const today = getTodayStr();
    const result = await this.receivableRepo.update(
      {
        status: ReceivableStatus.PENDING,
        dataVencimento: LessThan(today),
      },
      { status: ReceivableStatus.OVERDUE },
    );
    if (result.affected) {
      this.logger.log(`${result.affected} recebíveis marcados como vencidos`);
    }
    return result.affected || 0;
  }

  async findUpcoming(days = 30): Promise<Receivable[]> {
    const today = getTodayStr();
    const future = new Date();
    future.setDate(future.getDate() + days);
    const fy = future.getFullYear();
    const fm = String(future.getMonth() + 1).padStart(2, '0');
    const fdd = String(future.getDate()).padStart(2, '0');
    const futureStr = `${fy}-${fm}-${fdd}`;

    return this.receivableRepo.find({
      where: {
        status: ReceivableStatus.PENDING,
        dataVencimento: Between(today, futureStr),
      },
      relations: ['customer', 'invoice'],
      order: { dataVencimento: 'ASC' },
    });
  }

  async findCalendar(): Promise<Receivable[]> {
    const today = getTodayStr();
    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);
    const py = past.getFullYear();
    const pm = String(past.getMonth() + 1).padStart(2, '0');
    const pdd = String(past.getDate()).padStart(2, '0');
    const pastStr = `${py}-${pm}-${pdd}`;

    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const fy = future.getFullYear();
    const fm = String(future.getMonth() + 1).padStart(2, '0');
    const fdd = String(future.getDate()).padStart(2, '0');
    const futureStr = `${fy}-${fm}-${fdd}`;

    return this.receivableRepo.find({
      where: {
        dataVencimento: Between(pastStr, futureStr),
      },
      relations: ['customer', 'invoice'],
      order: { dataVencimento: 'ASC' },
    });
  }

  async listOverdue(): Promise<Receivable[]> {
    const today = getTodayStr();
    return this.receivableRepo.find({
      where: {
        status: ReceivableStatus.OVERDUE,
      },
      relations: ['customer', 'invoice'],
      order: { dataVencimento: 'ASC' },
    });
  }
}
