import { Injectable } from '@nestjs/common';

@Injectable()
export class BradescoAuthService {
  async authenticate(): Promise<string> {
    throw new Error('BradescoAuthService: Método não implementado');
  }
}
