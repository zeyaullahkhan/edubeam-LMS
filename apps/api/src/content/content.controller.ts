import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ContentService } from './content.service';
import type { AuthUser } from '@edubeam/shared';

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

  @Get('all-subjects')
  allSubjects() { return this.svc.allSubjects(); }

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

  @Post('lectures')
  createLecture(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.svc.createLecture(user, body);
  }

  @Patch('lectures/:id')
  updateLecture(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateLecture(id, user, body);
  }

  @Patch('lectures/:id/url')
  setUrl(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { youtubeUrl: string | null }) {
    return this.svc.setYoutubeUrl(id, body.youtubeUrl ?? null);
  }

  @Delete('lectures/:id')
  deleteLecture(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteLecture(id, user);
  }
}
