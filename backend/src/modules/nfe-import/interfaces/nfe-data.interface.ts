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
  chaveAcessoReferenciada?: string;
  customer: {
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
  };
  paymentInfo: {
    detPag: Array<{
      tPag: string;
      vPag: string;
      detPag?: Array<{
        nParcela: string;
        vParcela: string;
        dVenc: string;
      }>;
      card?: Array<{
        nParcela: string;
        vParcela: string;
        dVenc: string;
      }>;
    }>;
  };
}
