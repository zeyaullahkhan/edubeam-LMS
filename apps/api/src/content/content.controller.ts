import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { ContentService } from './content.service';

@Controller('content')
@UseGuards(JwtGuard)
export class ContentController {
  constructor(private readonly svc: ContentService) {}

  @Get('stats')
  stats() { return this.svc.stats(); }

  @Get('channels')
  channels() { return this.svc.channels(); }

  @Get('subjects')
  subjects(@Query('standard') standard: string) {
    return this.svc.subjects(Number(standard));
  }

  @Get('lectures')
  lectures(
    @Query('standard') standard: string,
    @Query('subject') subject: string,
    @Query('search') search?: string,
    @Query('date') date?: string,
    @Query('page') page?: string,
  ) {
    return this.svc.lectures(Number(standard), subject, { search, date, page: page ? Number(page) : 1 });
  }

  @Patch('lectures/:id/url')
  setUrl(@Param('id') id: string, @Body() body: { youtubeUrl: string | null }) {
    return this.svc.setYoutubeUrl(id, body.youtubeUrl ?? null);
  }
}
