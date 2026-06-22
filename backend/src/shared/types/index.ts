import { InvoiceStatus } from '../enums/invoice-status.enum';
import { ReceivableStatus } from '../enums/receivable-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';

export interface Customer {
  id: string;
  cnpj?: string;
  cpf?: string;
  razaoSocial: string;
  nomeFantasia?: string;
  ie?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  dataEntrada?: string;
  valorTotal: number;
  baseCalculoIcms?: number;
  valorIcms?: number;
  baseCalculoIcmsSt?: number;
  valorIcmsSt?: number;
  valorProdutos?: number;
  valorFrete?: number;
  valorDesconto?: number;
  valorTotalTributos?: number;
  status: InvoiceStatus;
  xmlCompleto?: string;
  chaveAcessoReferenciada?: string;
  customerId: string;
  customer?: Customer;
  createdAt: string;
  updatedAt: string;
}

export interface Receivable {
  id: string;
  parcela: number;
  valorOriginal: number;
  valorReceber: number;
  valorPago?: number;
  dataVencimento: string;
  dataPagamento?: string;
  dataCancelamento?: string;
  status: ReceivableStatus;
  juros?: number;
  multa?: number;
  observacao?: string;
  formaPagamento?: string;
  customerId: string;
  customer?: Customer;
  invoiceId: string;
  invoice?: Invoice;
  paymentId?: string;
  payment?: Payment;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  valorPago: number;
  paymentMethod: PaymentMethod;
  dataPagamento: string;
  juros?: number;
  multa?: number;
  observacao?: string;
  customerId: string;
  customer?: Customer;
  receivables?: Receivable[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  totalAReceber: number;
  totalRecebido: number;
  totalAtrasado: number;
  totalPendente: number;
  totalClientes: number;
  totalNfes: number;
  valorMedioPorCliente: number;
  recebimentoProximos30Dias: number;
  percentualInadimplencia: number;
}

export interface MonthlyChartData {
  mes: string;
  recebido: number;
  pendente: number;
  atrasado: number;
}

export interface OverdueCustomer {
  customerId: string;
  razaoSocial: string;
  cnpjCpf?: string;
  totalParcelasAtrasadas: number;
  totalValorAtrasado: number;
}

export interface ReportSummary {
  totalFaturamento: number;
  totalRecebido: number;
  totalAReceber: number;
  totalAtrasado: number;
  qtdNf: number;
  qtdClientesAtivos: number;
  ticketMedio: number;
}

export interface PeriodData {
  periodo: string;
  faturamento: number;
  qtdNf: number;
  recebido: number;
  qtdPagamentos: number;
}

export interface CustomerBreakdown {
  customerId: string;
  razaoSocial: string;
  qtdNf: number;
  totalFaturado: number;
  totalRecebido: number;
  pendente: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SettingsResponse {
  id: string;
  razaoSocial?: string;
  cnpj?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OverdueDetail {
  customerId: string;
  razaoSocial: string;
  cnpjCpf?: string;
  telefone?: string;
  cidade?: string;
  uf?: string;
  invoiceNumero: string;
  invoiceSerie: string;
  parcela: number;
  dataVencimento: string;
  diasAtraso: number;
  valorOriginal: number;
  valorReceber: number;
  juros: number;
  multa: number;
}

export interface TopDebtor {
  position: number;
  customerId: string;
  razaoSocial: string;
  cnpjCpf?: string;
  totalDevido: number;
  qtdParcelas: number;
  maiorAtraso: number;
  percentualTotal: number;
}

export interface ForecastBucket {
  faixa: string;
  total: number;
  qtd: number;
}

export interface InvoiceDetail {
  id: string;
  numero: string;
  serie: string;
  clienteRazaoSocial: string;
  clienteCnpjCpf?: string;
  dataEmissao: string;
  valorTotal: number;
  qtdParcelas: number;
  status: string;
  diasDesdeEmissao: number;
}
