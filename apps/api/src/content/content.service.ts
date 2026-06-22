import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { prisma } from '@edubeam/db';
import type { AuthUser } from '@edubeam/shared';

const EDITOR_ROLES = new Set(['ADMIN']);

const PAGE_SIZE = 30;

@Injectable()
export class ContentService {
  /** Unique subjects for a standard, ordered by lecture count desc. */
  async subjects(standard: number) {
    const rows = await prisma.lecture.groupBy({
      by: ['subject'],
      where: { standard },
      _count: { subject: true },
      orderBy: { _count: { subject: 'desc' } },
    });
    return { standard, subjects: rows.map(r => ({ subject: r.subject, count: r._count.subject })) };
  }

  /** Paginated lecture list with search filters. */
  async lectures(
    standard: number,
    subject: string,
    opts: { search?: string; date?: string; page?: number },
  ) {
    const page = Math.max(1, opts.page ?? 1);
    const offset = (page - 1) * PAGE_SIZE;

    const where: Record<string, unknown> = { standard, subject };
    if (opts.date) where.date = opts.date;
    if (opts.search) {
      where.OR = [
        { topic: { contains: opts.search } },
        { teacherName: { contains: opts.search } },
      ];
    }

    const [total, lectures] = await Promise.all([
      prisma.lecture.count({ where }),
      prisma.lecture.findMany({
        where,
        orderBy: [{ date: 'desc' }, { srNo: 'asc' }],
        skip: offset,
        take: PAGE_SIZE,
        select: { id: true, srNo: true, date: true, studioName: true, medium: true, startTime: true, endTime: true, teacherName: true, subject: true, topic: true, youtubeUrl: true },
      }),
    ]);

    return { total, page, pageSize: PAGE_SIZE, pages: Math.ceil(total / PAGE_SIZE), lectures };
  }

  /** All studio → channel mappings. */
  async channels() {
    return prisma.contentChannel.findMany({ orderBy: { studioName: 'asc' } });
  }

  /** Summary stats: total lectures, by studio, by standard, years. */
  async stats() {
    const [byStudio, byStandard, earliest, latest] = await Promise.all([
      prisma.lecture.groupBy({ by: ['studioName'], _count: { id: true }, orderBy: { studioName: 'asc' } }),
      prisma.lecture.groupBy({ by: ['standard'], _count: { id: true }, orderBy: { standard: 'asc' } }),
      prisma.lecture.findFirst({ orderBy: { date: 'asc' }, select: { date: true } }),
      prisma.lecture.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
    ]);

    return {
      total: byStudio.reduce((a, r) => a + r._count.id, 0),
      byStudio: byStudio.map(r => ({ studioName: r.studioName, count: r._count.id })),
      byStandard: byStandard.map(r => ({ standard: r.standard, count: r._count.id })),
      dateRange: { from: earliest?.date ?? null, to: latest?.date ?? null },
    };
  }

  /** Set a YouTube URL on a specific lecture (admin action). */
  async setYoutubeUrl(id: string, youtubeUrl: string | null) {
    await prisma.lecture.update({ where: { id }, data: { youtubeUrl } });
    return { ok: true };
  }

  /** All subjects across all standards (for move-to dropdown). */
  async allSubjects() {
    const rows = await prisma.lecture.groupBy({
      by: ['subject'],
      _count: { subject: true },
      orderBy: { _count: { subject: 'desc' } },
    });
    return rows.map(r => r.subject);
  }

  /** Full update of a lecture (subject, topic, teacher, date, times, studio, standard, medium, url). */
  async updateLecture(id: string, user: AuthUser, dto: {
    topic?: string; teacherName?: string; subject?: string;
    standard?: number; studioName?: string; date?: string;
    startTime?: string; endTime?: string; medium?: string; youtubeUrl?: string | null;
  }) {
    if (!EDITOR_ROLES.has(user.role)) throw new ForbiddenException('Not authorized');
    const existing = await prisma.lecture.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lecture not found');
    const updated = await prisma.lecture.update({ where: { id }, data: dto });
    return updated;
  }

  /** Create a new lecture entry (link only, no upload). */
  async createLecture(user: AuthUser, dto: {
    topic: string; teacherName: string; subject: string;
    standard: number; studioName: string; date: string;
    startTime: string; endTime: string; medium?: string; youtubeUrl?: string | null;
  }) {
    if (!EDITOR_ROLES.has(user.role)) throw new ForbiddenException('Not authorized');
    const maxSrNo = await prisma.lecture.aggregate({ _max: { srNo: true } });
    return prisma.lecture.create({
      data: {
        ...dto,
        medium: dto.medium ?? 'Hindi',
        srNo: (maxSrNo._max.srNo ?? 0) + 1,
        youtubeUrl: dto.youtubeUrl ?? null,
      },
    });
  }

  /** Delete a lecture (admin only). */
  async deleteLecture(id: string, user: AuthUser) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Not authorized');
    const existing = await prisma.lecture.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Lecture not found');
    await prisma.lecture.delete({ where: { id } });
    return { ok: true };
  }
}
