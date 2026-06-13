import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Obter resumo do dashboard' })
  async getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('chart/monthly')
  @ApiOperation({ summary: 'Obter dados do gráfico mensal' })
  async getMonthlyChart() {
    return this.dashboardService.getMonthlyChart();
  }

  @Get('overdue-list')
  @ApiOperation({ summary: 'Listar top 10 clientes com mais valores vencidos' })
  async getOverdueList() {
    return this.dashboardService.getOverdueList();
  }
}
