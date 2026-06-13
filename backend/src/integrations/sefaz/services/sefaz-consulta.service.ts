import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { CertificateService } from './certificate.service';
import * as https from 'https';

@Injectable()
export class SefazConsultaService {
  private readonly logger = new Logger(SefazConsultaService.name);

  constructor(
    private readonly certificateService: CertificateService,
  ) {}

  async consultarNFe(chaveAcesso: string): Promise<string> {
    const agent = await this.certificateService.getHttpsAgent();
    if (!agent) {
      throw new Error('Certificado A1 não configurado. Acesse Configurações para fazer upload.');
    }

    const ambiente = await this.certificateService.getAmbiente();
    const uf = '41';
    const url = this.getUrl(ambiente, uf);
    const soapXml = this.buildSoapXml(ambiente, chaveAcesso);

    this.logger.log(`Consultando SEFAZ: chave=${chaveAcesso}, ambiente=${ambiente}`);

    try {
      const response = await axios.post(url, soapXml, {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/soap+xml;charset=UTF-8;action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo/consSitNFe"',
        },
        timeout: 30000,
      });

      const xmlResponse = typeof response.data === 'string' ? response.data : response.data.toString();
      return this.extractNFeXml(xmlResponse);
    } catch (err: any) {
      this.logger.error(`Erro na consulta SEFAZ: ${err.message}`);
      throw new Error(`Erro ao consultar SEFAZ: ${err.message}`);
    }
  }

  private buildSoapXml(ambiente: string, chave: string): string {
    const tpAmb = ambiente === 'producao' ? '1' : '2';
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo">
      <versaoDados>4.00</versaoDados>
      <cUF>41</cUF>
    </nfeCabecMsg>
  </soap:Header>
  <soap:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo">
      <consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <tpAmb>${tpAmb}</tpAmb>
        <xServ>CONSULTAR</xServ>
        <chNFe>${chave}</chNFe>
      </consSitNFe>
    </nfeDadosMsg>
  </soap:Body>
</soap:Envelope>`;
  }

  private getUrl(ambiente: string, uf: string): string {
    if (ambiente === 'producao') {
      return `https://www.sefazvirtual.gov.br/ws/NFeConsultaProtocolo/NFeConsultaProtocolo.asmx`;
    }
    return `https://hom1.sefazvirtual.gov.br/ws/NFeConsultaProtocolo/NFeConsultaProtocolo.asmx`;
  }

  private extractNFeXml(soapResponse: string): string {
    const match = soapResponse.match(/<retConsSitNFe[\s\S]*?<\/retConsSitNFe>/);
    if (!match) {
      throw new Error('Resposta SEFAZ não contém retConsSitNFe');
    }

    const retCons = match[0];

    const cStatMatch = retCons.match(/<cStat>(\d+)<\/cStat>/);
    const xMotivoMatch = retCons.match(/<xMotivo>([\s\S]*?)<\/xMotivo>/);

    if (cStatMatch && cStatMatch[1] !== '100' && cStatMatch[1] !== '101') {
      throw new Error(`SEFAZ: ${xMotivoMatch?.[1]?.trim() || 'Erro desconhecido'} (cStat=${cStatMatch[1]})`);
    }

    const nfeMatch = soapResponse.match(/<nfeProc[\s\S]*?<\/nfeProc>/);
    if (!nfeMatch) {
      const protMatch = soapResponse.match(/<protNFe[\s\S]*?<\/protNFe>/);
      if (protMatch) {
        const nfeMatch2 = soapResponse.match(/<NFe[\s\S]*?<\/NFe>/);
        if (nfeMatch2) {
          const prot = protMatch[0].replace('</protNFe>', '').replace('<protNFe', '<protNFe');
          const nfePart = nfeMatch2[0];
          const procMatch = soapResponse.match(/<nfeProc[\s\S]*?(<\/nfeProc>|<\/procNFe>)/);
          if (procMatch) return procMatch[0];
          return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">${nfePart}${protMatch[0]}</nfeProc>`;
        }
      }
      throw new Error('XML da NF-e não encontrado na resposta SEFAZ');
    }

    return nfeMatch[0];
  }
}
