import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReceivablesService } from './receivables.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { PayReceivableDto } from './dto/pay-receivable.dto';

@ApiTags('Receivables')
@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly receivablesService: ReceivablesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar recebível manualmente' })
  async create(@Body() dto: CreateReceivableDto) {
    return this.receivablesService.createFromInvoice(
      { id: dto.invoiceId, customerId: dto.customerId } as any,
      { detPag: [{ tPag: dto.formaPagamento || '99', vPag: dto.valorOriginal.toString() }] },
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar recebíveis' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'invoiceId', required: false, type: String })
  @ApiQuery({ name: 'dataInicio', required: false, type: String })
  @ApiQuery({ name: 'dataFim', required: false, type: String })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 200,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.receivablesService.findAll({
      page: +page,
      limit: +limit,
      status,
      customerId,
      invoiceId,
      dataInicio,
      dataFim,
    });
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Listar recebíveis vencidos' })
  async listOverdue() {
    return this.receivablesService.listOverdue();
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Listar recebíveis a vencer' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async findUpcoming(@Query('days') days = 30) {
    return this.receivablesService.findUpcoming(+days);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Listar recebíveis para agenda (todos os status, amplo período)' })
  async findCalendar() {
    return this.receivablesService.findCalendar();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter recebível por ID' })
  async findOne(@Param('id') id: string) {
    return this.receivablesService.findOne(id);
  }

  @Patch(':id/pay')
  @ApiOperation({ summary: 'Registrar pagamento de recebível' })
  async pay(@Param('id') id: string, @Body() dto: PayReceivableDto) {
    return this.receivablesService.pay(id, dto);
  }

  @Patch(':id/unpay')
  @ApiOperation({ summary: 'Desfazer pagamento de recebível' })
  async unpay(@Param('id') id: string) {
    return this.receivablesService.unpay(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar recebível' })
  async cancel(@Param('id') id: string) {
    return this.receivablesService.cancel(id);
  }
}
