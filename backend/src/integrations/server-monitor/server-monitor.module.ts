import { Module, Global } from '@nestjs/common';
import { ServerMonitorService } from './server-monitor.service';

@Global()
@Module({
  providers: [ServerMonitorService],
  exports: [ServerMonitorService],
})
export class ServerMonitorModule {}
