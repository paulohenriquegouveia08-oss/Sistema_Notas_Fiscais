import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NfeParserService } from './nfe-parser.service';
import { Customer } from '../customers/entities/customer.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Receivable } from '../receivables/entities/receivable.entity';
import { InvoiceStatus } from '../../shared/enums/invoice-status.enum';
import { ReceivableStatus } from '../../shared/enums/receivable-status.enum';
import { ImportResult } from './interfaces/import-result.interface';
import { PaymentMethod } from '../../shared/enums/payment-method.enum';

@Injectable()
export class NfeImportService {
  private readonly logger = new Logger(NfeImportService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Receivable)
    private readonly receivableRepo: Repository<Receivable>,
    private readonly nfeParser: NfeParserService,
  ) {}

  async importXml(xmlContent: string): Promise<ImportResult> {
    const errors: string[] = [];
    let parsed: any;

    try {
      parsed = this.nfeParser.parse(xmlContent);
    } catch (err: any) {
      return {
        chaveAcesso: '',
        numero: '',
        serie: '',
        customer: { id: '', razaoSocial: '', isNew: false },
        invoice: { id: '', isNew: false },
        receivables: [],
        errors: [`Erro ao parsear XML: ${err.message}`],
      };
    }

    const existingInvoice = await this.invoiceRepo.findOne({
      where: { chaveAcesso: parsed.chaveAcesso },
    });
    if (existingInvoice) {
      return {
        chaveAcesso: parsed.chaveAcesso,
        numero: parsed.numero,
        serie: parsed.serie,
        customer: {
          id: existingInvoice.customerId,
          razaoSocial: existingInvoice.customer?.razaoSocial || '',
          isNew: false,
        },
        invoice: { id: existingInvoice.id, isNew: false },
        receivables: [],
        errors: [],
      };
    }

    let customer: Customer & { isNew?: boolean };
    try {
      customer = await this.findOrCreateCustomer(parsed.customer);
    } catch (err: any) {
      errors.push(`Erro ao criar cliente: ${err.message}`);
      return {
        chaveAcesso: parsed.chaveAcesso,
        numero: parsed.numero,
        serie: parsed.serie,
        customer: { id: '', razaoSocial: parsed.customer.razaoSocial, isNew: false },
        invoice: { id: '', isNew: false },
        receivables: [],
        errors,
      };
    }

    const invoice = this.invoiceRepo.create({
      chaveAcesso: parsed.chaveAcesso,
      numero: parsed.numero,
      serie: parsed.serie,
      dataEmissao: parsed.dataEmissao,
      dataEntrada: parsed.dataEntrada,
      valorTotal: parsed.valorTotal,
      baseCalculoIcms: parsed.baseCalculoIcms,
      valorIcms: parsed.valorIcms,
      baseCalculoIcmsSt: parsed.baseCalculoIcmsSt,
      valorIcmsSt: parsed.valorIcmsSt,
      valorProdutos: parsed.valorProdutos,
      valorFrete: parsed.valorFrete,
      valorDesconto: parsed.valorDesconto,
      valorTotalTributos: parsed.valorTotalTributos,
      status: InvoiceStatus.AUTHORIZED,
      xmlCompleto: xmlContent,
      customerId: customer.id,
    });
    const savedInvoice = await this.invoiceRepo.save(invoice);

    let receivables: Receivable[] = [];
    try {
      receivables = await this.createReceivablesFromPayment(
        savedInvoice,
        customer.id,
        parsed.paymentInfo,
      );
    } catch (err: any) {
      errors.push(`Erro ao criar recebíveis: ${err.message}`);
    }

    this.logger.log(
      `NF-e ${parsed.chaveAcesso} importada: ${customer.razaoSocial}, ${receivables.length} recebíveis`,
    );

    return {
      chaveAcesso: parsed.chaveAcesso,
      numero: parsed.numero,
      serie: parsed.serie,
      customer: {
        id: customer.id,
        razaoSocial: customer.razaoSocial,
        cnpj: customer.cnpj,
        cpf: customer.cpf,
        isNew: !!customer.isNew,
      },
      invoice: { id: savedInvoice.id, isNew: true },
      receivables: receivables.map((r) => ({
        id: r.id,
        parcela: r.parcela,
        valorOriginal: Number(r.valorOriginal),
        valorReceber: Number(r.valorReceber),
        dataVencimento: r.dataVencimento,
        formaPagamento: r.formaPagamento || '',
      })),
      errors,
    };
  }

  private async findOrCreateCustomer(data: any): Promise<Customer & { isNew?: boolean }> {
    let where: any = {};
    if (data.cnpj) {
      where = { cnpj: data.cnpj };
    } else if (data.cpf) {
      where = { cpf: data.cpf };
    } else {
      throw new Error('CNPJ ou CPF não informado no XML');
    }

    const existing = await this.customerRepo.findOne({ where });
    if (existing) {
      return Object.assign(existing, { isNew: false });
    }

    const created = this.customerRepo.create(data as any) as unknown as Customer;
    const saved = await this.customerRepo.save(created as any) as Customer;
    return Object.assign(saved, { isNew: true });
  }

  private async createReceivablesFromPayment(
    invoice: Invoice,
    customerId: string,
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
            formaPagamento: this.mapTPag(tPag),
            customerId,
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
          formaPagamento: this.mapTPag(tPag),
          customerId,
          invoiceId: invoice.id,
        });
        receivables.push(await this.receivableRepo.save(receivable));
      }
    }

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

  private mapTPag(tPag: string): string {
    const map: Record<string, string> = {
      '01': 'DINHEIRO',
      '02': 'CHEQUE',
      '03': 'CARTAO_CREDITO',
      '04': 'CARTAO_DEBITO',
      '05': 'CREDIARIO',
      '06': 'BOLETO',
      '07': 'PIX',
      '10': 'VALE_ALIMENTACAO',
      '11': 'VALE_REFEICAO',
      '12': 'VALE_PRESENTE',
      '13': 'VALE_COMBUSTIVEL',
      '14': 'DUPLICATA',
      '15': 'BOLETO',
      '16': 'SEM_PAGAMENTO',
      '17': 'OUTRO',
      '18': 'CARTAO_CREDITO',
      '19': 'CARTAO_CREDITO',
      '20': 'PIX',
      '21': 'CARTAO_CREDITO',
      '22': 'BOLETO',
      '90': 'SEM_PAGAMENTO',
      '99': 'OUTRO',
    };
    return map[tPag] || 'OUTRO';
  }

  private getStatusByTPag(tPag: string): ReceivableStatus {
    switch (tPag) {
      case '01':
      case '02':
      case '04':
      case '07':
      case '17':
      case '20':
        return ReceivableStatus.PAID;
      case '03':
      case '05':
      case '06':
      case '14':
      case '15':
      case '18':
      case '19':
      case '21':
      case '22':
        return ReceivableStatus.PENDING;
      default:
        return ReceivableStatus.PENDING;
    }
  }

  private calculateDueDate(tPag: string): string {
    const today = new Date();
    switch (tPag) {
      case '15':
      case '06':
      case '22':
        today.setDate(today.getDate() + 30);
        break;
      default:
        return today.toISOString().split('T')[0];
    }
    return today.toISOString().split('T')[0];
  }

  private getDefaultDueDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  }
}
