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

  async getByPeriodAndStatus(
    startDate: string,
    endDate: string,
    period: string,
  ): Promise<Array<{ periodo: string; atrasado: number; aberto: number; pago: number }>> {
    try {
      const validPeriods = ['day', 'week', 'month'];
      const p = validPeriods.includes(period) ? period : 'month';

      const result = await this.receivableRepo
        .createQueryBuilder('r')
        .select(`date_trunc('${p}', r.dataVencimento)`, 'periodo')
        .addSelect(
          `COALESCE(SUM(CASE WHEN r.status = :overdue THEN r.valorReceber ELSE 0 END), 0)`,
          'atrasado',
        )
        .addSelect(
          `COALESCE(SUM(CASE WHEN r.status = :pending THEN r.valorReceber ELSE 0 END), 0)`,
          'aberto',
        )
        .addSelect(
          `COALESCE(SUM(CASE WHEN r.status = :paid THEN r.valorPago ELSE 0 END), 0)`,
          'pago',
        )
        .where('r.dataVencimento >= :startDate', { startDate })
        .andWhere('r.dataVencimento <= :endDate', { endDate })
        .andWhere('r.status != :cancelled', { cancelled: ReceivableStatus.CANCELLED })
        .setParameters({
          overdue: ReceivableStatus.OVERDUE,
          pending: ReceivableStatus.PENDING,
          paid: ReceivableStatus.PAID,
        })
        .groupBy('periodo')
        .orderBy('periodo', 'ASC')
        .getRawMany();

      return result.map((row: any) => ({
        periodo: this.formatPeriodKey(row.periodo, p),
        atrasado: parseFloat(row.atrasado || '0'),
        aberto: parseFloat(row.aberto || '0'),
        pago: parseFloat(row.pago || '0'),
      }));
    } catch (error: any) {
      this.logger.error(`Erro ao buscar dados por período e status: ${error.message}`);
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

        const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const today = new Date().toLocaleDateString('pt-BR');
        const empresa = (settings as any).razaoSocial || 'Empresa';
        const cnpj = (settings as any).cnpj || '';
        const endereco = [
          (settings as any).logradouro,
          (settings as any).numero,
          (settings as any).bairro,
          (settings as any).cidade,
          (settings as any).uf,
        ].filter(Boolean).join(', ');

        const percentConclusao = summary.totalFaturamento > 0
          ? ((summary.totalRecebido / summary.totalFaturamento) * 100).toFixed(1)
          : '0';
        const percentInadimplencia = summary.totalAReceber > 0
          ? ((summary.totalAtrasado / summary.totalAReceber) * 100).toFixed(1)
          : '0';

        // === CAPA ===
        doc.rect(0, 0, 595, 120).fill('#1a365d');
        doc.fillColor('white').fontSize(28).font('Helvetica-Bold').text('RELATORIO FINANCEIRO', 50, 35, { align: 'center', width: 495 });
        doc.fontSize(14).font('Helvetica').text(empresa, 50, 70, { align: 'center', width: 495 });
        if (cnpj) doc.fontSize(10).text(`CNPJ: ${cnpj}`, 50, 90, { align: 'center', width: 495 });

        doc.fillColor('black');
        doc.y = 140;
        doc.fontSize(11).font('Helvetica').text(`Periodo: ${startDate} a ${endDate}`, { align: 'center' });
        doc.fontSize(9).text(`Gerado em: ${today}`, { align: 'center' });
        if (endereco) doc.fontSize(8).text(endereco, { align: 'center' });
        doc.moveDown(1);

        // Cards de resumo visual na capa
        const cardY = doc.y;
        const cardWidth = 150;
        const cardGap = 15;
        const cards = [
          { label: 'FATURADO', value: `R$ ${summary.totalFaturamento.toFixed(2)}`, color: '#2b6cb0' },
          { label: 'RECEBIDO', value: `R$ ${summary.totalRecebido.toFixed(2)}`, color: '#276749' },
          { label: 'EM ATRASO', value: `R$ ${summary.totalAtrasado.toFixed(2)}`, color: '#c53030' },
        ];
        cards.forEach((card, i) => {
          const cx = 50 + i * (cardWidth + cardGap);
          doc.roundedRect(cx, cardY, cardWidth, 55, 5).fill(card.color);
          doc.fillColor('white').fontSize(8).font('Helvetica-Bold').text(card.label, cx + 10, cardY + 8, { width: cardWidth - 20 });
          doc.fontSize(11).font('Helvetica-Bold').text(card.value, cx + 10, cardY + 25, { width: cardWidth - 20 });
          doc.fillColor('black');
        });
        doc.y = cardY + 70;

        // Indicador de inadimplencia
        const inadCor = parseFloat(percentInadimplencia) > 20 ? '#c53030' : parseFloat(percentInadimplencia) > 10 ? '#d69e2e' : '#276749';
        doc.roundedRect(50, doc.y, 495, 30, 5).fill(inadCor);
        doc.fillColor('white').fontSize(10).font('Helvetica-Bold').text(
          `INADIMPLENCIA: ${percentInadimplencia}% | ${overdueDetailed.length} parcelas atrasadas | ${topDebtors.length} clientes inadimplentes`,
          60, doc.y + 9, { width: 475 },
        );
        doc.fillColor('black');
        doc.y += 45;

        // === RESUMO EXECUTIVO ===
        this.drawSectionTitle(doc, 'RESUMO EXECUTIVO', '#1a365d');
        doc.moveDown(0.3);

        // Grid de KPIs 3x3
        const kpisData = [
          { label: 'Faturamento', value: `R$ ${summary.totalFaturamento.toFixed(2)}`, color: '#2b6cb0' },
          { label: 'Recebido', value: `R$ ${summary.totalRecebido.toFixed(2)}`, color: '#276749' },
          { label: 'A Receber', value: `R$ ${summary.totalAReceber.toFixed(2)}`, color: '#d69e2e' },
          { label: 'Em Atraso', value: `R$ ${summary.totalAtrasado.toFixed(2)}`, color: '#c53030' },
          { label: 'Conclusao', value: `${percentConclusao}%`, color: '#276749' },
          { label: 'Inadimplencia', value: `${percentInadimplencia}%`, color: '#c53030' },
          { label: 'NFs Emitidas', value: String(summary.qtdNf), color: '#2b6cb0' },
          { label: 'Clientes Ativos', value: String(summary.qtdClientesAtivos), color: '#2b6cb0' },
          { label: 'Ticket Medio', value: `R$ ${summary.ticketMedio.toFixed(2)}`, color: '#2b6cb0' },
        ];
        this.drawKpiCards(doc, kpisData);
        doc.moveDown(0.5);

        // === INADIMPLENCIA DETALHADA ===
        if (overdueDetailed.length > 0) {
          this.checkPageBreak(doc, 120);
          this.drawSectionTitle(doc, 'INADIMPLENCIA DETALHADA', '#c53030');
          doc.moveDown(0.3);

          // Resumo visual
          const totalJuros = overdueDetailed.reduce((s, i) => s + i.juros, 0);
          const totalMulta = overdueDetailed.reduce((s, i) => s + i.multa, 0);
          doc.fontSize(8).font('Helvetica').fillColor('#c53030').text(
            `ATENCAO: ${overdueDetailed.length} parcelas atrasadas | Valor: R$ ${summary.totalAtrasado.toFixed(2)} | Juros: R$ ${totalJuros.toFixed(2)} | Multa: R$ ${totalMulta.toFixed(2)}`,
          );
          doc.fillColor('black');
          doc.moveDown(0.3);

          const odHeaders = ['Cliente', 'NF/Parc', 'Vencimento', 'Dias Atraso', 'Valor', 'Juros', 'Multa'];
          const odWidths = [140, 55, 65, 60, 80, 55, 55];
          this.drawTableHeader(doc, odHeaders, odWidths, '#fed7d7');
          doc.moveDown(0.2);

          doc.font('Helvetica').fontSize(7);
          for (let idx = 0; idx < overdueDetailed.length; idx++) {
            const item = overdueDetailed[idx];
            if (doc.y > 740) {
              doc.addPage();
              this.drawTableHeader(doc, odHeaders, odWidths, '#fed7d7');
              doc.moveDown(0.2);
              doc.font('Helvetica').fontSize(7);
            }
            const y = doc.y;
            if (idx % 2 === 0) doc.rect(50, y - 2, odWidths.reduce((a, b) => a + b, 0), 12).fill('#fff5f5');
            doc.fillColor('black');
            let x = 50;
            const diasColor = item.diasAtraso > 90 ? '#c53030' : item.diasAtraso > 30 ? '#d69e2e' : '#276749';
            const vals = [
              item.razaoSocial.substring(0, 22),
              `${item.invoiceNumero}/${item.parcela}`,
              item.dataVencimento,
              `${item.diasAtraso} dias`,
              `R$ ${item.valorReceber.toFixed(2)}`,
              `R$ ${item.juros.toFixed(2)}`,
              `R$ ${item.multa.toFixed(2)}`,
            ];
            vals.forEach((v, i) => {
              if (i === 3) doc.fillColor(diasColor).font('Helvetica-Bold');
              doc.text(v, x, y, { width: odWidths[i], align: 'left' });
              if (i === 3) doc.fillColor('black').font('Helvetica');
              x += odWidths[i];
            });
            doc.y = y + 10;
          }
          doc.moveDown(0.5);
        }

        // === RANKING DE DEVEDORES ===
        if (topDebtors.length > 0) {
          this.checkPageBreak(doc, 100);
          this.drawSectionTitle(doc, 'RANKING DE DEVEDORES', '#c53030');
          doc.moveDown(0.3);

          const tdHeaders = ['#', 'Cliente', 'CNPJ/CPF', 'Total Devido', 'Parcelas', 'Maior Atraso', '% do Total'];
          const tdWidths = [20, 140, 90, 80, 45, 70, 60];
          this.drawTableHeader(doc, tdHeaders, tdWidths, '#fed7d7');
          doc.moveDown(0.2);

          doc.font('Helvetica').fontSize(8);
          for (let idx = 0; idx < topDebtors.length; idx++) {
            const item = topDebtors[idx];
            if (doc.y > 740) {
              doc.addPage();
              this.drawTableHeader(doc, tdHeaders, tdWidths, '#fed7d7');
              doc.moveDown(0.2);
              doc.font('Helvetica').fontSize(8);
            }
            const y = doc.y;
            if (idx % 2 === 0) doc.rect(50, y - 2, tdWidths.reduce((a, b) => a + b, 0), 14).fill('#fff5f5');
            doc.fillColor('black');
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
        this.checkPageBreak(doc, 120);
        this.drawSectionTitle(doc, 'PREVISAO DE RECEBIMENTO', '#2b6cb0');
        doc.moveDown(0.3);

        const totalForecast = forecast.reduce((s, b) => s + b.total, 0);
        const totalQtdForecast = forecast.reduce((s, b) => s + b.qtd, 0);

        // Cards de previsao
        const prevY = doc.y;
        const prevCards = [
          { label: 'Total Previsto', value: `R$ ${totalForecast.toFixed(2)}`, color: '#2b6cb0' },
          { label: 'Total Parcelas', value: String(totalQtdForecast), color: '#276749' },
        ];
        prevCards.forEach((card, i) => {
          const cx = 50 + i * 200;
          doc.roundedRect(cx, prevY, 180, 35, 3).fill(card.color);
          doc.fillColor('white').fontSize(7).font('Helvetica-Bold').text(card.label, cx + 8, prevY + 5, { width: 164 });
          doc.fontSize(10).font('Helvetica-Bold').text(card.value, cx + 8, prevY + 18, { width: 164 });
          doc.fillColor('black');
        });
        doc.y = prevY + 45;

        const fcHeaders = ['Faixa', 'Qtd Parcelas', 'Valor Previsto', '% do Total'];
        const fcWidths = [150, 100, 120, 100];
        this.drawTableHeader(doc, fcHeaders, fcWidths, '#bee3f8');
        doc.moveDown(0.2);

        doc.font('Helvetica').fontSize(9);
        for (let idx = 0; idx < forecast.length; idx++) {
          const bucket = forecast[idx];
          if (doc.y > 740) {
            doc.addPage();
            this.drawTableHeader(doc, fcHeaders, fcWidths, '#bee3f8');
            doc.moveDown(0.2);
            doc.font('Helvetica').fontSize(9);
          }
          const y = doc.y;
          if (idx % 2 === 0) doc.rect(50, y - 2, fcWidths.reduce((a, b) => a + b, 0), 14).fill('#ebf8ff');
          doc.fillColor('black');
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
          this.drawSectionTitle(doc, 'DETALHAMENTO POR CLIENTE', '#276749');
          doc.moveDown(0.3);

          const cdHeaders = ['Cliente', 'NFs', 'Faturado', 'Recebido', 'Pendente'];
          const cdWidths = [180, 40, 90, 90, 90];
          this.drawTableHeader(doc, cdHeaders, cdWidths, '#c6f6d5');
          doc.moveDown(0.2);

          doc.font('Helvetica').fontSize(8);
          for (let idx = 0; idx < customerData.length; idx++) {
            const c = customerData[idx];
            if (doc.y > 740) {
              doc.addPage();
              this.drawTableHeader(doc, cdHeaders, cdWidths, '#c6f6d5');
              doc.moveDown(0.2);
              doc.font('Helvetica').fontSize(8);
            }
            const y = doc.y;
            if (idx % 2 === 0) doc.rect(50, y - 2, cdWidths.reduce((a, b) => a + b, 0), 12).fill('#f0fff4');
            doc.fillColor('black');
            let x = 50;
            const pendColor = c.pendente > 0 ? '#c53030' : '#276749';
            const vals = [
              c.razaoSocial.substring(0, 30),
              String(c.qtdNf),
              `R$ ${c.totalFaturado.toFixed(2)}`,
              `R$ ${c.totalRecebido.toFixed(2)}`,
              `R$ ${c.pendente.toFixed(2)}`,
            ];
            vals.forEach((v, i) => {
              if (i === 4 && c.pendente > 0) doc.fillColor(pendColor).font('Helvetica-Bold');
              doc.text(v, x, y, { width: cdWidths[i], align: 'left' });
              if (i === 4) { doc.fillColor('black').font('Helvetica'); }
              x += cdWidths[i];
            });
            doc.y = y + 12;
          }
        }

        // === NOTAS FISCAIS DO PERIODO ===
        if (invoices.length > 0) {
          this.checkPageBreak(doc, 100);
          doc.addPage();
          this.drawSectionTitle(doc, 'NOTAS FISCAIS DO PERIODO', '#2b6cb0');
          doc.moveDown(0.3);

          doc.fontSize(8).font('Helvetica').text(
            `Total: ${invoices.length} NFs | Valor total: R$ ${invoices.reduce((s, i) => s + i.valorTotal, 0).toFixed(2)}`,
          );
          doc.moveDown(0.3);

          const nfHeaders = ['NF/Serie', 'Cliente', 'Emissao', 'Valor', 'Parcelas', 'Status', 'Dias'];
          const nfWidths = [55, 150, 65, 75, 45, 60, 40];
          this.drawTableHeader(doc, nfHeaders, nfWidths, '#bee3f8');
          doc.moveDown(0.2);

          doc.font('Helvetica').fontSize(7);
          for (let idx = 0; idx < invoices.length; idx++) {
            const nf = invoices[idx];
            if (doc.y > 740) {
              doc.addPage();
              this.drawTableHeader(doc, nfHeaders, nfWidths, '#bee3f8');
              doc.moveDown(0.2);
              doc.font('Helvetica').fontSize(7);
            }
            const y = doc.y;
            if (idx % 2 === 0) doc.rect(50, y - 2, nfWidths.reduce((a, b) => a + b, 0), 10).fill('#ebf8ff');
            doc.fillColor('black');
            let x = 50;
            const statusColor = nf.status === 'AUTHORIZED' ? '#276749' : nf.status === 'CANCELLED' ? '#c53030' : '#d69e2e';
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
              if (i === 5) doc.fillColor(statusColor).font('Helvetica-Bold');
              doc.text(v, x, y, { width: nfWidths[i], align: 'left' });
              if (i === 5) { doc.fillColor('black').font('Helvetica'); }
              x += nfWidths[i];
            });
            doc.y = y + 10;
          }
        }

        // === RODAPE ===
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; doc.switchToPage(i), i++) {
          doc.fontSize(7).font('Helvetica').fillColor('#718096');
          doc.text(
            `Sistema Financeiro | Pagina ${i + 1} de ${totalPages} | Gerado em ${today}`,
            50, doc.page.height - 30, { align: 'center', width: 495 },
          );
          doc.fillColor('black');
        }

        doc.end();
      } catch (error: any) {
        this.logger.error(`Erro ao gerar PDF: ${error.message}`);
        reject(error);
      }
    });
  }

  private drawSectionTitle(doc: PDFKit.PDFDocument, title: string, color: string = '#1a365d') {
    const y = doc.y;
    doc.rect(50, y - 2, 495, 20).fill(color);
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold').text(title, 58, y + 2, { width: 480 });
    doc.fillColor('black');
    doc.y = y + 22;
  }

  private drawKpiCards(doc: PDFKit.PDFDocument, kpis: Array<{ label: string; value: string; color: string }>) {
    const cols = 3;
    const cardW = 155;
    const cardH = 45;
    const gap = 10;
    const startX = 50;

    for (let i = 0; i < kpis.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = doc.y + row * (cardH + gap);

      doc.roundedRect(x, y, cardW, cardH, 4).fill(kpis[i].color);
      doc.fillColor('white').fontSize(7).font('Helvetica-Bold').text(kpis[i].label, x + 8, y + 6, { width: cardW - 16 });
      doc.fontSize(12).font('Helvetica-Bold').text(kpis[i].value, x + 8, y + 22, { width: cardW - 16 });
      doc.fillColor('black');
    }
    doc.y += Math.ceil(kpis.length / cols) * (cardH + gap) + 5;
  }

  private drawTableHeader(doc: PDFKit.PDFDocument, headers: string[], widths: number[], bgColor: string = '#edf2f7') {
    doc.fontSize(8).font('Helvetica-Bold');
    let x = 50;
    const y = doc.y;
    doc.rect(50, y - 2, widths.reduce((a, b) => a + b, 0), 14).fill(bgColor);
    doc.fillColor('#1a365d');
    headers.forEach((h, i) => {
      doc.text(h, x, y, { width: widths[i], align: 'left' });
      x += widths[i];
    });
    doc.fillColor('black');
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
