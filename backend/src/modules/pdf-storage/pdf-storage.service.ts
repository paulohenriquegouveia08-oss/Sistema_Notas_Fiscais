import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PdfDocument } from './entities/pdf-document.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { CompanySettings } from '../settings/entities/company-settings.entity';
import { PdfGeneratorService } from './pdf-generator.service';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'pdf-storage');
const DATE_EDITS_DIR = path.join(process.cwd(), 'uploads', 'pdf-date-edits');

export interface DateEditRequest {
  invoiceId: string;
  date: string;
  time?: string;
  productDescription?: string;
  productCode?: string;
  serie?: string;
  numero?: string;
  unitValue?: number;
  quantity?: number;
}

export interface DateEditResult {
  fileName: string;
  originalName: string;
  fileSize: number;
  fileUrl: string;
  invoice: {
    id: string;
    numero: string;
    serie: string;
    chaveAcesso: string;
  };
}

@Injectable()
export class PdfStorageService {
  private readonly logger = new Logger(PdfStorageService.name);

  constructor(
    @InjectRepository(PdfDocument)
    private readonly repo: Repository<PdfDocument>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(CompanySettings)
    private readonly settingsRepo: Repository<CompanySettings>,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATE_EDITS_DIR)) {
      fs.mkdirSync(DATE_EDITS_DIR, { recursive: true });
    }
  }

  async uploadMany(files: Express.Multer.File[]): Promise<PdfDocument[]> {
    const docs: PdfDocument[] = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.pdf') continue;

      const fileName = `${randomUUID()}${ext}`;
      const filePath = path.join(UPLOADS_DIR, fileName);

      if (file.buffer) {
        await fs.promises.writeFile(filePath, file.buffer);
      } else if (file.path) {
        await fs.promises.copyFile(file.path, filePath);
      } else {
        continue;
      }

      const doc = this.repo.create({
        originalName: file.originalname,
        fileName,
        filePath,
        fileSize: file.size,
      });

      docs.push(await this.repo.save(doc));
    }

    return docs;
  }

  async findAll(search?: string): Promise<(PdfDocument & { fileExists: boolean })[]> {
    const where = search ? { originalName: ILike(`%${search}%`) } : {};
    const docs = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    return docs.map((doc) => ({
      ...doc,
      fileExists: fs.existsSync(doc.filePath),
    }));
  }

  async findOne(id: string): Promise<PdfDocument> {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    return doc;
  }

  async getFilePath(id: string): Promise<string | null> {
    const doc = await this.findOne(id);
    if (!fs.existsSync(doc.filePath)) {
      this.logger.warn(`Arquivo físico não encontrado para documento ${id}: ${doc.filePath}`);
      return null;
    }
    return doc.filePath;
  }

  async remove(id: string): Promise<void> {
    const doc = await this.findOne(id);
    try {
      if (fs.existsSync(doc.filePath)) {
        await fs.promises.unlink(doc.filePath);
      }
    } catch (err) {
      this.logger.warn(`Erro ao deletar arquivo físico: ${err}`);
    }
    await this.repo.remove(doc);
  }

  async generateWithEditedDate(input: DateEditRequest): Promise<DateEditResult> {
    const invoiceId = (input.invoiceId || '').trim();
    if (!invoiceId) {
      throw new BadRequestException('Selecione uma nota fiscal');
    }

    const date = this.normalizeDate(input.date);
    const time = input.time ? this.normalizeTime(input.time) : '';
    const overrideDateTime = time ? `${date}T${time}` : date;

    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
      relations: ['customer', 'receivables'],
    });

    if (!invoice) {
      throw new NotFoundException('Nota fiscal não encontrada');
    }

    if (!invoice.xmlCompleto) {
      throw new BadRequestException('A nota selecionada não possui XML para regenerar a DANFE');
    }

    const [settings] = await this.settingsRepo.find({ take: 1 });
    const result = await this.pdfGenerator.generateForInvoice(
      invoice,
      invoice.customer,
      settings || null,
      invoice.receivables || [],
      {
        overrideDateTime,
        overrideProductDescription: input.productDescription,
        overrideProductCode: input.productCode,
        overrideSerie: input.serie,
        overrideNumero: input.numero,
        overrideUnitValue: input.unitValue,
        overrideQuantity: input.quantity,
        outputDir: DATE_EDITS_DIR,
        persistDocument: false,
      },
    );

    if (!result?.filePath || !fs.existsSync(result.filePath)) {
      throw new BadRequestException('Não foi possível gerar o PDF');
    }

    const stat = await fs.promises.stat(result.filePath);
    const fileName = path.basename(result.filePath);

    return {
      fileName,
      originalName: `DANFE-${invoice.numero}-${invoice.serie}.pdf`,
      fileSize: stat.size,
      fileUrl: `/pdf-storage/date-editor/${fileName}`,
      invoice: {
        id: invoice.id,
        numero: invoice.numero,
        serie: invoice.serie,
        chaveAcesso: invoice.chaveAcesso,
      },
    };
  }

  getEditedDateFilePath(fileName: string): string | null {
    const safeName = path.basename(fileName || '');
    if (!safeName || safeName !== fileName || path.extname(safeName).toLowerCase() !== '.pdf') {
      throw new BadRequestException('Nome de arquivo inválido');
    }

    const filePath = path.join(DATE_EDITS_DIR, safeName);
    const resolvedBase = path.resolve(DATE_EDITS_DIR);
    const resolvedFile = path.resolve(filePath);
    if (!resolvedFile.startsWith(resolvedBase + path.sep)) {
      throw new BadRequestException('Nome de arquivo inválido');
    }

    return fs.existsSync(resolvedFile) ? resolvedFile : null;
  }

  async getProductsFromInvoice(invoiceId: string) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
      relations: ['receivables'],
    });
    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada');
    if (!invoice.xmlCompleto) throw new BadRequestException('A nota não possui XML');

    const { products } = this.pdfGenerator.parseProducts(invoice.xmlCompleto);

    const xmlData = this.pdfGenerator.parseFullXml(invoice.xmlCompleto);
    const serie = xmlData?.ide?.serie || invoice.serie || '';
    const numero = xmlData?.ide?.nNF || invoice.numero || '';

    const receivables = (invoice.receivables || [])
      .sort((a: any, b: any) => a.parcela - b.parcela)
      .map((r: any) => ({
        parcela: r.parcela,
        valorReceber: r.valorReceber,
        dataVencimento: r.dataVencimento,
        status: r.status,
      }));

    return {
      products,
      serie,
      numero,
      tipoPagamento: invoice.tipoPagamento || '',
      qtdeParcelas: invoice.qtdeParcelas || 0,
      valorTotal: invoice.valorTotal,
      receivables,
    };
  }

  private normalizeDate(value: string): string {
    const date = (value || '').trim();
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new BadRequestException('Informe a data no formato AAAA-MM-DD');
    }

    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Data inválida');
    }

    return date;
  }

  private normalizeTime(value: string): string {
    const time = (value || '').trim();
    const match = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) {
      throw new BadRequestException('Informe o horário no formato HH:mm ou HH:mm:ss');
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = Number(match[3] || '0');

    if (hour > 23 || minute > 59 || second > 59) {
      throw new BadRequestException('Horário inválido');
    }

    return `${match[1]}:${match[2]}:${match[3] || '00'}`;
  }
}
