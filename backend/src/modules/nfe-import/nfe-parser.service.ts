import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { NfeData } from './interfaces/nfe-data.interface';

@Injectable()
export class NfeParserService {
  private readonly logger = new Logger(NfeParserService.name);
  private readonly xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: true,
      parseAttributeValue: true,
      trimValues: true,
    });
  }

  parse(xmlString: string): NfeData {
    const parsed = this.xmlParser.parse(xmlString);
    const nfeProc = parsed.nfeProc || parsed.NFe || parsed.nfeProc;
    const infNFe = nfeProc?.NFe || nfeProc?.infNFe || nfeProc?.InfNFe || nfeProc;
    const ide = infNFe?.ide || infNFe?.Ide;
    const emit = infNFe?.emit || infNFe?.Emit;
    const dest = infNFe?.dest || infNFe?.Dest;
    const total = infNFe?.total || infNFe?.Total;
    const ICMSTot = total?.ICMSTot || total?.icmsTot;
    const pag = infNFe?.pag || infNFe?.Pag;
    const infNfeSupl = nfeProc?.infNFeSupl || nfeProc?.InfNFeSupl;

    if (!ide || !dest) {
      throw new Error('XML de NF-e inválido: campos obrigatórios ausentes');
    }

    const chaveAcesso = this.extractChave(ide, nfeProc) || '';
    const numero = ide.nNF?.toString() || '';
    const serie = ide.serie?.toString() || '';
    const dataEmissao = ide.dhEmi || ide.dEmi || '';
    const dataEntrada = ide.dhSaiEnt || undefined;

    const valorTotal = parseFloat(ICMSTot?.vNF || total?.vNF || '0');
    const valorProdutos = parseFloat(ICMSTot?.vProd || total?.vProd || '0');
    const valorFrete = parseFloat(ICMSTot?.vFrete || total?.vFrete || '0');
    const valorDesconto = parseFloat(ICMSTot?.vDesc || total?.vDesc || '0');
    const valorTotalTributos = parseFloat(ICMSTot?.vTotTrib || total?.vTotTrib || '0');
    const baseCalculoIcms = parseFloat(ICMSTot?.vBC || total?.vBC || '0');
    const valorIcms = parseFloat(ICMSTot?.vICMS || total?.vICMS || '0');
    const baseCalculoIcmsSt = parseFloat(ICMSTot?.vBCST || total?.vBCST || '0');
    const valorIcmsSt = parseFloat(ICMSTot?.vICMSST || total?.vICMSST || '0');

    const detPag = pag?.detPag || pag?.DetPag || [];
    const pagArray = Array.isArray(detPag) ? detPag : [detPag];

    const paymentInfo = {
      detPag: pagArray.map((p: any) => ({
        tPag: p.tPag?.toString() || p?.TPag?.toString() || '99',
        vPag: p.vPag?.toString() || p?.VPag?.toString() || '0',
        detPag: p.detPag
          ? (Array.isArray(p.detPag) ? p.detPag : [p.detPag]).map((dp: any) => ({
              nParcela: dp.nParcela?.toString() || '1',
              vParcela: dp.vParcela?.toString() || '0',
              dVenc: dp.dVenc || '',
            }))
          : undefined,
        card: p.card
          ? (Array.isArray(p.card) ? p.card : [p.card]).map((c: any) => ({
              nParcela: c.nParcela?.toString() || '1',
              vParcela: c.vParcela?.toString() || '0',
              dVenc: c.dVenc || '',
            }))
          : undefined,
      })),
    };

    const enderDest = dest.enderDest || dest.enderDEST || dest.EnderDest || {};

    return {
      chaveAcesso,
      numero,
      serie,
      dataEmissao,
      dataEntrada,
      valorTotal,
      baseCalculoIcms,
      valorIcms,
      baseCalculoIcmsSt,
      valorIcmsSt,
      valorProdutos,
      valorFrete,
      valorDesconto,
      valorTotalTributos,
      xmlCompleto: xmlString,
      customer: {
        cnpj: dest.CNPJ ? this.sanitizeCnpj(dest.CNPJ.toString()) : undefined,
        cpf: dest.CPF ? dest.CPF.toString() : undefined,
        razaoSocial: dest.xNome || 'Cliente sem nome',
        nomeFantasia: dest.xFantasia || undefined,
        ie: dest.IE || undefined,
        email: dest.email || dest.Email || undefined,
        telefone: enderDest.fone || undefined,
        cep: enderDest.CEP || undefined,
        logradouro: enderDest.xLgr || undefined,
        numero: enderDest.nro || undefined,
        complemento: enderDest.xCpl || undefined,
        bairro: enderDest.xBairro || undefined,
        cidade: enderDest.xMun || undefined,
        uf: enderDest.UF || undefined,
      },
      paymentInfo,
    };
  }

  private extractChave(ide: any, nfeProc: any): string {
    if (nfeProc?.protNFe?.infProt?.chaveNFe) {
      return nfeProc.protNFe.infProt.chaveNFe;
    }
    const idAttr = nfeProc?.NFe?.['@_Id'] || nfeProc?.['@_Id'] || '';
    if (idAttr && idAttr.startsWith('NFe')) {
      return idAttr.replace('NFe', '');
    }
    return ide?.cNF ? `${ide.cNF}` : '';
  }

  private sanitizeCnpj(cnpj: string): string {
    return cnpj.replace(/\D/g, '');
  }
}
