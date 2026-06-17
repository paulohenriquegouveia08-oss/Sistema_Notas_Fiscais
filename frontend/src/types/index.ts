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
  cnpjCpf?: string
  inscricaoEstadual?: string
  telefone?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
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
  status: InvoiceStatus
  tipoPagamento?: string
  qtdeParcelas?: number
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
  errors: number
  details: ImportResult[]
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
