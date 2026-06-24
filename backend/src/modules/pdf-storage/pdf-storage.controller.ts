import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UploadedFiles,
  Body,
  UseInterceptors,
  Res,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import { PdfStorageService } from './pdf-storage.service';

@ApiTags('PDF Storage')
@Controller('pdf-storage')
export class PdfStorageController {
  private readonly logger = new Logger(PdfStorageController.name);

  constructor(private readonly service: PdfStorageService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload de PDFs' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 200))
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    const docs = await this.service.uploadMany(files);
    return { success: true, data: docs, total: docs.length };
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os PDFs' })
  async findAll(@Query('search') search?: string) {
    return this.service.findAll(search);
  }

  @Post('date-editor')
  @ApiOperation({ summary: 'Gerar PDF com data alterada' })
  async generateWithEditedDate(@Body() body: {
    invoiceId: string;
    date: string;
    time?: string;
    productDescription?: string;
    productCode?: string;
    serie?: string;
    numero?: string;
    unitValue?: number;
    quantity?: number;
    valorFrete?: number;
    valorDesconto?: number;
    valorTotalTributos?: number;
    tipoPagamento?: string;
    qtdeParcelas?: number;
  }) {
    return this.service.generateWithEditedDate(body);
  }

  @Get('date-editor/products/:invoiceId')
  @ApiOperation({ summary: 'Buscar produtos do XML de uma nota' })
  async getProductsFromInvoice(@Param('invoiceId') invoiceId: string) {
    return this.service.getProductsFromInvoice(invoiceId);
  }

  @Get('date-editor/:fileName')
  @ApiOperation({ summary: 'Visualizar/download do PDF gerado com data alterada' })
  async getEditedDateFile(@Param('fileName') fileName: string, @Res() res: Response) {
    const filePath = this.service.getEditedDateFilePath(fileName);
    if (!filePath) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ message: 'Arquivo PDF não encontrado no servidor', fileName });
    }

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter metadados de um PDF' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/file')
  @ApiOperation({ summary: 'Visualizar/download do PDF' })
  async getFile(@Param('id') id: string, @Res() res: Response) {
    const filePath = await this.service.getFilePath(id);
    if (!filePath) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(404).json({ message: 'Arquivo físico não encontrado no servidor', id });
    }
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', 'inline');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover PDF' })
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true, message: 'PDF removido' };
  }
}
