export enum InvoiceStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CANCELLED = 'CANCELLED',
  DENIED = 'DENIED',
}

export enum ReceivableStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  TRANSFER = 'TRANSFER',
  CHECK = 'CHECK',
  CARD = 'CARD',
  TERM = 'TERM',
}

export interface Customer {
  id: string
  razaoSocial: string
  nomeFantasia?: string
  cnpj?: string
  cpf?: string
  ie?: string
  telefone?: string
  email?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  id: string
  numero: string
  serie: string
  chaveAcesso: string
  dataEmissao: string
  dataEntrada?: string
  valorTotal: number
  valorProdutos?: number
  valorFrete?: number
  valorDesconto?: number
  valorTotalTributos?: number
  status: InvoiceStatus
  tipoPagamento?: string
  qtdeParcelas?: number
  infCpl?: string
  customerId: string
  customer?: Customer
  receivables?: Receivable[]
  xmlCompleto?: string
  pdfPath?: string
  createdAt: string
  updatedAt: string
}

export interface Receivable {
  id: string
  parcela: number
  valorOriginal: number
  valorReceber: number
  valorPago?: number
  dataVencimento: string
  dataPagamento?: string
  status: ReceivableStatus
  formaPagamento?: string
  paymentMethod?: string
  observacao?: string
  juros?: number
  multa?: number
  customerId: string
  customer?: Customer
  invoiceId: string
  invoice?: Invoice
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  valorPago: number
  paymentMethod: PaymentMethod
  dataPagamento: string
  juros?: number
  multa?: number
  observacao?: string
  customerId: string
  customer?: Customer
  receivable?: Receivable
  createdAt: string
}

export interface DashboardSummary {
  totalAReceber: number
  totalRecebido: number
  totalAtrasado: number
  totalPendente: number
  totalClientes: number
  totalNfes: number
  valorMedioPorCliente: number
  recebimentoProximos30Dias: number
  percentualInadimplencia: number
}

export interface MonthlyChartData {
  mes: string
  recebido: number
  pendente: number
  atrasado: number
}

export interface OverdueItem {
  customerId: string
  razaoSocial: string
  cnpjCpf?: string
  totalParcelasAtrasadas: number
  totalValorAtrasado: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface Settings {
  id: string
  razaoSocial?: string
  cnpj?: string
  certificateB64?: string
  certificatePassword?: string
  sefazAmbiente?: string
  createdAt: string
  updatedAt: string
}

export interface ImportResult {
  chaveAcesso: string
  numero: string
  serie: string
  customer: {
    id: string
    razaoSocial: string
    cnpj?: string
    cpf?: string
    isNew: boolean
  }
  invoice: {
    id: string
    isNew: boolean
  }
  receivables: Array<{
    id: string
    parcela: number
    valorOriginal: number
    valorReceber: number
    dataVencimento: string
    formaPagamento: string
  }>
  errors: string[]
}

export interface ImportResponse {
  total: number
  imported: number
  duplicated: number
  xmlsNovos: number
  xmlsVinculados: number
  errors: number
  details: ImportResult[]
}

export enum XmlDocumentStatus {
  VINCULADO = 'vinculado',
  SEM_NOTA = 'sem_nota',
}

export interface XmlDocument {
  id: string
  chaveAcesso: string
  invoiceId?: string
  customerId?: string
  nomeCliente: string
  numeroNota: string
  serie: string
  dataEmissao: string
  nomeArquivoOriginal: string
  nomeArquivoSistema: string
  caminhoArquivo: string
  tamanhoArquivo: number
  status: XmlDocumentStatus
  invoice?: Invoice
  customer?: Customer
  createdAt: string
  updatedAt: string
}

export interface PdfDocument {
  id: string
  originalName: string
  fileName: string
  fileSize: number
  observacao?: string
  fileExists?: boolean
  createdAt: string
  updatedAt: string
}

export interface ReportSummary {
  totalFaturamento: number
  totalRecebido: number
  totalAReceber: number
  totalAtrasado: number
  qtdNf: number
  qtdClientesAtivos: number
  ticketMedio: number
}

export interface PeriodData {
  periodo: string
  faturamento: number
  recebido: number
  qtdNf: number
  qtdPagamentos: number
}

export interface CustomerBreakdown {
  customerId: string
  razaoSocial: string
  qtdNf: number
  totalFaturado: number
  totalRecebido: number
  pendente: number
}

export interface ReportParams {
  startDate: string
  endDate: string
  period?: 'day' | 'week' | 'month'
}

export interface PeriodStatusData {
  periodo: string
  atrasado: number
  aberto: number
  pago: number
}
