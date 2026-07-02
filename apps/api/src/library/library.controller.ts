import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@edubeam/shared';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LibraryService } from './library.service';

@Controller('library')
@UseGuards(JwtGuard)
export class LibraryController {
  constructor(private readonly svc: LibraryService) {}

  // ── Books ─────────────────────────────────────────────────────────────────

  @Get('books')
  listBooks(
    @CurrentUser() user: AuthUser,
    @Query('schoolId') schoolId?: string,
    @Query('q') q?: string,
    @Query('subject') subject?: string,
    @Query('grade') grade?: string,
  ) {
    return this.svc.listBooks(user, { schoolId, q, subject, grade: grade ? Number(grade) : undefined });
  }

  @Post('books')
  createBook(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.createBook(user, dto);
  }

  @Patch('books/:id')
  updateBook(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateBook(user, id, dto);
  }

  @Delete('books/:id')
  deleteBook(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteBook(user, id);
  }

  // ── Reservations ──────────────────────────────────────────────────────────

  @Get('reservations')
  listReservations(
    @CurrentUser() user: AuthUser,
    @Query('schoolId') schoolId?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.listReservations(user, { schoolId, status });
  }

  @Post('reservations')
  issueBook(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.issueBook(user, dto);
  }

  @Patch('reservations/:id/return')
  returnBook(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.returnBook(user, id);
  }

  // ── Lost Books ────────────────────────────────────────────────────────────

  @Get('lost')
  listLost(@CurrentUser() user: AuthUser, @Query('schoolId') schoolId?: string) {
    return this.svc.listLost(user, { schoolId });
  }

  @Post('lost')
  recordLost(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.recordLost(user, dto);
  }

  @Patch('lost/:id/paid')
  markFinePaid(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.markFinePaid(user, id);
  }

  // ── Digital Resources ─────────────────────────────────────────────────────

  @Get('digital')
  listDigital(
    @CurrentUser() user: AuthUser,
    @Query('schoolId') schoolId?: string,
    @Query('type') type?: string,
    @Query('grade') grade?: string,
  ) {
    return this.svc.listDigital(user, { schoolId, type, grade: grade ? Number(grade) : undefined });
  }

  @Post('digital')
  addDigital(@CurrentUser() user: AuthUser, @Body() dto: any) {
    return this.svc.addDigital(user, dto);
  }

  @Patch('digital/:id')
  updateDigital(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: any) {
    return this.svc.updateDigital(user, id, dto);
  }

  @Delete('digital/:id')
  deleteDigital(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.deleteDigital(user, id);
  }
}
