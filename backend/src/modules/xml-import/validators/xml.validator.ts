import { Injectable } from '@nestjs/common';

@Injectable()
export class XmlValidator {
  validate(xmlContent: string): { valid: boolean; message?: string } {
    if (!xmlContent || xmlContent.trim().length === 0) {
      return { valid: false, message: 'XML vazio' };
    }

    const hasNfeNamespace =
      xmlContent.includes('xmlns="http://www.portalfiscal.inf.br/nfe"') ||
      xmlContent.includes("xmlns='http://www.portalfiscal.inf.br/nfe'");
    if (!hasNfeNamespace) {
      return { valid: false, message: 'XML não é uma NF-e (namespace ausente)' };
    }

    const hasChaveAcesso =
      xmlContent.includes('<chaveNFe>') ||
      xmlContent.includes('Id="NFe') ||
      xmlContent.includes("Id='NFe");
    if (!hasChaveAcesso) {
      return { valid: false, message: 'Chave de acesso não encontrada no XML' };
    }

    const hasIde = xmlContent.includes('<ide>') || xmlContent.includes('<Ide>');
    const hasDest = xmlContent.includes('<dest>') || xmlContent.includes('<Dest>');
    if (!hasIde || !hasDest) {
      return { valid: false, message: 'XML de NF-e inválido: campos ide/dest ausentes' };
    }

    return { valid: true };
  }
}
