import { Module } from '@nestjs/common';
import { LiveStatusService } from './livestatus.service';
import { LiveStatusController } from './livestatus.controller';

@Module({
  providers: [LiveStatusService],
  controllers: [LiveStatusController],
})
export class LiveStatusModule {}
