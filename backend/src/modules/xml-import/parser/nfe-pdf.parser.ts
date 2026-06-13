import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NfePdfParser {
  private readonly logger = new Logger(NfePdfParser.name);

  async extractChaveAcesso(pdfBuffer: Buffer): Promise<string> {
    let text: string;

    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(pdfBuffer);
      text = data.text;
    } catch (err: any) {
      throw new Error(`Erro ao ler PDF: ${err.message}`);
    }

    const chaveMatch = text.match(/\b(\d{44})\b/);
    if (!chaveMatch) {
      throw new Error('Chave de acesso de 44 dígitos não encontrada no PDF');
    }

    return chaveMatch[1];
  }
}
