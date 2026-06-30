import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { XmlDocumentsService } from './xml-documents.service';

@ApiTags('XML Documents')
@Controller('xml-documents')
export class XmlDocumentsController {
  constructor(private readonly service: XmlDocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar XMLs importados' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({ page: page ? +page : undefined, limit: limit ? +limit : undefined, search, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do XML' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Baixar arquivo XML' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { filePath, fileName } = await this.service.getDownloadPath(id);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @Post('backfill')
  @ApiOperation({ summary: 'Popular XMLs a partir de invoices existentes' })
  async backfill() {
    return this.service.backfillFromInvoices();
  }
}
