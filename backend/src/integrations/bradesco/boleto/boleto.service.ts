import { Injectable } from '@nestjs/common';

@Injectable()
export class BoletoService {
  async createBoleto(data: any): Promise<any> {
    throw new Error('BoletoService.createBoleto: Método não implementado');
  }

  async getBoletoStatus(nossoNumero: string): Promise<string> {
    throw new Error('BoletoService.getBoletoStatus: Método não implementado');
  }

  async cancelBoleto(nossoNumero: string): Promise<void> {
    throw new Error('BoletoService.cancelBoleto: Método não implementado');
  }
}
