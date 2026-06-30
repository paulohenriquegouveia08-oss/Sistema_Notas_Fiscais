import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not, IsNull } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { XmlDocument } from './entities/xml-document.entity';
import { XmlDocumentStatus } from './entities/xml-document-status.enum';
import { Invoice } from '../invoices/entities/invoice.entity';
import { NfeXmlParser } from '../xml-import/parser/nfe-xml.parser';

const XMLS_DIR = path.join(process.cwd(), 'uploads', 'xmls');

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function sanitizeFilename(str: string): string {
  return removeAccents(str)
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 80);
}

@Injectable()
export class XmlDocumentsService {
  private readonly logger = new Logger(XmlDocumentsService.name);

  constructor(
    @InjectRepository(XmlDocument)
    private readonly xmlDocRepo: Repository<XmlDocument>,
  ) {
    if (!fs.existsSync(XMLS_DIR)) {
      fs.mkdirSync(XMLS_DIR, { recursive: true });
    }
  }

  private generateFriendlyName(razaoSocial: string, numeroNota: string): string {
    const safeName = sanitizeFilename(razaoSocial || 'CLIENTE');
    const safeNum = sanitizeFilename(numeroNota || '0');
    return `${safeName}_nota_${safeNum}.xml`;
  }

  async saveFromImport(
    xmlContent: string,
    parsed: any,
    invoiceId: string | null,
    customerId: string | null,
    originalFileName: string,
  ): Promise<{ xmlDocument: XmlDocument; acao: 'criado' | 'existente' | 'vinculado' }> {
    const chaveAcesso = parsed.chaveAcesso;
    if (!chaveAcesso) {
      throw new BadRequestException('XML sem chave de acesso');
    }

    const existing = await this.xmlDocRepo.findOne({ where: { chaveAcesso } });
    if (existing) {
      return { xmlDocument: existing, acao: 'existente' };
    }

    const nomeCliente = parsed.customer?.razaoSocial || 'CLIENTE';
    const numeroNota = parsed.numero || '0';
    const serie = parsed.serie || '1';
    const dataEmissao = parsed.dataEmissao?.split('T')[0] || new Date().toISOString().split('T')[0];

    const baseName = this.generateFriendlyName(nomeCliente, numeroNota);
    let fileName = baseName;
    let filePath = path.join(XMLS_DIR, fileName);

    if (fs.existsSync(filePath)) {
      const shortChave = chaveAcesso.slice(-10);
      const ext = path.extname(baseName);
      const nameNoExt = path.basename(baseName, ext);
      fileName = `${nameNoExt}_${shortChave}${ext}`;
      filePath = path.join(XMLS_DIR, fileName);
    }

    fs.writeFileSync(filePath, xmlContent, 'utf-8');
    const stat = fs.statSync(filePath);

    const status = invoiceId ? XmlDocumentStatus.VINCULADO : XmlDocumentStatus.SEM_NOTA;

    const xmlDoc = this.xmlDocRepo.create({
      chaveAcesso,
      invoiceId: invoiceId || undefined,
      customerId: customerId || undefined,
      nomeCliente,
      numeroNota,
      serie,
      dataEmissao,
      nomeArquivoOriginal: originalFileName,
      nomeArquivoSistema: fileName,
      caminhoArquivo: filePath,
      tamanhoArquivo: stat.size,
      status,
    });

    const saved = await this.xmlDocRepo.save(xmlDoc);
    const acao = invoiceId ? 'vinculado' : 'criado';
    return { xmlDocument: saved, acao };
  }

  async findByChaveAcesso(chaveAcesso: string): Promise<XmlDocument | null> {
    return this.xmlDocRepo.findOne({ where: { chaveAcesso } });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<{ data: XmlDocument[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.xmlDocRepo
      .createQueryBuilder('xml')
      .leftJoinAndSelect('xml.invoice', 'invoice')
      .leftJoinAndSelect('xml.customer', 'customer')
      .skip(skip)
      .take(limit)
      .orderBy('xml.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('xml.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(xml.nomeCliente ILIKE :search OR xml.numeroNota ILIKE :search OR xml.chaveAcesso ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<XmlDocument> {
    const doc = await this.xmlDocRepo.findOne({
      where: { id },
      relations: ['invoice', 'customer'],
    });
    if (!doc) throw new NotFoundException(`XML document ${id} não encontrado`);
    return doc;
  }

  async getDownloadPath(id: string): Promise<{ filePath: string; fileName: string }> {
    const doc = await this.findOne(id);
    const resolved = path.resolve(doc.caminhoArquivo);
    const allowedBase = path.resolve(XMLS_DIR);
    if (!resolved.startsWith(allowedBase)) {
      throw new BadRequestException('Caminho de arquivo inválido');
    }
    if (!fs.existsSync(resolved)) {
      throw new NotFoundException('Arquivo XML não encontrado no disco');
    }
    return { filePath: resolved, fileName: doc.nomeArquivoSistema };
  }

  async backfillFromInvoices(): Promise<{ processed: number; created: number; skipped: number; errors: string[] }> {
    const invoiceRepo = this.xmlDocRepo.manager.getRepository(Invoice);

    const invoices = await invoiceRepo.find({
      where: { xmlCompleto: Not(IsNull()) },
    });

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const parser = new NfeXmlParser();

    for (const invoice of invoices) {
      try {
        const existing = await this.xmlDocRepo.findOne({
          where: { chaveAcesso: invoice.chaveAcesso },
        });
        if (existing) {
          skipped++;
          continue;
        }

        let parsed: any;
        try {
          parsed = parser.parse(invoice.xmlCompleto!);
        } catch {
          errors.push(`NF ${invoice.numero}: erro ao parsear XML`);
          continue;
        }

        const result = await this.saveFromImport(
          invoice.xmlCompleto!,
          parsed,
          invoice.id,
          invoice.customerId,
          `backfill_${invoice.chaveAcesso}.xml`,
        );
        if (result.acao !== 'existente') created++;
      } catch (err: any) {
        errors.push(`NF ${invoice.numero}: ${err.message}`);
      }
    }

    return { processed: invoices.length, created, skipped, errors };
  }
}
