import {
  Controller,
  Post,
  Get,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { XmlImportService } from '../services/xml-import.service';

@ApiTags('XML Import')
@Controller('xml')
export class XmlImportController {
  private readonly logger = new Logger(XmlImportController.name);

  constructor(private readonly xmlImportService: XmlImportService) {}

  @Post('import')
  @ApiOperation({ summary: 'Importar XMLs ou PDFs de NF-e' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 1000, {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async importXml(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    if (files.length > 1000) {
      throw new BadRequestException('Máximo de 1000 arquivos por vez');
    }

    const results = [];
    for (const file of files) {
      const name = file.originalname.toLowerCase();

      if (name.endsWith('.xml')) {
        const xmlContent = file.buffer.toString('utf-8');
        const result = await this.xmlImportService.importXml(xmlContent);
        results.push(result);
      } else if (name.endsWith('.pdf')) {
        const result = await this.xmlImportService.importPdf(file.buffer, file.originalname);
        results.push(result);
      } else {
        results.push({
          chaveAcesso: '',
          numero: '',
          serie: '',
          customer: { id: '', razaoSocial: '', isNew: false },
          invoice: { id: '', isNew: false },
          receivables: [],
          errors: [`Formato não suportado: ${file.originalname}. Use .xml ou .pdf`],
        });
      }
    }

    const total = results.length;
    const imported = results.filter((r: any) => r.invoice?.isNew).length;
    const duplicated = results.filter((r: any) => !r.invoice?.isNew && !r.errors?.length).length;
    const errors = results.filter((r: any) => r.errors?.length > 0);

    this.logger.log(
      `Importação concluída: ${imported} importadas, ${duplicated} já existentes, ${errors.length} com erros`,
    );

    return {
      total,
      imported,
      duplicated,
      errors: errors.length,
      details: results,
    };
  }

  @Get('backfill')
  @ApiOperation({ summary: 'Aplicar tipoPagamento e corrigir status em invoices existentes' })
  async backfill() {
    return this.xmlImportService.backfillTipoPagamento();
  }
}
