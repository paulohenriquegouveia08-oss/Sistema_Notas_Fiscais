import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { Invoice } from '../invoices/entities/invoice.entity';
import { CompanySettings } from '../settings/entities/company-settings.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Receivable } from '../receivables/entities/receivable.entity';
import { PdfDocument } from './entities/pdf-document.entity';
import { XMLParser } from 'fast-xml-parser';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'pdf-storage');

export interface GeneratePdfOptions {
  overrideDateTime?: string | Date;
  overrideProductDescription?: string;
  overrideProductCode?: string;
  overrideSerie?: string;
  overrideUnitValue?: number;
  overrideQuantity?: number;
  outputDir?: string;
  persistDocument?: boolean;
  originalNameSuffix?: string;
}

// ── Formatters ──────────────────────────────────────────

function fmtDate(iso: string | Date | undefined | null): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('pt-BR');
}

function fmtTime(iso: string | Date | undefined | null): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function asText(v: any): string {
  return v === undefined || v === null ? '' : String(v);
}

function firstText(...values: any[]): string {
  for (const value of values) {
    const txt = asText(value).trim();
    if (txt) return txt;
  }
  return '';
}

function fmtXmlDate(dateTime: any): string {
  const s = asText(dateTime);
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function fmtXmlTime(dateTime: any): string {
  const s = asText(dateTime);
  const time = s.slice(11, 19);
  return /^\d{2}:\d{2}:\d{2}$/.test(time) ? time : '';
}

function fmtOverrideDateTime(dateTime: string | Date | undefined): { date: string; time: string } | null {
  if (!dateTime) return null;

  if (dateTime instanceof Date) {
    return {
      date: fmtDate(dateTime),
      time: fmtTime(dateTime),
    };
  }

  const value = dateTime.trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return {
      date: `${day}/${month}/${year}`,
      time: hour && minute ? `${hour}:${minute}:${second || '00'}` : '',
    };
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      date: fmtDate(parsed),
      time: fmtTime(parsed),
    };
  }

  return null;
}

function maskCnpj(v: string): string {
  const d = v.replace(/\D/g, '');
  // CNPJ sometimes loses leading zero when stored as number → pad to 14
  const padded = (d.length === 13) ? '0' + d : d;
  if (padded.length === 14) return padded.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (padded.length === 11) return padded.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return v;
}

function maskCep(v: string): string {
  const d = v.replace(/\D/g, '');
  return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : v;
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return v;
}

function currencyBR(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : (v || 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBRL(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : (v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtQty(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : (v || 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function fmtUnit(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : (v || 0);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function fmtCST(orig: string | undefined, csosn: string | undefined): string {
  const o = orig || '0';
  const c = csosn || '';
  return o + c.padStart(3, '0');
}

function formatChave(chave: string): string {
  return chave.replace(/(.{4})/g, '$1 ').trim();
}

function splitName(name: string, maxLen = 26): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLen && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.slice(0, 2);
}

// ── Layout Constants ────────────────────────────────────

const PG = 595;
const ML = 14;
const MR = 14;
const PW = PG - ML - MR; // 567

const LBL = '#000000';
const TXT = '#000000';

// ── Draw helpers ────────────────────────────────────────

function box(doc: any, x: number, y: number, w: number, h: number, lw = 0.25, radius = 3) {
  doc.roundedRect(x, y, w, h, radius).lineWidth(lw).stroke();
}

function text(doc: any, txt: string, x: number, y: number, sz: number, opts?: any) {
  const color = opts?.color || TXT;
  const align = opts?.align || 'left';
  const font = opts?.font || 'Helvetica';
  doc.font(font).fontSize(sz).fillColor(color);
  if (align === 'right') {
    const tw = doc.widthOfString(txt);
    doc.text(txt, x - tw, y, { lineBreak: false });
  } else if (align === 'center') {
    const tw = doc.widthOfString(txt);
    doc.text(txt, x + (opts?.w || 0) / 2 - tw / 2, y, { lineBreak: false });
  } else {
    doc.text(txt, x, y, { lineBreak: false });
  }
  doc.fillColor(TXT);
}

function cell(doc: any, label: string, value: string, x: number, y: number, w: number, h: number,
  valign = 'center', lw = 0.25) {
  box(doc, x, y, w, h, lw);
  text(doc, label, x + 2, y + 1, 4, { color: LBL });
  const vy = valign === 'bottom' ? y + h - 9 : y + 11;
  text(doc, value, x + 2, vy, 7);
}

function cellTop(doc: any, label: string, value: string, x: number, y: number, w: number, h: number) {
  box(doc, x, y, w, h);
  text(doc, label, x + 2, y + 1, 4, { color: LBL });
  text(doc, value, x + 2, y + 10, 7);
}

function dateTimeCell(doc: any, label: string, value: string, x: number, y: number, w: number, h: number) {
  box(doc, x, y, w, h);
  text(doc, label, x + 2, y + 1, 4, { color: LBL });
  text(doc, value, x + 2, y + 10, 7);
}

// ── Service ─────────────────────────────────────────────

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private readonly xmlParser: XMLParser;

  constructor(
    @InjectRepository(PdfDocument)
    private readonly pdfDocRepo: Repository<PdfDocument>,
  ) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      parseAttributeValue: true,
      trimValues: true,
    });
  }

  async generateForInvoice(
    invoice: Invoice,
    customer: Customer,
    settings: CompanySettings | null,
    receivables: Receivable[],
    options?: GeneratePdfOptions,
  ): Promise<{ pdfDoc: PdfDocument; filePath: string } | null> {
    const { products, protocolo } = this.parseProducts(invoice.xmlCompleto);
    return this.generate(invoice, customer, settings, receivables, products, protocolo, options);
  }

  async generate(
    invoice: Invoice,
    customer: Customer,
    settings: CompanySettings | null,
    receivables: Receivable[],
    products: any[],
    protocolo?: string,
    options: GeneratePdfOptions = {},
  ): Promise<{ pdfDoc: PdfDocument; filePath: string } | null> {
    const PDFDocument = require('pdfkit');
    const bwipjs = require('bwip-js');

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: { Title: `DANFE ${invoice.numero}`, Author: 'Sistema Financeiro' },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const endPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const xmlData = this.parseFullXml(invoice.xmlCompleto);

    let effectiveProducts = [...products];
    if (options.overrideProductDescription) {
      effectiveProducts = effectiveProducts.map((p) => ({ ...p, descricao: options.overrideProductDescription }));
    }
    if (options.overrideProductCode) {
      effectiveProducts = effectiveProducts.map((p) => ({ ...p, codigo: options.overrideProductCode }));
    }
    if (options.overrideUnitValue !== undefined) {
      effectiveProducts = effectiveProducts.map((p) => {
        const unitVal = Number(options.overrideUnitValue);
        const qty = options.overrideQuantity !== undefined ? Number(options.overrideQuantity) : Number(p.qCom);
        return { ...p, vUnCom: unitVal, vProd: unitVal * qty };
      });
    }
    if (options.overrideQuantity !== undefined && options.overrideUnitValue === undefined) {
      effectiveProducts = effectiveProducts.map((p) => {
        const qty = Number(options.overrideQuantity);
        return { ...p, qCom: qty, vProd: Number(p.vUnCom) * qty };
      });
    }

    const effectiveSerie = options.overrideSerie || invoice.serie;

    const natOp = xmlData?.natOp || '';
    const verProc = xmlData?.verProc || '';
    const xmlEmit = xmlData?.emit || {};
    const enderEmit = xmlEmit?.enderEmit || {};
    const xmlDest = xmlData?.dest || {};
    const enderDest = xmlDest?.enderDest || {};

    // ── Data preparation ──
    const emitNome = firstText(xmlEmit.xNome, settings?.razaoSocial).toUpperCase();
    const emitLogradouro = firstText(enderEmit.xLgr, settings?.logradouro);
    const emitNumero = firstText(enderEmit.nro, settings?.numero);
    const emitBairro = firstText(enderEmit.xBairro, settings?.bairro);
    const emitEnd = `${emitLogradouro}${emitNumero ? ', ' + emitNumero : ''}${emitBairro ? ' - ' + emitBairro : ''}`;
    const emitCidade = firstText(enderEmit.xMun, settings?.cidade);
    const emitUF = firstText(enderEmit.UF, settings?.uf);
    const emitCidadeUf = `${emitCidade}${emitUF ? ' - ' + emitUF : ''}`;
    const emitCep = firstText(enderEmit.CEP, settings?.cep) ? maskCep(firstText(enderEmit.CEP, settings?.cep)) : '';
    const emitFone = firstText(enderEmit.fone, settings?.telefone) ? maskPhone(firstText(enderEmit.fone, settings?.telefone)) : '';
    const emitIE = firstText(xmlEmit.ie, settings?.ie);
    const emitCNPJ = firstText(xmlEmit.cnpj, settings?.cnpj) ? maskCnpj(firstText(xmlEmit.cnpj, settings?.cnpj)) : '';

    const destNome = firstText(xmlDest.xNome, customer?.razaoSocial).toUpperCase();
    const destDoc = maskCnpj(firstText(xmlDest.cnpj, xmlDest.cpf, customer?.cnpj, customer?.cpf));
    const destLogradouro = firstText(enderDest.xLgr, customer?.logradouro);
    const destNumero = firstText(enderDest.nro, customer?.numero);
    const destEnd = `${destLogradouro}${destNumero ? ', ' + destNumero : ''}`;
    const destBairro = firstText(enderDest.xBairro, customer?.bairro);
    const destCep = firstText(enderDest.CEP, customer?.cep) ? maskCep(firstText(enderDest.CEP, customer?.cep)) : '';
    const destCidade = firstText(enderDest.xMun, customer?.cidade);
    const destFone = firstText(enderDest.fone, customer?.telefone) ? maskPhone(firstText(enderDest.fone, customer?.telefone)) : '';
    const destUF = firstText(enderDest.UF, customer?.uf);
    const destIE = firstText(xmlDest.ie, customer?.ie, 'ISENTO');

    const overrideDateTime = fmtOverrideDateTime(options.overrideDateTime);
    const emissao = overrideDateTime?.date || fmtXmlDate(xmlData?.dhEmi) || (invoice.dataEmissao ? fmtDate(invoice.dataEmissao) : '');
    const saidaDateTime = xmlData?.dhSaiEnt || xmlData?.dhEmi;
    const saidaDate = overrideDateTime?.date || fmtXmlDate(saidaDateTime) || (invoice.dataEntrada ? fmtDate(invoice.dataEntrada) : '');
    const saidaTime = overrideDateTime?.time || fmtXmlTime(saidaDateTime) || (invoice.dataEntrada ? fmtTime(invoice.dataEntrada) : '');

    const chave = invoice.chaveAcesso || '';
    let chaveXML = firstText(xmlData?.chave, chave);
    if (options.overrideSerie && chaveXML.length === 44) {
      const serie2 = options.overrideSerie.padStart(2, '0').slice(0, 2);
      chaveXML = chaveXML.slice(0, 22) + serie2 + chaveXML.slice(24);
    }
    const chaveFmt = formatChave(chaveXML);
    const protocol = protocolo || xmlData?.protocolo || '';
    const hasISSQN = Boolean(xmlData?.hasISSQN);

    const sortedRec = (receivables || []).sort((a: any, b: any) => a.parcela - b.parcela);

    // ── Draw ──

    // ═══════════════ RECEBEMOS DE ═══════════════
    // Left area: RECEBEMOS DE + emitente + produtos text (spans y=14 to y=46)
    box(doc, ML, 14, 478, 32);
    text(doc, `RECEBEMOS DE ${emitNome}`, ML + 2, 16, 5, { color: LBL });
    text(doc, 'OS PRODUTOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO.', ML + 2, 21, 5, { color: LBL });

    // Sub-box: Data de Recebimento
    box(doc, ML, 26, 115, 20);
    text(doc, 'DATA DE RECEBIMENTO', ML + 2, 27, 5, { color: LBL });
    text(doc, '__/__/____', ML + 2, 34, 7);

    // Sub-box: IDENTIFICAÇÃO
    box(doc, ML + 115, 26, 363, 20);
    text(doc, 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', ML + 115 + 2, 27, 5, { color: LBL });

    // NF-e box (right) — spans full height y=14..46
    box(doc, ML + 478, 14, 87, 32);
    text(doc, 'NF-e', ML + 478 + 2, 15, 5, { color: LBL });
    text(doc, `Nº ${invoice.numero}`, ML + 478, 24, 9, { align: 'center', w: 87 });
    text(doc, `SÉRIE: ${effectiveSerie}`, ML + 478 + 2, 36, 6);

    // Separator line
    doc.save();
    doc.dash(1.6, { space: 1.8 })
      .moveTo(ML, 47)
      .lineTo(ML + PW, 47)
      .lineWidth(0.7)
      .stroke();
    doc.undash();
    doc.restore();

    // ═══════════════ DANFE HEADER (3 columns) ═══════════════
    // Box around entire header
    box(doc, ML, 49, PW, 96);

    // LEFT: Emitente
    const emitX = ML;
    const emitW = 271;
    const emitNameLines = splitName(emitNome);
    const emitNameY = emitNameLines.length > 1 ? 57 : 62;
    emitNameLines.forEach((line, index) => {
      text(doc, line, emitX, emitNameY + index * 11, 10.2, { align: 'center', w: emitW, font: 'Helvetica-Bold' });
    });
    text(doc, emitEnd, emitX, 84, 7.8, { align: 'center', w: emitW });
    text(doc, emitCidadeUf, emitX, 96, 7.8, { align: 'center', w: emitW });
    text(doc, `CEP: ${emitCep}        FONE: ${emitFone}`, emitX, 108, 7.8, { align: 'center', w: emitW });

    // MIDDLE: DANFE subtitle
    const midX = ML + 271;
    const midW = 74;
    const rightX = ML + 345;
    const rightW = 220;

    text(doc, 'DANFE', midX, 52, 11, { align: 'center', w: midW, font: 'Helvetica-Bold' });
    text(doc, 'DOCUMENTO AUXILIAR', midX, 66, 4.5, { color: LBL, align: 'center', w: midW });
    text(doc, 'DE NOTA FISCAL', midX, 72, 4.5, { color: LBL, align: 'center', w: midW });
    text(doc, 'ELETRONICA', midX, 78, 4.5, { color: LBL, align: 'center', w: midW });
    // vertical divider lines
    doc.moveTo(midX, 49).lineTo(midX, 145).lineWidth(0.25).stroke();
    doc.moveTo(rightX, 49).lineTo(rightX, 145).lineWidth(0.25).stroke();

    // 0 - ENTRADA  / 1 - SAÍDA
    const tpNF = firstText(xmlData?.tpNF, '1');
    text(doc, '0 - ENTRADA', midX + 4, 92, 5);
    text(doc, '1 - SAIDA', midX + 4, 100, 5);
    box(doc, midX + 55, 93, 12, 12, 0.25, 1);
    text(doc, tpNF, midX + 55, 96, 7, { align: 'center', w: 12 });

    // Nº + SÉRIE + FOLHA
    text(doc, `Nº ${invoice.numero}`, midX + 2, 120, 7);
    text(doc, `SÉRIE: ${effectiveSerie}`, midX + 2, 128, 6);
    text(doc, 'FOLHA 1 / 1', midX + 2, 136, 6);

    // RIGHT: Chave de acesso
    text(doc, 'CONTROLE DO FISCO', rightX + 2, 52, 5, { color: LBL });

    // Barcode
    if (chaveXML) {
      try {
        const barcodePng = await bwipjs.toBuffer({
          bcid: 'code128',
          text: chaveXML.replace(/\s/g, ''),
          scale: 3,
          height: 8,
          includetext: false,
        });
        doc.image(barcodePng, rightX + 8, 59, { width: 201, height: 22 });
      } catch (e) {
        this.logger.warn(`Barcode generation failed: ${(e as Error).message}`);
      }
    }

    // Chave text
    doc.moveTo(rightX, 84).lineTo(rightX + rightW, 84).lineWidth(0.25).stroke();
    doc.moveTo(rightX, 108).lineTo(rightX + rightW, 108).lineWidth(0.25).stroke();
    text(doc, 'CHAVE DE ACESSO', rightX + 2, 86, 5, { color: LBL });
    text(doc, chaveFmt, rightX + 2, 96, 6);
    text(doc, 'Consulta de autenticidade no portal nacional da NF-e', rightX + 2, 113, 5, { color: LBL });
    text(doc, 'www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora.', rightX + 2, 120, 5, { color: LBL });

    // ═══════════════ NATUREZA + PROTOCOLO ═══════════════
    cell(doc, 'NATUREZA DA OPERAÇÃO', natOp, ML, 145, 345, 24);
    cell(doc, 'PROTOCOLO DE AUTORIZAÇÃO DE USO', protocol, ML + 345, 145, 222, 24);

    // ═══════════════ IE / IE SUBST / CNPJ ═══════════════
    const ieRowY = 169;
    cell(doc, 'INSCRIÇÃO ESTADUAL', emitIE, ML, ieRowY, 188, 24);
    cell(doc, 'INSCRIÇÃO ESTADUAL DE SUBST.', '-', ML + 188, ieRowY, 207, 24);
    cell(doc, 'CNPJ', emitCNPJ, ML + 395, ieRowY, 172, 24);

    // ═══════════════ DESTINATÁRIO ═══════════════
    const destY = 193;
    text(doc, 'DESTINATÁRIO / REMETENTE', ML + 2, destY + 1, 6);

    const dRow1 = 204;
    const dRow2 = 228;
    const dRow3 = 252;
    const dRH = 24;
    const dateW = 67;
    const dateX = ML + PW - dateW;

    cellTop(doc, 'NOME / RAZÃO SOCIAL', destNome, ML, dRow1, 345, dRH);
    cellTop(doc, 'CNPJ / CPF', destDoc, ML + 345, dRow1, dateX - (ML + 345), dRH);
    dateTimeCell(doc, 'DATA EMISSÃO', emissao, dateX, dRow1, dateW, dRH);

    cellTop(doc, 'ENDEREÇO', destEnd, ML, dRow2, 276, dRH);
    cellTop(doc, 'BAIRRO / DISTRITO', destBairro, ML + 276, dRow2, 148, dRH);
    cellTop(doc, 'CEP', destCep, ML + 424, dRow2, dateX - (ML + 424), dRH);
    dateTimeCell(doc, 'DATA ENTRADA / SAÍDA', saidaDate, dateX, dRow2, dateW, dRH);

    cellTop(doc, 'MUNICÍPIO', destCidade, ML, dRow3, 211, dRH);
    cellTop(doc, 'FONE / FAX', destFone, ML + 211, dRow3, 120, dRH);
    cellTop(doc, 'UF', destUF, ML + 331, dRow3, 28, dRH);
    cellTop(doc, 'INSCRIÇÃO ESTADUAL', destIE, ML + 359, dRow3, dateX - (ML + 359), dRH);
    dateTimeCell(doc, 'HORA ENTRADA / SAÍDA', saidaTime, dateX, dRow3, dateW, dRH);

    // ═══════════════ FATURA / DUPLICATA ═══════════════
    const fatY = 278;
    text(doc, 'FATURA / DUPLICATA', ML + 2, fatY + 1, 6);
    const dupColW = 56;
    let dupX = ML;
    for (const rec of sortedRec) {
      const parcelNo = String(rec.parcela).padStart(3, '0');
      const venc = rec.dataVencimento ? fmtDate(rec.dataVencimento) : '';
      const val = fmtBRL(rec.valorReceber);
      // Each duplicata: Nº at top, vencimento, valor — vertically stacked
      text(doc, parcelNo, dupX + 1, fatY + 8, 5);
      text(doc, venc, dupX + 1, fatY + 14, 5);
      text(doc, val, dupX + 1, fatY + 20, 5);
      dupX += dupColW;
    }

    // ═══════════════ CALCULO DO IMPOSTO ═══════════════
    const impY = 311;
    text(doc, 'CALCULO DO IMPOSTO', ML + 2, impY + 1, 6);

    const impR1 = 321;
    const impR2 = 345;
    const impRH = 24;
    const impW = 113;

    cell(doc, 'BASE DE CALCULO DO ICMS', fmtBRL(invoice.baseCalculoIcms), ML, impR1, impW, impRH, 'bottom');
    cell(doc, 'VALOR DO ICMS', fmtBRL(invoice.valorIcms), ML + impW, impR1, impW, impRH, 'bottom');
    cell(doc, 'BASE DE CALCULO DO ICMS SUBST.', fmtBRL(invoice.baseCalculoIcmsSt), ML + impW * 2, impR1, impW, impRH, 'bottom');
    cell(doc, 'VALOR DO ICMS SUBST.', fmtBRL(invoice.valorIcmsSt), ML + impW * 3, impR1, impW, impRH, 'bottom');
    cell(doc, 'VALOR TOTAL DOS PRODUTOS', fmtBRL(invoice.valorProdutos), ML + impW * 4, impR1, impW, impRH, 'bottom');

    const imp2W = 94;
    cell(doc, 'VALOR DO FRETE', fmtBRL(invoice.valorFrete), ML, impR2, imp2W, impRH, 'bottom');
    cell(doc, 'VALOR DO SEGURO', fmtBRL(0), ML + imp2W, impR2, imp2W, impRH, 'bottom');
    cell(doc, 'DESCONTO', fmtBRL(invoice.valorDesconto), ML + imp2W * 2, impR2, imp2W, impRH, 'bottom');
    cell(doc, 'OUTRAS DESPESAS ACESSÓRIAS', fmtBRL(0), ML + imp2W * 3, impR2, imp2W, impRH, 'bottom');
    cell(doc, 'VALOR TOTAL DO IPI', fmtBRL(0), ML + imp2W * 4, impR2, imp2W, impRH, 'bottom');
    cell(doc, 'VALOR TOTAL DA NOTA', fmtBRL(invoice.valorTotal), ML + imp2W * 5, impR2, 95, impRH, 'bottom');

    // ═══════════════ TRANSPORTADOR ═══════════════
    const trY = 369;
    text(doc, 'TRANSPORTADOR / VOLUMES TRANSPORTADOS', ML + 2, trY + 1, 6);

    const trR1 = 379;
    const trR2 = 404;
    const trR3 = 429;
    const trRH = 24;

    cell(doc, 'NOME / RAZÃO SOCIAL', '-', ML, trR1, 226, trRH);
    cell(doc, 'FRETE POR CONTA', '9-SEM FRETE', ML + 226, trR1, 68, trRH);
    cell(doc, 'CÓDIGO ANTT', '-', ML + 294, trR1, 68, trRH);
    cell(doc, 'PLACA DO VEICULO', '-', ML + 362, trR1, 68, trRH);
    cell(doc, 'UF', '-', ML + 430, trR1, 28, trRH);
    cell(doc, 'CNPJ / CPF', '-', ML + 458, trR1, 109, trRH);

    cell(doc, 'ENDEREÇO', '-', ML, trR2, 226, trRH);
    cell(doc, 'MUNICÍPIO', '-', ML + 226, trR2, 218, trRH);
    cell(doc, 'UF', '-', ML + 444, trR2, 28, trRH);
    cell(doc, 'INSCRIÇÃO ESTADUAL', '-', ML + 472, trR2, 95, trRH);

    cell(doc, 'QUANTIDADE', '0', ML, trR3, 75, trRH);
    cell(doc, 'ESPÉCIE', '-', ML + 75, trR3, 75, trRH);
    cell(doc, 'MARCA', '-', ML + 150, trR3, 76, trRH);
    cell(doc, 'NUMERAÇÃO', '-', ML + 226, trR3, 155, trRH);
    cell(doc, 'PESO BRUTO', '0,0000', ML + 381, trR3, 104, trRH);
    cell(doc, 'PESO LIQUIDO', '0,0000', ML + 485, trR3, 82, trRH);

    // ═══════════════ PRODUTOS ═══════════════
    const prodY = 453;
    text(doc, 'DADOS DOS PRODUTOS / SERVIÇOS', ML + 2, prodY + 1, 6);

    const hdrY = 463;
    const hdrH = 13;
    const rowH = 12;
    const productBottomY = 685;
    const productCols = [
      { key: 'codigo', label: 'CÓDIGO', w: 57 },
      { key: 'descricao', label: 'DESCRIÇÃO DOS PRODUTOS / SERVIÇOS', w: 169 },
      { key: 'ncm', label: 'NCM/SH', w: 35 },
      { key: 'cst', label: 'CST', w: 16 },
      { key: 'cfop', label: 'CFOP', w: 22 },
      { key: 'uCom', label: 'UNID', w: 20 },
      { key: 'qCom', label: 'QUANT.', w: 29 },
      { key: 'vUnCom', label: 'VALOR UNITÁRIO', w: 40 },
      { key: 'vProd', label: 'VALOR TOTAL', w: 44 },
      { key: 'vBC', label: 'BASE', w: 35 },
      { key: 'vICMS', label: 'ICMS', w: 27 },
      { key: 'vIPI', label: 'IPI', w: 27 },
      { key: 'pICMS', label: 'ICMS %', w: 22 },
      { key: 'pIPI', label: 'IPI %', w: 22 },
    ];
    const colXs = [ML];
    for (const col of productCols) {
      colXs.push(colXs[colXs.length - 1] + col.w);
    }
    const tableW = colXs[colXs.length - 1] - ML;
    const headerSplitY = hdrY + 7;
    const headerBottomY = hdrY + hdrH;

    doc.rect(ML, hdrY, tableW, productBottomY - hdrY).lineWidth(0.25).stroke();
    for (let i = 1; i < colXs.length - 1; i++) {
      const x = colXs[i];
      const topY = (i === 11 || i === 13) ? headerSplitY : hdrY;
      doc.moveTo(x, topY).lineTo(x, productBottomY).lineWidth(0.25).stroke();
    }
    doc.moveTo(ML, headerBottomY).lineTo(ML + tableW, headerBottomY).lineWidth(0.25).stroke();
    doc.moveTo(colXs[9], headerSplitY).lineTo(ML + tableW, headerSplitY).lineWidth(0.25).stroke();

    function headerText(label: string, index: number, y = hdrY + 4, size = 4) {
      text(doc, label, colXs[index], y, size, { align: 'center', w: productCols[index].w });
    }

    for (let i = 0; i <= 8; i++) {
      headerText(productCols[i].label, i);
    }
    headerText('BASE', 9, hdrY + 1, 4);
    headerText('CALCULO', 9, hdrY + 7, 4);
    text(doc, 'VALOR', colXs[10], hdrY + 1, 4, { align: 'center', w: productCols[10].w + productCols[11].w });
    headerText('ICMS', 10, hdrY + 7, 4);
    headerText('IPI', 11, hdrY + 7, 4);
    text(doc, 'ALIQUOTA', colXs[12], hdrY + 1, 4, { align: 'center', w: productCols[12].w + productCols[13].w });
    headerText('ICMS %', 12, hdrY + 7, 4);
    headerText('IPI %', 13, hdrY + 7, 4);

    function productText(value: string, index: number, y: number, align: 'left' | 'right' = 'left') {
      const x = colXs[index];
      const w = productCols[index].w;
      if (align === 'right') {
        text(doc, value, x + w - 1, y + 2, 5, { align: 'right' });
      } else {
        text(doc, value, x + 1, y + 2, 5);
      }
    }

    let ry = headerBottomY;
    for (const p of effectiveProducts) {
      if (ry + rowH > productBottomY) break;
      const cstVal = asText(p.cst).padStart(4, '0');
      doc.moveTo(ML, ry + rowH).lineTo(ML + tableW, ry + rowH).lineWidth(0.25).stroke();
      productText(asText(p.codigo), 0, ry);
      productText(asText(p.descricao), 1, ry);
      productText(asText(p.ncm), 2, ry);
      productText(cstVal, 3, ry);
      productText(asText(p.cfop), 4, ry);
      productText(asText(p.uCom || 'UN'), 5, ry);
      productText(fmtQty(p.qCom), 6, ry, 'right');
      productText(fmtUnit(p.vUnCom), 7, ry, 'right');
      productText(currencyBR(p.vProd), 8, ry, 'right');
      productText(p.vBC !== undefined ? currencyBR(p.vBC) : '0,00', 9, ry, 'right');
      productText(p.vICMS !== undefined ? currencyBR(p.vICMS) : '0,00', 10, ry, 'right');
      productText(p.vIPI !== undefined ? currencyBR(p.vIPI) : '0,00', 11, ry, 'right');
      productText(p.pICMS !== undefined ? currencyBR(p.pICMS) : '0,00', 12, ry, 'right');
      productText(p.pIPI !== undefined ? currencyBR(p.pIPI) : '0,00', 13, ry, 'right');
      ry += rowH;
    }

    // ═══════════════ VERSÃO ═══════════════
    const verY = 686;
    text(doc, `VERSÃO DO SISTEMA EMISSOR DA NFE: ${verProc}`, ML + 1, verY, 5);

    // ═══════════════ ISSQN ═══════════════
    const issY = 693;
    text(doc, 'CALCULO DO ISSQN', ML + 2, issY + 1, 6);

    const issR1 = issY + 10;
    const issRH = 24;
    const issW = 141;
    const issqn = xmlData?.ISSQNtot || {};
    cell(doc, 'INSCRIÇÃO MUNICIPAL', hasISSQN ? firstText(xmlEmit.im) : '', ML, issR1, issW, issRH);
    cell(doc, 'VALOR TOTAL DOS SERVIÇOS', hasISSQN ? fmtBRL(issqn.vServ) : '', ML + issW, issR1, issW, issRH);
    cell(doc, 'BASE DE CALCULO DO ISSQN', hasISSQN ? fmtBRL(issqn.vBC) : '', ML + issW * 2, issR1, issW, issRH);
    cell(doc, 'VALOR DO ISSQN', hasISSQN ? fmtBRL(issqn.vISS) : '', ML + issW * 3, issR1, 144, issRH);

    // ═══════════════ DADOS ADICIONAIS ═══════════════
    const daY = 727;
    const daH = 88;
    text(doc, 'DADOS ADICIONAIS', ML + 2, daY + 1, 6);

    // Left box: INFORMAÇÕES COMPLEMENTARES
    doc.rect(ML, daY + 10, 364, daH - 10).lineWidth(0.25).stroke();
    text(doc, 'INFORMAÇÕES COMPLEMENTARES', ML + 2, daY + 11, 5, { color: LBL });

    const infCpl = xmlData?.infCpl || '';
    let daTextY = daY + 20;
    text(doc, infCpl, ML + 2, daTextY, 5);
    daTextY += 10;
    text(doc, 'VOLTE SEMPRE', ML + 2, daTextY, 7);

    // Right box: RESERVADO AO FISCO
    doc.rect(ML + 364, daY + 10, 203, daH - 10).lineWidth(0.25).stroke();
    text(doc, 'RESERVADO AO FISCO', ML + 366, daY + 11, 5, { color: LBL });

    // ═══════════════ FOOTER ═══════════════
    const footerY = daY + daH + 3;
    text(doc, 'DANFE GERADO POR OMMEGA DATA TECNOLOGIA EM SOFTWARE',
      ML, footerY, 6, { color: LBL, align: 'center', w: PW });

    // ── Finalize ──
    doc.end();
    const buffer = await endPromise;

    const outputDir = options.outputDir || UPLOADS_DIR;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = `${randomUUID()}.pdf`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const pdfDocRecord = this.pdfDocRepo.create({
      originalName: `DANFE-${invoice.numero}-${invoice.serie}${options.originalNameSuffix || ''}.pdf`,
      fileName,
      filePath,
      fileSize: buffer.length,
      invoiceId: invoice.id,
      observacao: `DANFE gerado automaticamente da NF-e ${invoice.numero}/${invoice.serie}`,
    });
    const saved = options.persistDocument === false
      ? pdfDocRecord
      : await this.pdfDocRepo.save(pdfDocRecord);

    return { pdfDoc: saved, filePath };
  }

  parseProducts(xmlCompleto?: string): { products: any[]; protocolo?: string } {
    if (!xmlCompleto) return { products: [] };
    try {
      const parsed = this.xmlParser.parse(xmlCompleto);
      const nfeProc = parsed.nfeProc || parsed.NFe || parsed.nfeProc;
      const nfeNode = nfeProc?.NFe || nfeProc;
      const infNFe = nfeNode?.infNFe || nfeNode?.InfNFe || nfeNode;
      if (!infNFe) return { products: [] };

      let protocolo: string | undefined;
      const protNFe = nfeProc?.protNFe || nfeProc?.ProtNFe;
      const infProt = protNFe?.infProt || protNFe?.InfProt || {};
      if (infProt?.nProt) {
        protocolo = infProt.nProt.toString();
      }

      const dets = infNFe.det || infNFe.dets || infNFe.Det || [];
      const items = Array.isArray(dets) ? dets : [dets];
      const products = items.map((det: any) => {
        const prod = det.prod || det.Prod || {};
        const imposto = det.imposto || det.Imposto || {};
        const icms = imposto.ICMS || imposto.Icms || {};
        const icmsNode = Object.values(icms)[0] as any || {};
        const ipi = imposto.IPI || imposto.Ipi || {};
        const ipiNode = Object.values(ipi).find((node: any) => node && typeof node === 'object') as any || {};
        return {
          codigo: (prod.cProd || '').toString(),
          descricao: (prod.xProd || '').toString(),
          ncm: (prod.NCM || prod.ncm || '').toString(),
          cst: (icmsNode?.CST || icmsNode?.CSOSN || prod.CST || '').toString(),
          cfop: (prod.CFOP || '').toString(),
          uCom: (prod.uCom || 'UN').toString(),
          qCom: parseFloat(prod.qCom || '0'),
          vUnCom: parseFloat(prod.vUnCom || '0'),
          vProd: parseFloat(prod.vProd || '0'),
          vBC: icmsNode?.vBC !== undefined ? parseFloat(icmsNode.vBC) : undefined,
          vICMS: icmsNode?.vICMS !== undefined ? parseFloat(icmsNode.vICMS) : undefined,
          pICMS: icmsNode?.pICMS !== undefined ? parseFloat(icmsNode.pICMS) : undefined,
          vIPI: ipiNode?.vIPI !== undefined ? parseFloat(ipiNode.vIPI) : undefined,
          pIPI: ipiNode?.pIPI !== undefined ? parseFloat(ipiNode.pIPI) : undefined,
        };
      });
      return { products, protocolo };
    } catch (err) {
      this.logger.warn(`Could not parse products from XML: ${(err as Error).message}`);
      return { products: [] };
    }
  }

  parseFullXml(xmlCompleto?: string): any {
    if (!xmlCompleto) return {};
    try {
      const parsed = this.xmlParser.parse(xmlCompleto);
      const nfeProc = parsed.nfeProc || parsed.NFe || {};
      const nfeNode = nfeProc?.NFe || nfeProc;
      const infNFe = nfeNode?.infNFe || nfeNode?.InfNFe || nfeNode || {};
      const ide = infNFe?.ide || infNFe?.Ide || {};
      const protNFe = nfeProc?.protNFe || nfeProc?.ProtNFe || {};
      const infProt = protNFe?.infProt || protNFe?.InfProt || {};
      const emit = infNFe?.emit || infNFe?.Emit || {};
      const dest = infNFe?.dest || infNFe?.Dest || {};
      const total = infNFe?.total || infNFe?.Total || {};
      const transp = infNFe?.transp || infNFe?.Transp || {};
      const infAdic = infNFe?.infAdic || infNFe?.InfAdic || infNFe?.infAdic || {};
      const dets = infNFe?.det || infNFe?.Det || [];
      const detItems = Array.isArray(dets) ? dets : (dets ? [dets] : []);

      const icmsTot = total?.ICMSTot || total?.icmsTot || {};
      const issqnTot = total?.ISSQNtot || total?.ISSQNTot || total?.issqnTot || {};
      const infNFeId = asText(infNFe?.['@_Id']);
      const chaveFromId = infNFeId.startsWith('NFe') ? infNFeId.replace('NFe', '') : '';
      const hasISSQN = Object.keys(issqnTot || {}).length > 0 || detItems.some((det: any) => {
        const imposto = det?.imposto || det?.Imposto || {};
        return Boolean(imposto?.ISSQN || imposto?.Issqn);
      });

      return {
        natOp: ide?.natOp || '',
        verProc: ide?.verProc || '',
        dhEmi: ide?.dhEmi || '',
        dhSaiEnt: ide?.dhSaiEnt || '',
        tpNF: ide?.tpNF,
        chave: infProt?.chNFe || infProt?.chaveNFe || chaveFromId,
        protocolo: infProt?.nProt || '',
        infCpl: infAdic?.infCpl || '',
        emit: {
          cnpj: emit?.CNPJ || '',
          xNome: emit?.xNome || '',
          xFant: emit?.xFant || '',
          ie: emit?.IE || '',
          im: emit?.IM || emit?.im || '',
          enderEmit: emit?.enderEmit || emit?.EnderEmit || {},
        },
        dest: {
          cnpj: dest?.CNPJ || '',
          cpf: dest?.CPF || '',
          xNome: dest?.xNome || '',
          ie: dest?.IE || '',
          enderDest: dest?.enderDest || dest?.EnderDest || {},
        },
        ICMSTot: {
          vBC: icmsTot?.vBC || '0',
          vICMS: icmsTot?.vICMS || '0',
          vBCST: icmsTot?.vBCST || '0',
          vICMSST: icmsTot?.vICMSST || '0',
          vProd: icmsTot?.vProd || '0',
          vFrete: icmsTot?.vFrete || '0',
          vSeg: icmsTot?.vSeg || '0',
          vDesc: icmsTot?.vDesc || '0',
          vOutro: icmsTot?.vOutro || '0',
          vIPI: icmsTot?.vIPI || '0',
          vNF: icmsTot?.vNF || '0',
        },
        ISSQNtot: {
          vServ: issqnTot?.vServ || '',
          vBC: issqnTot?.vBC || '',
          vISS: issqnTot?.vISS || issqnTot?.vISSQN || '',
        },
        hasISSQN,
        transp: {
          modFrete: transp?.modFrete || '',
          transporta: transp?.transporta || transp?.Transporta || {},
          vol: transp?.vol || transp?.Vol || {},
        },
        dets: detItems,
      };
    } catch {
      return {};
    }
  }
}
