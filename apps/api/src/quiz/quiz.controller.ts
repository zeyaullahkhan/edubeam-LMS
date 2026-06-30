import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { QuizService } from './quiz.service';

@Controller('quiz')
@UseGuards(JwtGuard)
export class QuizController {
  constructor(private readonly svc: QuizService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.create(user, dto);
  }

  // stats MUST be before :id to avoid route collision
  @Get('stats')
  stats(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.svc.stats(user, { tenantId, districtId, blockId, schoolId });
  }

  @Post(':id/questions')
  setQuestions(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { questions: any[] }) {
    return this.svc.setQuestions(user, id, body.questions);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('schoolId') schoolId?: string,
    @Query('grade') grade?: string,
  ) {
    return this.svc.list(user, { schoolId, grade: grade ? Number(grade) : undefined });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.get(user, id);
  }

  @Post(':id/attempt')
  submitAttempt(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) {
    return this.svc.submitAttempt(user, id, dto);
  }

  @Get(':id/results')
  results(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.results(user, id);
  }

  @Patch(':id/toggle')
  toggleActive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.toggleActive(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.remove(user, id);
  }
}
