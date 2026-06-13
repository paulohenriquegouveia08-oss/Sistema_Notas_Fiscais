import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @ApiOperation({ summary: 'Criar novo cliente' })
  async create(@Body() dto: CreateCustomerDto) {
    const { customer } = await this.customersService.findOrCreateByCnpjOrCpf(dto);
    return customer;
  }

  @Get()
  @ApiOperation({ summary: 'Listar clientes' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
  ) {
    return this.customersService.findAll(+page, +limit, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter cliente por ID' })
  async findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar cliente' })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Get(':id/receivables')
  @ApiOperation({ summary: 'Listar recebíveis do cliente' })
  async getReceivables(@Param('id') id: string) {
    return this.customersService.getReceivables(id);
  }

  @Get(':id/invoices')
  @ApiOperation({ summary: 'Listar notas fiscais do cliente' })
  async getInvoices(@Param('id') id: string) {
    return this.customersService.getInvoices(id);
  }
}
