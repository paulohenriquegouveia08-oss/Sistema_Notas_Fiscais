import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import PDFDocument from 'pdfkit';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Receivable } from '../receivables/entities/receivable.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CompanySettings } from '../settings/entities/company-settings.entity';
import { InvoiceStatus } from '../../shared/enums/invoice-status.enum';
import { ReceivableStatus } from '../../shared/enums/receivable-status.enum';
import {
  ReportSummary,
  PeriodData,
  CustomerBreakdown,
  OverdueDetail,
  TopDebtor,
  ForecastBucket,
  InvoiceDetail,
} from '../../shared/types';

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
    @InjectRepository(CompanySettings)
    private readonly settingsRepo: Repository<CompanySettings>,
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

  async getOverdueDetailed(): Promise<OverdueDetail[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await this.receivableRepo
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.customer', 'c')
        .leftJoinAndSelect('r.invoice', 'i')
        .where('r.status = :status', { status: ReceivableStatus.OVERDUE })
        .orderBy('r.dataVencimento', 'ASC')
        .getMany();

      return result.map((r) => {
        const vencDate = new Date(r.dataVencimento);
        const todayDate = new Date(today);
        const diasAtraso = Math.floor((todayDate.getTime() - vencDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          customerId: r.customerId,
          razaoSocial: r.customer?.razaoSocial || '',
          cnpjCpf: r.customer?.cnpj || r.customer?.cpf || undefined,
          telefone: r.customer?.telefone || undefined,
          cidade: r.customer?.cidade || undefined,
          uf: r.customer?.uf || undefined,
          invoiceNumero: r.invoice?.numero || '',
          invoiceSerie: r.invoice?.serie || '',
          parcela: r.parcela,
          dataVencimento: r.dataVencimento,
          diasAtraso,
          valorOriginal: parseFloat(String(r.valorOriginal)),
          valorReceber: parseFloat(String(r.valorReceber)),
          juros: parseFloat(String(r.juros || 0)),
          multa: parseFloat(String(r.multa || 0)),
        };
      });
    } catch (error: any) {
      this.logger.error(`Erro ao buscar inadimplência detalhada: ${error.message}`);
      return [];
    }
  }

  async getTopDebtors(): Promise<TopDebtor[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await this.receivableRepo
        .createQueryBuilder('r')
        .select('r.customerId', 'customerId')
        .addSelect('c.razaoSocial', 'razaoSocial')
        .addSelect('COALESCE(c.cnpj, c.cpf)', 'cnpjCpf')
        .addSelect('COALESCE(SUM(r.valorReceber), 0)', 'totalDevido')
        .addSelect('COUNT(r.id)', 'qtdParcelas')
        .addSelect(`MAX(EXTRACT(DAY FROM DATE '${today}' - r.dataVencimento))`, 'maiorAtraso')
        .leftJoin(Customer, 'c', 'c.id = r.customerId')
        .where('r.status = :status', { status: ReceivableStatus.OVERDUE })
        .groupBy('r.customerId')
        .addGroupBy('c.razaoSocial')
        .addGroupBy('c.cnpj')
        .addGroupBy('c.cpf')
        .orderBy('"totalDevido"', 'DESC')
        .limit(10)
        .getRawMany();

      const totalGeral = result.reduce((sum, r) => sum + parseFloat(r.totalDevido || '0'), 0);

      return result.map((r, i) => ({
        position: i + 1,
        customerId: r.customerId,
        razaoSocial: r.razaoSocial,
        cnpjCpf: r.cnpjCpf || undefined,
        totalDevido: parseFloat(r.totalDevido || '0'),
        qtdParcelas: parseInt(r.qtdParcelas || '0', 10),
        maiorAtraso: parseInt(r.maiorAtraso || '0', 10),
        percentualTotal: totalGeral > 0 ? (parseFloat(r.totalDevido || '0') / totalGeral) * 100 : 0,
      }));
    } catch (error: any) {
      this.logger.error(`Erro ao buscar top devedores: ${error.message}`);
      return [];
    }
  }

  async getPaymentForecast(): Promise<ForecastBucket[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const buckets = [
        { faixa: 'Vence em 7 dias', dias: 7 },
        { faixa: 'Vence em 15 dias', dias: 15 },
        { faixa: 'Vence em 30 dias', dias: 30 },
        { faixa: 'Vence em 60 dias', dias: 60 },
        { faixa: 'Vence em 90+ dias', dias: 999 },
      ];

      const results: ForecastBucket[] = [];
      let prevDias = 0;

      for (const bucket of buckets) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + bucket.dias);
        const endStr = endDate.toISOString().split('T')[0];

        let query = this.receivableRepo
          .createQueryBuilder('r')
          .select('COALESCE(SUM(r.valorReceber), 0)', 'total')
          .addSelect('COUNT(r.id)', 'qtd')
          .where('r.status = :status', { status: ReceivableStatus.PENDING })
          .andWhere('r.dataVencimento > :today', { today });

        if (prevDias > 0) {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() + prevDias);
          const startStr = startDate.toISOString().split('T')[0];
          query = query.andWhere('r.dataVencimento > :start', { start: startStr });
        }

        if (bucket.dias < 999) {
          query = query.andWhere('r.dataVencimento <= :end', { end: endStr });
        }

        const raw = await query.getRawOne();
        results.push({
          faixa: bucket.faixa,
          total: parseFloat(raw?.total || '0'),
          qtd: parseInt(raw?.qtd || '0', 10),
        });

        prevDias = bucket.dias;
      }

      return results;
    } catch (error: any) {
      this.logger.error(`Erro ao buscar previsão de recebimento: ${error.message}`);
      return [];
    }
  }

  async getInvoicesByPeriod(startDate: string, endDate: string): Promise<InvoiceDetail[]> {
    try {
      const today = new Date();
      const result = await this.invoiceRepo
        .createQueryBuilder('i')
        .leftJoinAndSelect('i.customer', 'c')
        .where('i.dataEmissao >= :startDate', { startDate })
        .andWhere('i.dataEmissao <= :endDate', { endDate })
        .andWhere('i.status != :cancelled', { cancelled: InvoiceStatus.CANCELLED })
        .orderBy('i.dataEmissao', 'DESC')
        .getMany();

      return result.map((i) => {
        const emissaoDate = new Date(i.dataEmissao);
        const diasDesdeEmissao = Math.floor((today.getTime() - emissaoDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: i.id,
          numero: i.numero,
          serie: i.serie,
          clienteRazaoSocial: i.customer?.razaoSocial || '',
          clienteCnpjCpf: i.customer?.cnpj || i.customer?.cpf || undefined,
          dataEmissao: i.dataEmissao.toString().split('T')[0],
          valorTotal: parseFloat(String(i.valorTotal)),
          qtdParcelas: i.qtdeParcelas || 0,
          status: i.status,
          diasDesdeEmissao,
        };
      });
    } catch (error: any) {
      this.logger.error(`Erro ao buscar NFs do período: ${error.message}`);
      return [];
    }
  }

  async getCompanySettings() {
    try {
      const settings = await this.settingsRepo.findOne({ where: {} });
      return settings || {};
    } catch (error: any) {
      this.logger.error(`Erro ao buscar configurações: ${error.message}`);
      return {};
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
        const [
          settings,
          summary,
          overdueDetailed,
          topDebtors,
          forecast,
          invoices,
          customerData,
        ] = await Promise.all([
          this.getCompanySettings(),
          this.getSummary(startDate, endDate),
          this.getOverdueDetailed(),
          this.getTopDebtors(),
          this.getPaymentForecast(),
          this.getInvoicesByPeriod(startDate, endDate),
          this.getByCustomer(startDate, endDate),
        ]);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const today = new Date().toLocaleDateString('pt-BR');
        const empresa = (settings as any).razaoSocial || 'Empresa';
        const cnpj = (settings as any).cnpj || '';

        // === CAPA ===
        doc.fontSize(24).font('Helvetica-Bold').text('RELATORIO FINANCEIRO', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(14).font('Helvetica').text(empresa, { align: 'center' });
        if (cnpj) doc.fontSize(10).text(`CNPJ: ${cnpj}`, { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(12).text(`Periodo: ${startDate} a ${endDate}`, { align: 'center' });
        doc.fontSize(10).text(`Gerado em: ${today}`, { align: 'center' });
        doc.moveDown(1.5);

        // Linha separadora
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        // === RESUMO EXECUTIVO ===
        this.drawSectionTitle(doc, 'RESUMO EXECUTIVO');
        doc.moveDown(0.3);

        const percentConclusao = summary.totalFaturamento > 0
          ? ((summary.totalRecebido / summary.totalFaturamento) * 100).toFixed(1)
          : '0';
        const percentInadimplencia = summary.totalAReceber > 0
          ? ((summary.totalAtrasado / summary.totalAReceber) * 100).toFixed(1)
          : '0';

        const kpis: Array<[string, string]> = [
          ['Faturamento do Periodo', `R$ ${summary.totalFaturamento.toFixed(2)}`],
          ['Total Recebido', `R$ ${summary.totalRecebido.toFixed(2)}`],
          ['Total a Receber', `R$ ${summary.totalAReceber.toFixed(2)}`],
          ['Em Atraso', `R$ ${summary.totalAtrasado.toFixed(2)}`],
          ['Conclusao', `${percentConclusao}%`],
          ['Inadimplencia', `${percentInadimplencia}%`],
          ['NFs Emitidas', String(summary.qtdNf)],
          ['Clientes Ativos', String(summary.qtdClientesAtivos)],
          ['Ticket Medio', `R$ ${summary.ticketMedio.toFixed(2)}`],
        ];

        this.drawKpiGrid(doc, kpis);
        doc.moveDown(0.5);

        // Linha separadora
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        // === INADIMPLENCIA DETALHADA ===
        if (overdueDetailed.length > 0) {
          this.checkPageBreak(doc, 120);
          this.drawSectionTitle(doc, 'INADIMPLENCIA DETALHADA');
          doc.moveDown(0.3);
          doc.fontSize(8).font('Helvetica').text(
            `Total de parcelas em atraso: ${overdueDetailed.length} | Valor total em atraso: R$ ${summary.totalAtrasado.toFixed(2)}`,
          );
          doc.moveDown(0.3);

          const odHeaders = ['Cliente', 'NF', 'Parc', 'Vencimento', 'Dias', 'Valor', 'Juros', 'Multa'];
          const odWidths = [140, 40, 30, 65, 35, 70, 60, 60];
          this.drawTableHeader(doc, odHeaders, odWidths);
          doc.moveDown(0.2);

          doc.font('Helvetica').fontSize(7);
          for (const item of overdueDetailed) {
            if (doc.y > 740) {
              doc.addPage();
              this.drawTableHeader(doc, odHeaders, odWidths);
              doc.moveDown(0.2);
              doc.font('Helvetica').fontSize(7);
            }
            const y = doc.y;
            let x = 50;
            const vals = [
              item.razaoSocial.substring(0, 22),
              `${item.invoiceNumero}/${item.invoiceSerie}`,
              String(item.parcela),
              item.dataVencimento,
              `${item.diasAtraso}d`,
              `R$ ${item.valorReceber.toFixed(2)}`,
              `R$ ${item.juros.toFixed(2)}`,
              `R$ ${item.multa.toFixed(2)}`,
            ];
            vals.forEach((v, i) => {
              doc.text(v, x, y, { width: odWidths[i], align: 'left' });
              x += odWidths[i];
            });
            doc.y = y + 10;
          }
          doc.moveDown(0.5);
        }

        // === RANKING DE DEVEDORES ===
        if (topDebtors.length > 0) {
          this.checkPageBreak(doc, 100);
          this.drawSectionTitle(doc, 'RANKING DE DEVEDORES');
          doc.moveDown(0.3);

          const tdHeaders = ['#', 'Cliente', 'CNPJ/CPF', 'Total Devido', 'Parcelas', 'Maior Atraso', '% do Total'];
          const tdWidths = [20, 140, 90, 80, 45, 70, 60];
          this.drawTableHeader(doc, tdHeaders, tdWidths);
          doc.moveDown(0.2);

          doc.font('Helvetica').fontSize(8);
          for (const item of topDebtors) {
            if (doc.y > 740) {
              doc.addPage();
              this.drawTableHeader(doc, tdHeaders, tdWidths);
              doc.moveDown(0.2);
              doc.font('Helvetica').fontSize(8);
            }
            const y = doc.y;
            let x = 50;
            const vals = [
              String(item.position),
              item.razaoSocial.substring(0, 22),
              item.cnpjCpf || '-',
              `R$ ${item.totalDevido.toFixed(2)}`,
              String(item.qtdParcelas),
              `${item.maiorAtraso} dias`,
              `${item.percentualTotal.toFixed(1)}%`,
            ];
            vals.forEach((v, i) => {
              doc.text(v, x, y, { width: tdWidths[i], align: 'left' });
              x += tdWidths[i];
            });
            doc.y = y + 12;
          }
          doc.moveDown(0.5);
        }

        // === PREVISAO DE RECEBIMENTO ===
        this.checkPageBreak(doc, 100);
        this.drawSectionTitle(doc, 'PREVISAO DE RECEBIMENTO');
        doc.moveDown(0.3);

        const totalForecast = forecast.reduce((s, b) => s + b.total, 0);
        const totalQtdForecast = forecast.reduce((s, b) => s + b.qtd, 0);
        doc.fontSize(8).font('Helvetica').text(
          `Total a receber (pendente): R$ ${totalForecast.toFixed(2)} | ${totalQtdForecast} parcelas`,
        );
        doc.moveDown(0.3);

        const fcHeaders = ['Faixa', 'Qtd Parcelas', 'Valor Previsto', '% do Total'];
        const fcWidths = [150, 100, 120, 100];
        this.drawTableHeader(doc, fcHeaders, fcWidths);
        doc.moveDown(0.2);

        doc.font('Helvetica').fontSize(9);
        for (const bucket of forecast) {
          const y = doc.y;
          let x = 50;
          const pct = totalForecast > 0 ? ((bucket.total / totalForecast) * 100).toFixed(1) : '0';
          const vals = [
            bucket.faixa,
            String(bucket.qtd),
            `R$ ${bucket.total.toFixed(2)}`,
            `${pct}%`,
          ];
          vals.forEach((v, i) => {
            doc.text(v, x, y, { width: fcWidths[i], align: 'left' });
            x += fcWidths[i];
          });
          doc.y = y + 14;
        }
        doc.moveDown(0.5);

        // === DETALHAMENTO POR CLIENTE ===
        if (customerData.length > 0) {
          this.checkPageBreak(doc, 100);
          doc.addPage();
          this.drawSectionTitle(doc, 'DETALHAMENTO POR CLIENTE');
          doc.moveDown(0.3);

          const cdHeaders = ['Cliente', 'NFs', 'Faturado', 'Recebido', 'Pendente'];
          const cdWidths = [180, 40, 90, 90, 90];
          this.drawTableHeader(doc, cdHeaders, cdWidths);
          doc.moveDown(0.2);

          doc.font('Helvetica').fontSize(8);
          for (const c of customerData) {
            if (doc.y > 740) {
              doc.addPage();
              this.drawTableHeader(doc, cdHeaders, cdWidths);
              doc.moveDown(0.2);
              doc.font('Helvetica').fontSize(8);
            }
            const y = doc.y;
            let x = 50;
            const vals = [
              c.razaoSocial.substring(0, 30),
              String(c.qtdNf),
              `R$ ${c.totalFaturado.toFixed(2)}`,
              `R$ ${c.totalRecebido.toFixed(2)}`,
              `R$ ${c.pendente.toFixed(2)}`,
            ];
            vals.forEach((v, i) => {
              doc.text(v, x, y, { width: cdWidths[i], align: 'left' });
              x += cdWidths[i];
            });
            doc.y = y + 12;
          }
        }

        // === NOTAS FISCAIS DO PERIODO ===
        if (invoices.length > 0) {
          this.checkPageBreak(doc, 100);
          doc.addPage();
          this.drawSectionTitle(doc, 'NOTAS FISCAIS DO PERIODO');
          doc.moveDown(0.3);

          const nfHeaders = ['NF/Serie', 'Cliente', 'Emissao', 'Valor', 'Parcelas', 'Status', 'Dias'];
          const nfWidths = [55, 150, 65, 75, 45, 60, 40];
          this.drawTableHeader(doc, nfHeaders, nfWidths);
          doc.moveDown(0.2);

          doc.font('Helvetica').fontSize(7);
          for (const nf of invoices) {
            if (doc.y > 740) {
              doc.addPage();
              this.drawTableHeader(doc, nfHeaders, nfWidths);
              doc.moveDown(0.2);
              doc.font('Helvetica').fontSize(7);
            }
            const y = doc.y;
            let x = 50;
            const vals = [
              `${nf.numero}/${nf.serie}`,
              nf.clienteRazaoSocial.substring(0, 24),
              nf.dataEmissao,
              `R$ ${nf.valorTotal.toFixed(2)}`,
              String(nf.qtdParcelas),
              nf.status,
              `${nf.diasDesdeEmissao}d`,
            ];
            vals.forEach((v, i) => {
              doc.text(v, x, y, { width: nfWidths[i], align: 'left' });
              x += nfWidths[i];
            });
            doc.y = y + 10;
          }
        }

        // === RODAPE ===
        doc.moveDown(2);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.3);
        doc.fontSize(7).font('Helvetica').text(
          `Documento gerado automaticamente pelo Sistema Financeiro | ${today}`,
          { align: 'center' },
        );

        doc.end();
      } catch (error: any) {
        this.logger.error(`Erro ao gerar PDF: ${error.message}`);
        reject(error);
      }
    });
  }

  private drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.fontSize(13).font('Helvetica-Bold').text(title);
    doc.moveDown(0.1);
    doc.fontSize(7).font('Helvetica').text('_'.repeat(80));
    doc.moveDown(0.2);
  }

  private drawKpiGrid(doc: PDFKit.PDFDocument, kpis: Array<[string, string]>) {
    doc.fontSize(8).font('Helvetica');
    for (const [label, value] of kpis) {
      const y = doc.y;
      doc.font('Helvetica-Bold').text(`${label}: `, 50, y, { continued: true, width: 150 });
      doc.font('Helvetica').text(value);
      doc.y = y + 12;
    }
  }

  private drawTableHeader(doc: PDFKit.PDFDocument, headers: string[], widths: number[]) {
    doc.fontSize(8).font('Helvetica-Bold');
    let x = 50;
    const y = doc.y;
    doc.rect(50, y - 2, widths.reduce((a, b) => a + b, 0), 14).fill('#f0f0f0');
    doc.fillColor('black');
    headers.forEach((h, i) => {
      doc.text(h, x, y, { width: widths[i], align: 'left' });
      x += widths[i];
    });
    doc.y = y + 14;
  }

  private checkPageBreak(doc: PDFKit.PDFDocument, neededHeight: number) {
    if (doc.y + neededHeight > 780) {
      doc.addPage();
    }
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
