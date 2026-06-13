import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReceivablesService } from '../receivables.service';

@Injectable()
export class OverdueJob {
  private readonly logger = new Logger(OverdueJob.name);

  constructor(private readonly receivablesService: ReceivablesService) {}

  @Cron('0 * * * *')
  async markOverdue() {
    this.logger.log('Iniciando job de marcação de recebíveis vencidos...');
    try {
      const count = await this.receivablesService.markOverdue();
      if (count > 0) {
        this.logger.log(`${count} recebíveis marcados como vencidos`);
      } else {
        this.logger.log('Nenhum recebível vencido encontrado');
      }
    } catch (err: any) {
      this.logger.error(`Erro no job de inadimplência: ${err.message}`);
    }
  }
}
