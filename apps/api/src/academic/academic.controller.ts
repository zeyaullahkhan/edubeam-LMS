import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AcademicService } from './academic.service';

@Controller('academic')
@UseGuards(JwtGuard)
export class AcademicController {
  constructor(private readonly svc: AcademicService) {}

  // ── Teacher Allocation ────────────────────────────────────────────────────

  @Get('allocations')
  listAllocations(
    @CurrentUser() user: AuthUser,
    @Query('schoolId') schoolId?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.svc.listAllocations(user, schoolId, academicYear);
  }

  @Post('allocations')
  createAllocation(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.createAllocation(user, dto);
  }

  @Delete('allocations/:id')
  removeAllocation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.removeAllocation(user, id);
  }

  // ── Homework ──────────────────────────────────────────────────────────────

  @Get('homework')
  listHomework(
    @CurrentUser() user: AuthUser,
    @Query('schoolId') schoolId?: string,
    @Query('grade') grade?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.svc.listHomework(user, {
      schoolId,
      grade: grade ? Number(grade) : undefined,
      academicYear,
    });
  }

  @Post('homework')
  createHomework(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.createHomework(user, dto);
  }

  @Patch('homework/:id')
  updateHomework(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.svc.updateHomework(user, id, dto);
  }

  @Delete('homework/:id')
  deleteHomework(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteHomework(user, id);
  }

  @Get('homework/:id/submissions')
  listSubmissions(@Param('id') id: string) {
    return this.svc.listSubmissions(id);
  }

  @Post('homework/:id/submit')
  submitHomework(@Param('id') id: string, @Body() dto: any) {
    return this.svc.submitHomework(id, dto);
  }

  @Patch('homework/:id/submissions/:sid/mark')
  markSubmission(@Param('sid') sid: string) {
    return this.svc.markSubmission(sid);
  }

  // ── Syllabus / Chapter Progress ───────────────────────────────────────────

  @Get('syllabus')
  listSyllabus(
    @CurrentUser() user: AuthUser,
    @Query('schoolId') schoolId?: string,
    @Query('grade') grade?: string,
    @Query('subject') subject?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    return this.svc.listSyllabus(user, {
      schoolId,
      grade: Number(grade ?? 6),
      subject: subject ?? '',
      academicYear: academicYear ?? '',
    });
  }

  @Post('syllabus/chapter')
  addChapter(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.addChapter(user, dto);
  }

  @Patch('syllabus/chapter/:id/progress')
  updateProgress(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.svc.updateChapterProgress(user, id, dto);
  }

  @Delete('syllabus/chapter/:id')
  deleteChapter(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteChapter(user, id);
  }
}
