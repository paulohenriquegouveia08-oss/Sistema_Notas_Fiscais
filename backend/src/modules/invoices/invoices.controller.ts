import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@Controller('invoices')
export class InvoicesController {
  private readonly logger = new Logger(InvoicesController.name);

  constructor(
    private readonly invoicesService: InvoicesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar nota fiscal manualmente' })
  async create(@Body() dto: any) {
    return this.invoicesService.createFromXml(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar notas fiscais' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'dataInicio', required: false, type: String })
  @ApiQuery({ name: 'dataFim', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  @ApiQuery({ name: 'pessoaFisica', required: false, type: String })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('pessoaFisica') pessoaFisica?: string,
  ) {
    return this.invoicesService.findAll({
      page: +page,
      limit: +limit,
      customerId,
      status,
      dataInicio,
      dataFim,
      search,
      sortBy,
      sortOrder,
      pessoaFisica: pessoaFisica === 'true',
    });
  }

  @Get('check-chave/:chave')
  @ApiOperation({ summary: 'Verificar se chave de acesso já existe no banco' })
  async checkChave(@Param('chave') chave: string) {
    const exists = await this.invoicesService.checkByChaveAcesso(chave);
    return { exists };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter nota fiscal por ID' })
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar dados da nota fiscal' })
  async update(@Param('id') id: string, @Body() dto: Record<string, any>) {
    return this.invoicesService.update(id, dto);
  }

  @Get(':id/receivables')
  @ApiOperation({ summary: 'Listar recebíveis da nota fiscal' })
  async getReceivables(@Param('id') id: string) {
    return this.invoicesService.getReceivables(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Baixar PDF da nota fiscal' })
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.invoicesService.findOne(id);
    if (!invoice.pdfPath) {
      return res.status(404).json({ message: 'PDF não disponível para esta nota' });
    }

    if (!fs.existsSync(invoice.pdfPath)) {
      return res.status(404).json({ message: 'Arquivo PDF não encontrado no servidor' });
    }

    const filename = `${invoice.chaveAcesso}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    const stream = fs.createReadStream(invoice.pdfPath);
    stream.pipe(res);
  }
}
