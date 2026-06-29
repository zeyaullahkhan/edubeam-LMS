import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SchoolsService } from './schools.service';

@Controller('schools')
@UseGuards(JwtGuard)
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('districtId') districtId?: string,
    @Query('blockId') blockId?: string,
    @Query('q') q?: string,
  ) {
    return this.schools.list(user, { districtId, blockId, q });
  }

  @Get('meta/districts')
  districts(@CurrentUser() user: AuthUser) {
    return this.schools.listDistricts(user);
  }

  // ── Academic Years — must be before @Get(':id') to avoid route collision ────

  @Get('academic-years')
  listAcademicYears(@CurrentUser() user: AuthUser) {
    return this.schools.listAcademicYears(user);
  }

  @Post('academic-years')
  createAcademicYear(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.schools.createAcademicYear(user, body);
  }

  @Patch('academic-years/:id/set-current')
  setCurrentAcademicYear(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.setCurrentAcademicYear(user, id);
  }

  @Patch('academic-years/:id')
  updateAcademicYear(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.schools.updateAcademicYear(user, id, body);
  }

  @Delete('academic-years/:id')
  deleteAcademicYear(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.deleteAcademicYear(user, id);
  }

  // ── Subjects (state-wide catalog) — static routes BEFORE :id wildcard ───────

  @Get('subjects')
  listSubjects(@CurrentUser() user: AuthUser, @Query('tenantId') tenantId?: string) {
    return this.schools.listSubjects(user, tenantId);
  }

  @Post('subjects/bulk')
  bulkCreateSubjects(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.schools.bulkCreateSubjects(user, body);
  }

  @Post('subjects')
  createSubject(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.schools.createSubject(user, body);
  }

  @Patch('subjects/:id')
  updateSubject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.schools.updateSubject(user, id, body);
  }

  @Delete('subjects/:id')
  deleteSubject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.deleteSubject(user, id);
  }

  // ── Class Sections — static routes BEFORE :id wildcards ─────────────────────

  @Post('class-sections/bulk')
  bulkCreateClassSections(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.schools.bulkCreateClassSections(user, body);
  }

  // ── Per-school routes — :id wildcard MUST come after all static routes ──────

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.detail(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.schools.create(user, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.schools.update(user, id, body);
  }

  @Get(':id/class-sections')
  listClassSections(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('academicYear') academicYear?: string) {
    return this.schools.listClassSections(user, id, academicYear);
  }

  @Post(':id/class-sections')
  createClassSection(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.schools.createClassSection(user, { ...body, schoolId: id });
  }

  @Patch('class-sections/:id')
  updateClassSection(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.schools.updateClassSection(user, id, body);
  }

  @Delete('class-sections/:id')
  deleteClassSection(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.deleteClassSection(user, id);
  }

  @Get('class-sections/:id/assignments')
  listAssignments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.listAssignments(user, id);
  }

  @Post('class-sections/:id/assignments')
  createAssignment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.schools.createAssignment(user, { ...body, classSectionId: id });
  }

  @Delete('assignments/:id')
  deleteAssignment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.deleteAssignment(user, id);
  }

}
