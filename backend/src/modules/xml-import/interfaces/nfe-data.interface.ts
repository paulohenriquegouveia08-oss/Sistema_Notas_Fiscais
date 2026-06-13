export interface NfeCustomerData {
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
}

export interface NfeInstallment {
  nParcela: string;
  vParcela: string;
  dVenc: string;
}

export interface NfePaymentDetail {
  tPag: string;
  vPag: string;
  detPag?: NfeInstallment[];
  card?: NfeInstallment[];
  dup?: NfeInstallment[];
}

export interface NfePaymentInfo {
  detPag: NfePaymentDetail[];
  dup?: NfeInstallment[];
}

export interface NfeData {
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
  xmlCompleto?: string;
  customer: NfeCustomerData;
  paymentInfo: NfePaymentInfo;
}
