import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PdfDocument } from './entities/pdf-document.entity';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'pdf-storage');

@Injectable()
export class PdfStorageService {
  private readonly logger = new Logger(PdfStorageService.name);

  constructor(
    @InjectRepository(PdfDocument)
    private readonly repo: Repository<PdfDocument>,
  ) {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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

  async findAll(): Promise<(PdfDocument & { fileExists: boolean })[]> {
    const docs = await this.repo.find({ order: { createdAt: 'DESC' } });
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
}
