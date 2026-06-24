import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { NfeData } from '../interfaces/nfe-data.interface';

@Injectable()
export class NfeXmlParser {
  private readonly logger = new Logger(NfeXmlParser.name);
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
    const nfeNode = nfeProc?.NFe || nfeProc;
    const infNFe = nfeNode?.infNFe || nfeNode?.InfNFe || nfeNode;
    if (!infNFe) {
      throw new Error('Estrutura NF-e não encontrada no XML');
    }

    const ide = infNFe?.ide || infNFe?.Ide;
    const dest = infNFe?.dest || infNFe?.Dest;
    const total = infNFe?.total || infNFe?.Total;
    const ICMSTot = total?.ICMSTot || total?.icmsTot;
    const pag = infNFe?.pag || infNFe?.Pag;
    const cobr = infNFe?.cobr || infNFe?.Cobr;

    if (!ide || !dest) {
      throw new Error('XML de NF-e inválido: campos obrigatórios ausentes');
    }

    const chaveAcesso = this.extractChave(ide, nfeProc, infNFe) || '';
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

    const paymentInfo = this.parsePayment(pag, cobr);

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

  private parsePayment(pag: any, cobr: any) {
    const detPag = pag?.detPag || pag?.DetPag || [];
    const pagArray = Array.isArray(detPag) ? detPag : [detPag];

    const dup = cobr?.dup || cobr?.Dup || [];
    const dupArray = Array.isArray(dup) ? dup : dup ? [dup] : [];

    const hasCobr = dupArray.length > 0;

    return {
      detPag: pagArray.map((p: any) => ({
        tPag: p.tPag?.toString() || p?.TPag?.toString() || '99',
        vPag: p.vPag?.toString() || p?.VPag?.toString() || '0',
        indPag: p.indPag?.toString() || undefined,
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
      dup: hasCobr
        ? dupArray.map((d: any) => ({
            nParcela: d.nDup?.toString() || '1',
            vParcela: d.vDup?.toString() || '0',
            dVenc: d.dVenc || '',
          }))
        : undefined,
    };
  }

  private extractChave(ide: any, nfeProc: any, infNFe?: any): string {
    if (nfeProc?.protNFe?.infProt?.chaveNFe) {
      return nfeProc.protNFe.infProt.chaveNFe;
    }
    const idAttr = infNFe?.['@_Id'] || nfeProc?.NFe?.['@_Id'] || nfeProc?.['@_Id'] || '';
    if (idAttr && idAttr.startsWith('NFe')) {
      return idAttr.replace('NFe', '');
    }
    return ide?.cNF ? `${ide.cNF}` : '';
  }

  private sanitizeCnpj(cnpj: string): string {
    return cnpj.replace(/\D/g, '');
  }
}
