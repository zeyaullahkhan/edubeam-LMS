import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { AuthUser } from '@edubeam/shared';
import { resolveWritableSchool } from '../people/people.scope';
import { schoolScope } from '../analytics/scope';

const prisma = new PrismaClient();

@Injectable()
export class LibraryService {

  private async resolveSchool(user: AuthUser, requestedId?: string): Promise<string | undefined> {
    const { schoolId } = schoolScope(user);
    if (schoolId) return schoolId;
    if (!requestedId) return undefined;
    return resolveWritableSchool(user, requestedId);
  }

  // ── Books ──────────────────────────────────────────────────────────────────

  async listBooks(user: AuthUser, params: { schoolId?: string; q?: string; subject?: string; grade?: number }) {
    const sid = await this.resolveSchool(user, params.schoolId);
    return prisma.book.findMany({
      where: {
        schoolId: sid,
        ...(params.q ? { OR: [
          { title: { contains: params.q } },
          { author: { contains: params.q } },
          { isbn: { contains: params.q } },
        ]} : {}),
        ...(params.subject ? { subject: params.subject } : {}),
        ...(params.grade ? { grade: params.grade } : {}),
      },
      orderBy: { title: 'asc' },
    });
  }

  async createBook(user: AuthUser, dto: {
    schoolId?: string; title: string; author?: string; isbn?: string;
    publisher?: string; edition?: string; subject?: string; grade?: number;
    totalCopies?: number; coverUrl?: string;
  }) {
    const sid = await resolveWritableSchool(user, dto.schoolId);
    const copies = dto.totalCopies ?? 1;
    return prisma.book.create({
      data: {
        schoolId: sid,
        title: dto.title,
        author: dto.author ?? null,
        isbn: dto.isbn ?? null,
        publisher: dto.publisher ?? null,
        edition: dto.edition ?? null,
        subject: dto.subject ?? null,
        grade: dto.grade ?? null,
        totalCopies: copies,
        availableCopies: copies,
        coverUrl: dto.coverUrl ?? null,
        addedBy: user.id,
      },
    });
  }

  async updateBook(user: AuthUser, id: string, dto: Partial<{
    title: string; author: string; isbn: string; publisher: string;
    edition: string; subject: string; grade: number; totalCopies: number; coverUrl: string;
  }>) {
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) throw new NotFoundException('Book not found');
    await resolveWritableSchool(user, book.schoolId);
    return prisma.book.update({ where: { id }, data: dto });
  }

  async deleteBook(user: AuthUser, id: string) {
    const book = await prisma.book.findUnique({ where: { id } });
    if (!book) throw new NotFoundException('Book not found');
    await resolveWritableSchool(user, book.schoolId);
    return prisma.book.delete({ where: { id } });
  }

  // ── Reservations ───────────────────────────────────────────────────────────

  async listReservations(user: AuthUser, params: { schoolId?: string; status?: string }) {
    const sid = await this.resolveSchool(user, params.schoolId);
    return prisma.bookReservation.findMany({
      where: {
        schoolId: sid,
        ...(params.status ? { status: params.status } : {}),
      },
      include: { book: { select: { title: true, author: true } } },
      orderBy: { issueDate: 'desc' },
    });
  }

  async issueBook(user: AuthUser, dto: {
    schoolId?: string; bookId: string; studentId?: string; studentName: string;
    issueDate: string; dueDate: string;
  }) {
    const sid = await resolveWritableSchool(user, dto.schoolId);
    const book = await prisma.book.findUnique({ where: { id: dto.bookId } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.availableCopies < 1) throw new BadRequestException('No copies available');
    const [reservation] = await prisma.$transaction([
      prisma.bookReservation.create({
        data: {
          bookId: dto.bookId,
          studentId: dto.studentId ?? null,
          studentName: dto.studentName,
          issueDate: dto.issueDate,
          dueDate: dto.dueDate,
          issuedBy: user.id,
          schoolId: sid,
        },
        include: { book: { select: { title: true } } },
      }),
      prisma.book.update({
        where: { id: dto.bookId },
        data: { availableCopies: { decrement: 1 } },
      }),
    ]);
    return reservation;
  }

  async returnBook(user: AuthUser, id: string) {
    const res = await prisma.bookReservation.findUnique({ where: { id } });
    if (!res) throw new NotFoundException('Reservation not found');
    if (res.status === 'RETURNED') throw new BadRequestException('Already returned');
    await resolveWritableSchool(user, res.schoolId);
    const today = new Date().toISOString().slice(0, 10);
    const [updated] = await prisma.$transaction([
      prisma.bookReservation.update({
        where: { id },
        data: { status: 'RETURNED', returnDate: today },
      }),
      prisma.book.update({
        where: { id: res.bookId },
        data: { availableCopies: { increment: 1 } },
      }),
    ]);
    return updated;
  }

  // ── Lost Books ─────────────────────────────────────────────────────────────

  async listLost(user: AuthUser, params: { schoolId?: string }) {
    const sid = await this.resolveSchool(user, params.schoolId);
    return prisma.lostBookRecord.findMany({
      where: { schoolId: sid },
      include: { book: { select: { title: true, author: true } } },
      orderBy: { reportedDate: 'desc' },
    });
  }

  async recordLost(user: AuthUser, dto: {
    schoolId?: string; bookId: string; studentId?: string; studentName: string;
    reportedDate: string; fineAmount?: number;
  }) {
    const sid = await resolveWritableSchool(user, dto.schoolId);
    return prisma.lostBookRecord.create({
      data: {
        bookId: dto.bookId,
        studentId: dto.studentId ?? null,
        studentName: dto.studentName,
        reportedDate: dto.reportedDate,
        fineAmount: dto.fineAmount ?? 0,
        schoolId: sid,
        recordedBy: user.id,
      },
    });
  }

  async markFinePaid(user: AuthUser, id: string) {
    const record = await prisma.lostBookRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Lost record not found');
    await resolveWritableSchool(user, record.schoolId);
    return prisma.lostBookRecord.update({ where: { id }, data: { fineStatus: 'PAID' } });
  }

  // ── Digital Resources ──────────────────────────────────────────────────────

  async listDigital(user: AuthUser, params: { schoolId?: string; type?: string; grade?: number }) {
    const { schoolId: userSchoolId } = schoolScope(user);
    const sid = userSchoolId ?? params.schoolId;
    const gradeFilter = params.grade ? {
      OR: [
        { grade: null },
        { AND: [{ grade: { lte: params.grade } }, { OR: [{ gradeTo: null }, { gradeTo: { gte: params.grade } }] }] },
      ] as any,
    } : {};
    return prisma.digitalResource.findMany({
      where: {
        AND: [
          { OR: [{ schoolId: sid ?? undefined }, { schoolId: null }] },
          ...(params.type ? [{ type: params.type }] : []),
          ...(params.grade ? [gradeFilter] : []),
        ],
      },
      orderBy: { addedAt: 'desc' },
    });
  }

  async addDigital(user: AuthUser, dto: {
    schoolId?: string; tenantId?: string; title: string; type: string;
    subject?: string; grade?: number; gradeTo?: number;
    fileUrl?: string; externalUrl?: string; description?: string;
  }) {
    const { schoolId: userSchoolId } = schoolScope(user);
    const sid = userSchoolId ?? dto.schoolId ?? null;
    return prisma.digitalResource.create({
      data: {
        schoolId: sid,
        tenantId: dto.tenantId ?? user.tenantId ?? null,
        title: dto.title,
        type: dto.type,
        subject: dto.subject ?? null,
        grade: dto.grade ?? null,
        gradeTo: dto.gradeTo ?? null,
        fileUrl: dto.fileUrl ?? null,
        externalUrl: dto.externalUrl ?? null,
        description: dto.description ?? null,
        addedBy: user.id,
        addedByName: user.name,
      },
    });
  }

  async updateDigital(user: AuthUser, id: string, dto: any) {
    const res = await prisma.digitalResource.findUnique({ where: { id } });
    if (!res) throw new NotFoundException('Resource not found');
    return prisma.digitalResource.update({ where: { id }, data: dto });
  }

  async deleteDigital(user: AuthUser, id: string) {
    const res = await prisma.digitalResource.findUnique({ where: { id } });
    if (!res) throw new NotFoundException('Resource not found');
    return prisma.digitalResource.delete({ where: { id } });
  }
}
