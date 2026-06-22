import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { DateRangeDto } from './dto/date-range.dto';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumo financeiro no período' })
  async getSummary(@Query() dto: DateRangeDto) {
    return this.reportsService.getSummary(dto.startDate, dto.endDate);
  }

  @Get('by-period')
  @ApiOperation({ summary: 'Dados agrupados por período (dia/semana/mês)' })
  async getByPeriod(@Query() dto: DateRangeDto) {
    return this.reportsService.getByPeriod(dto.startDate, dto.endDate, dto.period || 'month');
  }

  @Get('by-period-status')
  @ApiOperation({ summary: 'Dados de status (atrasado/aberto/pago) agrupados por período' })
  async getByPeriodStatus(@Query() dto: DateRangeDto) {
    return this.reportsService.getByPeriodAndStatus(
      dto.startDate,
      dto.endDate,
      dto.period || 'month',
    );
  }

  @Get('by-customer')
  @ApiOperation({ summary: 'Dados agrupados por cliente' })
  async getByCustomer(@Query() dto: DateRangeDto) {
    return this.reportsService.getByCustomer(dto.startDate, dto.endDate);
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Exportar relatório como CSV' })
  async exportCsv(@Query() dto: DateRangeDto, @Res() res: Response) {
    const { content, filename } = await this.reportsService.exportCsv(dto.startDate, dto.endDate);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get('export/pdf')
  @ApiOperation({ summary: 'Exportar relatório como PDF' })
  async exportPdf(@Query() dto: DateRangeDto, @Res() res: Response) {
    const buffer = await this.reportsService.exportPdf(dto.startDate, dto.endDate);
    const filename = `relatorio-${dto.startDate}-${dto.endDate}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
