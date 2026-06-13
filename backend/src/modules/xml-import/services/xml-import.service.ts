import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull, Not } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { NfeXmlParser } from '../parser/nfe-xml.parser';
import { NfePdfParser } from '../parser/nfe-pdf.parser';
import { XmlValidator } from '../validators/xml.validator';
import { SefazConsultaService } from '../../../integrations/sefaz/services/sefaz-consulta.service';
import { Customer } from '../../customers/entities/customer.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Receivable } from '../../receivables/entities/receivable.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { InvoiceStatus } from '../../../shared/enums/invoice-status.enum';
import { ReceivableStatus } from '../../../shared/enums/receivable-status.enum';
import { ImportResult } from '../interfaces/import-result.interface';

function normalizeDate(dateStr: string | undefined | null): string | undefined {
  if (!dateStr) return undefined;
  const m = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : dateStr;
}

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

@Injectable()
export class XmlImportService {
  private readonly logger = new Logger(XmlImportService.name);

  private readonly uploadsDir = path.join(__dirname, '..', '..', '..', '..', 'uploads', 'pdfs');

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Receivable)
    private readonly receivableRepo: Repository<Receivable>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly nfeParser: NfeXmlParser,
    private readonly xmlValidator: XmlValidator,
    private readonly nfePdfParser: NfePdfParser,
    private readonly sefazService: SefazConsultaService,
  ) {}

  async importXml(xmlContent: string): Promise<ImportResult> {
    const validation = this.xmlValidator.validate(xmlContent);
    if (!validation.valid) {
      return {
        chaveAcesso: '',
        numero: '',
        serie: '',
        customer: { id: '', razaoSocial: '', isNew: false },
        invoice: { id: '', isNew: false },
        receivables: [],
        errors: [validation.message || 'XML inválido'],
      };
    }

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

    const invoiceData = {
      chaveAcesso: parsed.chaveAcesso,
      numero: parsed.numero,
      serie: parsed.serie,
      dataEmissao: normalizeDate(parsed.dataEmissao),
      dataEntrada: normalizeDate(parsed.dataEntrada),
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
    };

    const savedInvoice = await this.invoiceRepo.save(
      this.invoiceRepo.create(invoiceData as any) as any,
    ) as unknown as Invoice;

    let receivables: Receivable[] = [];
    let tipoPagamento = 'AVISTA';
    let qtdeParcelas = 0;

    try {
      const result = await this.createReceivablesFromPayment(
        savedInvoice,
        customer.id,
        parsed.paymentInfo,
      );
      receivables = result.receivables;
      tipoPagamento = result.tipoPagamento;
      qtdeParcelas = result.qtdeParcelas;

      if (tipoPagamento) {
        await this.invoiceRepo.update(savedInvoice.id, { tipoPagamento, qtdeParcelas });
      }
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

  async importPdf(
    pdfBuffer: Buffer,
    filename: string,
  ): Promise<ImportResult & { pdfPath?: string }> {
    let chaveAcesso: string;
    try {
      chaveAcesso = await this.nfePdfParser.extractChaveAcesso(pdfBuffer);
    } catch (err: any) {
      return {
        chaveAcesso: '',
        numero: '',
        serie: '',
        customer: { id: '', razaoSocial: '', isNew: false },
        invoice: { id: '', isNew: false },
        receivables: [],
        errors: [`Erro ao ler PDF: ${err.message}`],
      };
    }

    let xmlContent: string;
    try {
      xmlContent = await this.sefazService.consultarNFe(chaveAcesso);
    } catch (err: any) {
      return {
        chaveAcesso,
        numero: '',
        serie: '',
        customer: { id: '', razaoSocial: '', isNew: false },
        invoice: { id: '', isNew: false },
        receivables: [],
        errors: [`Erro ao consultar SEFAZ: ${err.message}`],
      };
    }

    const result = await this.importXml(xmlContent);

    if (result.invoice.isNew && result.invoice.id) {
      try {
        if (!fs.existsSync(this.uploadsDir)) {
          fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
        const pdfFileName = `${chaveAcesso}.pdf`;
        const pdfPath = path.join(this.uploadsDir, pdfFileName);
        fs.writeFileSync(pdfPath, pdfBuffer);

        await this.invoiceRepo.update(result.invoice.id, { pdfPath });

        return { ...result, pdfPath };
      } catch (err: any) {
        this.logger.error(`Erro ao salvar PDF: ${err.message}`);
      }
    }

    return result;
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

    const created = this.customerRepo.create(data as any);
    const saved = await this.customerRepo.save(created as any);
    return Object.assign(saved as Customer, { isNew: true });
  }

  private async createReceivablesFromPayment(
    invoice: Invoice,
    customerId: string,
    paymentInfo: { detPag: any[]; dup?: any[] },
  ): Promise<{ receivables: Receivable[]; tipoPagamento: string; qtdeParcelas: number }> {
    const receivables: Receivable[] = [];
    const today = getTodayStr();

    if (paymentInfo.dup && paymentInfo.dup.length > 0) {
      const tPag = paymentInfo.detPag?.[0]?.tPag || '99';
      for (let i = 0; i < paymentInfo.dup.length; i++) {
        const inst = paymentInfo.dup[i];
        const dVenc = normalizeDate(inst.dVenc) || this.getDefaultDueDate();
        const status = dVenc < today
          ? ReceivableStatus.OVERDUE
          : ReceivableStatus.PENDING;

        const receivable = this.receivableRepo.create({
          parcela: i + 1,
          valorOriginal: parseFloat(inst.vParcela || '0'),
          valorReceber: parseFloat(inst.vParcela || '0'),
          dataVencimento: dVenc,
          status,
          formaPagamento: this.mapTPag(tPag),
          customerId,
          invoiceId: invoice.id,
        } as any);
        receivables.push(await this.receivableRepo.save(receivable as any));
      }
      await this.markOverdueForCustomer(customerId);
      return { receivables, tipoPagamento: 'PARCELADO', qtdeParcelas: paymentInfo.dup.length };
    }

    const pag = paymentInfo.detPag?.[0];
    const tPag = pag?.tPag || '99';
    const valor = parseFloat(pag?.vPag || '0');

    const receivable = this.receivableRepo.create({
      parcela: 1,
      valorOriginal: valor,
      valorReceber: valor,
      dataVencimento: today,
      status: ReceivableStatus.PAID,
      dataPagamento: today,
      formaPagamento: this.mapTPag(tPag),
      customerId,
      invoiceId: invoice.id,
    } as any);
    const savedReceivable = await this.receivableRepo.save(receivable as any);

    const payment = this.paymentRepo.create({
      valorPago: valor,
      paymentMethod: this.mapTPagToPaymentMethod(tPag),
      dataPagamento: today,
      juros: 0,
      multa: 0,
      observacao: 'Pagamento à vista - importação automática',
      customerId,
    } as any);
    const savedPayment = await this.paymentRepo.save(payment as any);

    savedReceivable.paymentId = savedPayment.id;
    await this.receivableRepo.save(savedReceivable as any);

    receivables.push(savedReceivable);
    return { receivables, tipoPagamento: 'AVISTA', qtdeParcelas: 0 };
  }

  private mapTPagToPaymentMethod(tPag: string): string {
    const map: Record<string, string> = {
      '01': 'CASH',
      '02': 'CHECK',
      '03': 'CARD',
      '04': 'CARD',
      '05': 'TERM',
      '06': 'BOLETO',
      '07': 'PIX',
      '10': 'CASH',
      '11': 'CASH',
      '12': 'CASH',
      '13': 'CASH',
      '14': 'TERM',
      '15': 'BOLETO',
      '16': 'CASH',
      '17': 'CASH',
      '18': 'CARD',
      '19': 'CARD',
      '20': 'PIX',
      '21': 'CARD',
      '22': 'BOLETO',
      '90': 'CASH',
      '99': 'CASH',
    };
    return map[tPag] || 'CASH';
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

  private getDefaultDueDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  private async markOverdueForCustomer(customerId: string): Promise<void> {
    const today = getTodayStr();
    await this.receivableRepo.update(
      {
        customerId,
        status: ReceivableStatus.PENDING,
        dataVencimento: LessThan(today),
      },
      { status: ReceivableStatus.OVERDUE },
    );
  }

  async backfillTipoPagamento(): Promise<{ processed: number; updated: number; errors: string[] }> {
    const invoices = await this.invoiceRepo.find({
      where: { xmlCompleto: Not(IsNull()) },
    });

    let updated = 0;
    const errors: string[] = [];

    for (const invoice of invoices) {
      try {
        const parsed = this.nfeParser.parse(invoice.xmlCompleto!);
        const hasDup = !!(parsed.paymentInfo.dup && parsed.paymentInfo.dup.length > 0);
        const tipoPagamento = hasDup ? 'PARCELADO' : 'AVISTA';
        const qtdeParcelas = hasDup ? parsed.paymentInfo.dup!.length : 0;

        await this.invoiceRepo.update(invoice.id, { tipoPagamento, qtdeParcelas });

        const receivables = await this.receivableRepo.find({
          where: { invoiceId: invoice.id },
          order: { parcela: 'ASC' },
        });

        const todayStr = getTodayStr();

        if (!hasDup) {
          for (const rec of receivables) {
            if (rec.status === ReceivableStatus.PAID && rec.paymentId) continue;

            rec.status = ReceivableStatus.PAID;
            rec.dataPagamento = todayStr;
            rec.valorPago = rec.valorPago || rec.valorReceber;

            if (!rec.paymentId) {
              const tPag = parsed.paymentInfo.detPag?.[0]?.tPag || '99';
              const payment = await this.paymentRepo.save(
                this.paymentRepo.create({
                  valorPago: Number(rec.valorReceber),
                  paymentMethod: this.mapTPagToPaymentMethod(tPag),
                  dataPagamento: todayStr,
                  juros: 0,
                  multa: 0,
                  observacao: 'Pagamento à vista - backfill',
                  customerId: invoice.customerId,
                } as any) as any,
              );
              rec.paymentId = (payment as any).id;
            }

            await this.receivableRepo.save(rec as any);
          }
        } else {
          for (let i = 0; i < receivables.length; i++) {
            const rec = receivables[i];
            if (rec.status === ReceivableStatus.PAID) continue;

            const dupData = parsed.paymentInfo.dup?.[i];
            if (dupData) {
              const dVenc = normalizeDate(dupData.dVenc) || rec.dataVencimento;
              rec.dataVencimento = dVenc;
              rec.status = dVenc < todayStr
                ? ReceivableStatus.OVERDUE
                : ReceivableStatus.PENDING;
            }
            await this.receivableRepo.save(rec as any);
          }
        }

        updated++;
      } catch (err: any) {
        errors.push(`NF ${invoice.numero}: ${err.message}`);
      }
    }

    return { processed: invoices.length, updated, errors };
  }
}
