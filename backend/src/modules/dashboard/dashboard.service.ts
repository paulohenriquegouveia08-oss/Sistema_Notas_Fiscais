import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Receivable } from '../receivables/entities/receivable.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Payment } from '../payments/entities/payment.entity';
import { ReceivableStatus } from '../../shared/enums/receivable-status.enum';
import {
  DashboardSummary,
  MonthlyChartData,
  OverdueCustomer,
} from '../../shared/types';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Receivable)
    private readonly receivableRepo: Repository<Receivable>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const [
        totalAReceberResult,
        totalVencidoResult,
        totalPendenteResult,
        totalRecebidoMesResult,
        recebimentoProximos30Result,
        totalClientes,
        totalNfes,
      ] = await Promise.all([
        this.receivableRepo
          .createQueryBuilder('r')
          .select('COALESCE(SUM(r.valorReceber), 0)', 'total')
          .where('r.status IN (:...statuses)', {
            statuses: [ReceivableStatus.PENDING, ReceivableStatus.OVERDUE],
          })
          .getRawOne(),

        this.receivableRepo
          .createQueryBuilder('r')
          .select('COALESCE(SUM(r.valorReceber), 0)', 'total')
          .where('r.status = :status', { status: ReceivableStatus.OVERDUE })
          .getRawOne(),

        this.receivableRepo
          .createQueryBuilder('r')
          .select('COALESCE(SUM(r.valorReceber), 0)', 'total')
          .where('r.status = :status', { status: ReceivableStatus.PENDING })
          .getRawOne(),

        this.paymentRepo
          .createQueryBuilder('p')
          .select('COALESCE(SUM(p.valorPago), 0)', 'total')
          .where('p.dataPagamento >= :startOfMonth', { startOfMonth: startOfMonth.toISOString().split('T')[0] })
          .andWhere('p.dataPagamento <= :endOfMonth', { endOfMonth: endOfMonth.toISOString().split('T')[0] })
          .getRawOne(),

        this.receivableRepo
          .createQueryBuilder('r')
          .select('COALESCE(SUM(r.valorReceber), 0)', 'total')
          .where('r.status = :status', { status: ReceivableStatus.PENDING })
          .andWhere('r.dataVencimento >= :now', { now: now.toISOString().split('T')[0] })
          .andWhere('r.dataVencimento <= :thirtyDays', { thirtyDays: thirtyDaysFromNow.toISOString().split('T')[0] })
          .getRawOne(),

        this.customerRepo.count(),
        this.invoiceRepo.count(),
      ]);

      const totalAReceber = parseFloat(totalAReceberResult?.total || '0');
      const totalAtrasado = parseFloat(totalVencidoResult?.total || '0');
      const totalPendente = parseFloat(totalPendenteResult?.total || '0');
      const totalRecebido = parseFloat(totalRecebidoMesResult?.total || '0');
      const recebimentoProximos30Dias = parseFloat(recebimentoProximos30Result?.total || '0');

      return {
        totalAReceber,
        totalRecebido,
        totalAtrasado,
        totalPendente,
        totalClientes,
        totalNfes,
        valorMedioPorCliente: totalClientes > 0 ? totalAReceber / totalClientes : 0,
        recebimentoProximos30Dias,
        percentualInadimplencia: totalAReceber > 0
          ? parseFloat(((totalAtrasado / totalAReceber) * 100).toFixed(2))
          : 0,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao buscar resumo do dashboard: ${error.message}`);
      return {
        totalAReceber: 0, totalRecebido: 0, totalAtrasado: 0,
        totalPendente: 0, totalClientes: 0, totalNfes: 0,
        valorMedioPorCliente: 0, recebimentoProximos30Dias: 0,
        percentualInadimplencia: 0,
      };
    }
  }

  async getMonthlyChart(): Promise<MonthlyChartData[]> {
    try {
      const now = new Date();
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const startDate = twelveMonthsAgo.toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];

      const payments = await this.paymentRepo
        .createQueryBuilder('p')
        .select("to_char(CAST(p.dataPagamento AS DATE), 'YYYY-MM')", 'mes')
        .addSelect('COALESCE(SUM(p.valorPago), 0)', 'recebido')
        .where('p.dataPagamento >= :startDate', { startDate })
        .andWhere('p.dataPagamento <= :endDate', { endDate })
        .groupBy('mes')
        .orderBy('mes', 'ASC')
        .getRawMany();

      const pendingByMonth = await this.receivableRepo
        .createQueryBuilder('r')
        .select("to_char(CAST(r.dataVencimento AS DATE), 'YYYY-MM')", 'mes')
        .addSelect('COALESCE(SUM(r.valorReceber), 0)', 'pendente')
        .where('r.status = :status', { status: ReceivableStatus.PENDING })
        .andWhere('r.dataVencimento >= :startDate', { startDate })
        .andWhere('r.dataVencimento <= :endDate', { endDate })
        .groupBy('mes')
        .orderBy('mes', 'ASC')
        .getRawMany();

      const overdueByMonth = await this.receivableRepo
        .createQueryBuilder('r')
        .select("to_char(CAST(r.dataVencimento AS DATE), 'YYYY-MM')", 'mes')
        .addSelect('COALESCE(SUM(r.valorReceber), 0)', 'atrasado')
        .where('r.status = :status', { status: ReceivableStatus.OVERDUE })
        .andWhere('r.dataVencimento >= :startDate', { startDate })
        .andWhere('r.dataVencimento <= :endDate', { endDate })
        .groupBy('mes')
        .orderBy('mes', 'ASC')
        .getRawMany();

      const paymentMap = new Map<string, number>();
      const pendingMap = new Map<string, number>();
      const overdueMap = new Map<string, number>();

      payments.forEach((r: any) => paymentMap.set(r.mes, parseFloat(r.recebido || '0')));
      pendingByMonth.forEach((r: any) => pendingMap.set(r.mes, parseFloat(r.pendente || '0')));
      overdueByMonth.forEach((r: any) => overdueMap.set(r.mes, parseFloat(r.atrasado || '0')));

      const chartData: MonthlyChartData[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        chartData.push({
          mes,
          recebido: paymentMap.get(mes) || 0,
          pendente: pendingMap.get(mes) || 0,
          atrasado: overdueMap.get(mes) || 0,
        });
      }

      return chartData;
    } catch (error: any) {
      this.logger.error(`Erro ao buscar gráfico mensal: ${error.message}`, error.stack);
      return [];
    }
  }

  async getOverdueList(): Promise<OverdueCustomer[]> {
    try {
      const result = await this.receivableRepo
        .createQueryBuilder('r')
        .select('r.customerId', 'customerId')
        .addSelect('c.razaoSocial', 'razaoSocial')
        .addSelect('COALESCE(c.cnpj, c.cpf)', 'cnpjCpf')
        .addSelect('COALESCE(SUM(r.valorReceber), 0)', 'totalValorAtrasado')
        .addSelect('COUNT(r.id)', 'totalParcelasAtrasadas')
        .leftJoin(Customer, 'c', 'c.id = r.customerId')
        .where('r.status = :status', { status: ReceivableStatus.OVERDUE })
        .groupBy('r.customerId')
        .addGroupBy('c.razaoSocial')
        .addGroupBy('c.cnpj')
        .addGroupBy('c.cpf')
        .orderBy('"totalValorAtrasado"', 'DESC')
        .limit(10)
        .getRawMany();

      return result.map((r: any) => ({
        customerId: r.customerId,
        razaoSocial: r.razaoSocial,
        cnpjCpf: r.cnpjCpf || undefined,
        totalParcelasAtrasadas: parseInt(r.totalParcelasAtrasadas || '0', 10),
        totalValorAtrasado: parseFloat(r.totalValorAtrasado || '0'),
      }));
    } catch (error: any) {
      this.logger.error(`Erro ao buscar inadimplentes: ${error.message}`);
      return [];
    }
  }
}
