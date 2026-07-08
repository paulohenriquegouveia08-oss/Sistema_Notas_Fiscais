import { Module } from '@nestjs/common';
import { DevokMonitorController } from './devok-monitor.controller';

@Module({
  controllers: [DevokMonitorController],
})
export class DevokMonitorModule {}
