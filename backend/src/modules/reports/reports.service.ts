import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Receivable } from '../receivables/entities/receivable.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Customer } from '../customers/entities/customer.entity';
import { InvoiceStatus } from '../../shared/enums/invoice-status.enum';
import { ReceivableStatus } from '../../shared/enums/receivable-status.enum';
import { ReportSummary, PeriodData, CustomerBreakdown } from '../../shared/types';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Receivable)
    private readonly receivableRepo: Repository<Receivable>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async getSummary(startDate: string, endDate: string): Promise<ReportSummary> {
    try {
      const [
        totalFaturamentoResult,
        totalRecebidoResult,
        totalAReceberResult,
        totalAtrasadoResult,
        qtdNfResult,
        qtdClientesResult,
      ] = await Promise.all([
        this.invoiceRepo
          .createQueryBuilder('i')
          .select('COALESCE(SUM(i.valorTotal), 0)', 'total')
          .where('i.dataEmissao >= :startDate', { startDate })
          .andWhere('i.dataEmissao <= :endDate', { endDate })
          .andWhere('i.status != :cancelled', { cancelled: InvoiceStatus.CANCELLED })
          .getRawOne(),

        this.paymentRepo
          .createQueryBuilder('p')
          .select('COALESCE(SUM(p.valorPago), 0)', 'total')
          .where('p.dataPagamento >= :startDate', { startDate })
          .andWhere('p.dataPagamento <= :endDate', { endDate })
          .getRawOne(),

        this.receivableRepo
          .createQueryBuilder('r')
          .select('COALESCE(SUM(r.valorReceber), 0)', 'total')
          .where('r.status IN (:...statuses)', {
            statuses: [ReceivableStatus.PENDING, ReceivableStatus.OVERDUE],
          })
          .andWhere('r.dataVencimento >= :startDate', { startDate })
          .andWhere('r.dataVencimento <= :endDate', { endDate })
          .getRawOne(),

        this.receivableRepo
          .createQueryBuilder('r')
          .select('COALESCE(SUM(r.valorReceber), 0)', 'total')
          .where('r.status = :status', { status: ReceivableStatus.OVERDUE })
          .andWhere('r.dataVencimento >= :startDate', { startDate })
          .andWhere('r.dataVencimento <= :endDate', { endDate })
          .getRawOne(),

        this.invoiceRepo
          .createQueryBuilder('i')
          .select('COUNT(i.id)', 'count')
          .where('i.dataEmissao >= :startDate', { startDate })
          .andWhere('i.dataEmissao <= :endDate', { endDate })
          .andWhere('i.status != :cancelled', { cancelled: InvoiceStatus.CANCELLED })
          .getRawOne(),

        this.customerRepo
          .createQueryBuilder('c')
          .where((qb) => {
            const invoiceSub = qb
              .subQuery()
              .select('1')
              .from(Invoice, 'i')
              .where('i.customerId = c.id')
              .andWhere('i.dataEmissao >= :startDate', { startDate })
              .andWhere('i.dataEmissao <= :endDate', { endDate })
              .getQuery();
            const receivableSub = qb
              .subQuery()
              .select('1')
              .from(Receivable, 'r')
              .where('r.customerId = c.id')
              .andWhere('r.dataVencimento >= :startDate', { startDate })
              .andWhere('r.dataVencimento <= :endDate', { endDate })
              .getQuery();
            return `EXISTS ${invoiceSub} OR EXISTS ${receivableSub}`;
          })
          .getCount(),
      ]);

      const totalFaturamento = parseFloat(totalFaturamentoResult?.total || '0');
      const totalRecebido = parseFloat(totalRecebidoResult?.total || '0');
      const totalAReceber = parseFloat(totalAReceberResult?.total || '0');
      const totalAtrasado = parseFloat(totalAtrasadoResult?.total || '0');
      const qtdNf = parseInt(qtdNfResult?.count || '0', 10);
      const qtdClientesAtivos = qtdClientesResult;
      const ticketMedio = qtdNf > 0 ? totalFaturamento / qtdNf : 0;

      return {
        totalFaturamento,
        totalRecebido,
        totalAReceber,
        totalAtrasado,
        qtdNf,
        qtdClientesAtivos,
        ticketMedio,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao buscar resumo: ${error.message}`);
      return {
        totalFaturamento: 0,
        totalRecebido: 0,
        totalAReceber: 0,
        totalAtrasado: 0,
        qtdNf: 0,
        qtdClientesAtivos: 0,
        ticketMedio: 0,
      };
    }
  }

  async getByPeriod(startDate: string, endDate: string, period: string): Promise<PeriodData[]> {
    try {
      const validPeriods = ['day', 'week', 'month'];
      const p = validPeriods.includes(period) ? period : 'month';

      const invoicesByPeriod = await this.invoiceRepo
        .createQueryBuilder('i')
        .select(`date_trunc('${p}', i.dataEmissao)`, 'periodo')
        .addSelect('COALESCE(SUM(i.valorTotal), 0)', 'faturamento')
        .addSelect('COUNT(i.id)', 'qtdNf')
        .where('i.dataEmissao >= :startDate', { startDate })
        .andWhere('i.dataEmissao <= :endDate', { endDate })
        .andWhere('i.status != :cancelled', { cancelled: InvoiceStatus.CANCELLED })
        .groupBy('periodo')
        .orderBy('periodo', 'ASC')
        .getRawMany();

      const paymentsByPeriod = await this.paymentRepo
        .createQueryBuilder('p')
        .select(`date_trunc('${p}', p.dataPagamento)`, 'periodo')
        .addSelect('COALESCE(SUM(p.valorPago), 0)', 'recebido')
        .addSelect('COUNT(p.id)', 'qtdPagamentos')
        .where('p.dataPagamento >= :startDate', { startDate })
        .andWhere('p.dataPagamento <= :endDate', { endDate })
        .groupBy('periodo')
        .orderBy('periodo', 'ASC')
        .getRawMany();

      const mergedMap = new Map<string, PeriodData>();

      invoicesByPeriod.forEach((row: any) => {
        const key = this.formatPeriodKey(row.periodo, p);
        mergedMap.set(key, {
          periodo: key,
          faturamento: parseFloat(row.faturamento || '0'),
          qtdNf: parseInt(row.qtdNf || '0', 10),
          recebido: 0,
          qtdPagamentos: 0,
        });
      });

      paymentsByPeriod.forEach((row: any) => {
        const key = this.formatPeriodKey(row.periodo, p);
        const existing = mergedMap.get(key);
        if (existing) {
          existing.recebido = parseFloat(row.recebido || '0');
          existing.qtdPagamentos = parseInt(row.qtdPagamentos || '0', 10);
        } else {
          mergedMap.set(key, {
            periodo: key,
            faturamento: 0,
            qtdNf: 0,
            recebido: parseFloat(row.recebido || '0'),
            qtdPagamentos: parseInt(row.qtdPagamentos || '0', 10),
          });
        }
      });

      return Array.from(mergedMap.values()).sort((a, b) =>
        a.periodo.localeCompare(b.periodo),
      );
    } catch (error: any) {
      this.logger.error(`Erro ao buscar dados por período: ${error.message}`);
      return [];
    }
  }

  async getByCustomer(startDate: string, endDate: string): Promise<CustomerBreakdown[]> {
    try {
      const result = await this.customerRepo
        .createQueryBuilder('c')
        .select('c.id', 'customerId')
        .addSelect('c.razaoSocial', 'razaoSocial')
        .addSelect(
          `(SELECT COUNT(i.id) FROM invoices i WHERE i.customerId = c.id AND i.dataEmissao >= :startDate AND i.dataEmissao <= :endDate AND i.status != :cancelled)`,
          'qtdNf',
        )
        .addSelect(
          `(SELECT COALESCE(SUM(i.valorTotal), 0) FROM invoices i WHERE i.customerId = c.id AND i.dataEmissao >= :startDate AND i.dataEmissao <= :endDate AND i.status != :cancelled)`,
          'totalFaturado',
        )
        .addSelect(
          `(SELECT COALESCE(SUM(r.valorPago), 0) FROM receivables r WHERE r.customerId = c.id AND r.status = :paid AND r.dataVencimento >= :startDate AND r.dataVencimento <= :endDate)`,
          'totalRecebido',
        )
        .addSelect(
          `(SELECT COALESCE(SUM(r.valorReceber), 0) FROM receivables r WHERE r.customerId = c.id AND r.status IN (:pending, :overdue) AND r.dataVencimento >= :startDate AND r.dataVencimento <= :endDate)`,
          'pendente',
        )
        .setParameters({
          startDate,
          endDate,
          cancelled: InvoiceStatus.CANCELLED,
          paid: ReceivableStatus.PAID,
          pending: ReceivableStatus.PENDING,
          overdue: ReceivableStatus.OVERDUE,
        })
        .having(
          '(SELECT COUNT(i.id) FROM invoices i WHERE i.customerId = c.id AND i.dataEmissao >= :startDate AND i.dataEmissao <= :endDate AND i.status != :cancelled) > 0' +
          ' OR (SELECT COUNT(r.id) FROM receivables r WHERE r.customerId = c.id AND r.dataVencimento >= :startDate AND r.dataVencimento <= :endDate) > 0',
          { startDate, endDate, cancelled: InvoiceStatus.CANCELLED },
        )
        .orderBy('"totalFaturado"', 'DESC')
        .getRawMany();

      return result.map((r: any) => ({
        customerId: r.customerId,
        razaoSocial: r.razaoSocial,
        qtdNf: parseInt(r.qtdNf || '0', 10),
        totalFaturado: parseFloat(r.totalFaturado || '0'),
        totalRecebido: parseFloat(r.totalRecebido || '0'),
        pendente: parseFloat(r.pendente || '0'),
      }));
    } catch (error: any) {
      this.logger.error(`Erro ao buscar dados por cliente: ${error.message}`);
      return [];
    }
  }

  async exportCsv(startDate: string, endDate: string): Promise<{ content: string; filename: string }> {
    try {
      const customerData = await this.getByCustomer(startDate, endDate);

      const header = 'Cliente,Qtd NFs,Faturado,Recebido,Pendente';
      const rows = customerData.map((c) =>
        [
          `"${c.razaoSocial.replace(/"/g, '""')}"`,
          c.qtdNf,
          c.totalFaturado.toFixed(2),
          c.totalRecebido.toFixed(2),
          c.pendente.toFixed(2),
        ].join(','),
      );

      const csv = [header, ...rows].join('\n');
      const filename = `relatorio-clientes-${startDate}-${endDate}.csv`;

      return { content: csv, filename };
    } catch (error: any) {
      this.logger.error(`Erro ao exportar CSV: ${error.message}`);
      throw error;
    }
  }

  async exportPdf(startDate: string, endDate: string): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const [summary, customerData] = await Promise.all([
          this.getSummary(startDate, endDate),
          this.getByCustomer(startDate, endDate),
        ]);

        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(20).text('Relatório Financeiro', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Período: ${startDate} a ${endDate}`, { align: 'center' });
        doc.moveDown(1);

        doc.fontSize(14).text('Resumo');
        doc.moveDown(0.5);
        doc.fontSize(10);
        doc.text(`Faturamento: R$ ${summary.totalFaturamento.toFixed(2)}`);
        doc.text(`Recebido: R$ ${summary.totalRecebido.toFixed(2)}`);
        doc.text(`A Receber: R$ ${summary.totalAReceber.toFixed(2)}`);
        doc.text(`Em Atraso: R$ ${summary.totalAtrasado.toFixed(2)}`);
        doc.text(`Qtd NFs: ${summary.qtdNf}`);
        doc.text(`Clientes Ativos: ${summary.qtdClientesAtivos}`);
        doc.text(`Ticket Médio: R$ ${summary.ticketMedio.toFixed(2)}`);
        doc.moveDown(1);

        doc.fontSize(14).text('Detalhamento por Cliente');
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const colWidths = [180, 50, 90, 90, 90];
        const headers = ['Cliente', 'NFs', 'Faturado', 'Recebido', 'Pendente'];

        doc.fontSize(9).font('Helvetica-Bold');
        let x = 50;
        headers.forEach((h, i) => {
          doc.text(h, x, tableTop, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });

        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(8);

        let y = doc.y;
        customerData.forEach((c) => {
          if (y > 750) {
            doc.addPage();
            y = 50;
          }
          x = 50;
          const values = [
            c.razaoSocial.substring(0, 30),
            String(c.qtdNf),
            `R$ ${c.totalFaturado.toFixed(2)}`,
            `R$ ${c.totalRecebido.toFixed(2)}`,
            `R$ ${c.pendente.toFixed(2)}`,
          ];
          values.forEach((v, i) => {
            doc.text(v, x, y, { width: colWidths[i], align: 'left' });
            x += colWidths[i];
          });
          y += 15;
        });

        doc.end();
      } catch (error: any) {
        this.logger.error(`Erro ao gerar PDF: ${error.message}`);
        reject(error);
      }
    });
  }

  private formatPeriodKey(dateValue: any, period: string): string {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    if (period === 'month') return `${year}-${month}`;
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
