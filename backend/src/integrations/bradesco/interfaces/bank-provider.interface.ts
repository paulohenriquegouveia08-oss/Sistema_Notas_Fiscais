export interface BankProvider {
  authenticate(): Promise<string>;
  createBoleto(data: any): Promise<any>;
  getBoletoStatus(nossoNumero: string): Promise<string>;
  cancelBoleto(nossoNumero: string): Promise<void>;
}
