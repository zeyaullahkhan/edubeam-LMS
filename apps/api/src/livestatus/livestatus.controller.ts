import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { DetailCategory, LiveStatusService } from './livestatus.service';

@Controller('live-status')
@UseGuards(JwtGuard)
export class LiveStatusController {
  constructor(private readonly liveStatus: LiveStatusService) {}

  @Get()
  get() {
    return this.liveStatus.get();
  }

  @Get('details')
  getDetails(@Query('category') category: string) {
    if (category !== 'connected' && category !== 'notConnected' && category !== 'notLogin') {
      throw new BadRequestException('category must be connected | notConnected | notLogin');
    }
    return this.liveStatus.getDetails(category as DetailCategory);
  }
}
