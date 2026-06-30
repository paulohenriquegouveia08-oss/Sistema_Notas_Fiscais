export interface ImportResult {
  chaveAcesso: string;
  numero: string;
  serie: string;
  customer: {
    id: string;
    razaoSocial: string;
    cnpj?: string;
    cpf?: string;
    isNew: boolean;
  };
  invoice: {
    id: string;
    isNew: boolean;
  };
  receivables: Array<{
    id: string;
    parcela: number;
    valorOriginal: number;
    valorReceber: number;
    dataVencimento: string;
    formaPagamento: string;
  }>;
  xmlDocument?: {
    id: string;
    isNew: boolean;
  };
  acao?: string;
  mensagem?: string;
  errors: string[];
}
