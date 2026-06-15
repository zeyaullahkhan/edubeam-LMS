import { Injectable } from '@nestjs/common';
import { prisma } from '@edubeam/db';

const PAGE_SIZE = 30;

@Injectable()
export class ContentService {
  /** Unique subjects for a standard, ordered by lecture count desc. */
  async subjects(standard: number) {
    const rows = await prisma.$queryRawUnsafe<{ subject: string; count: number }[]>(
      `SELECT subject, COUNT(*) as count FROM Lecture WHERE standard = ? GROUP BY subject ORDER BY count DESC`,
      standard,
    );
    return { standard, subjects: rows.map(r => ({ subject: r.subject, count: Number(r.count) })) };
  }

  /** Paginated lecture list with search filters. */
  async lectures(
    standard: number,
    subject: string,
    opts: { search?: string; date?: string; page?: number },
  ) {
    const page = opts.page ?? 1;
    const offset = (page - 1) * PAGE_SIZE;

    const conditions: string[] = ['standard = ?', 'subject = ?'];
    const params: unknown[] = [standard, subject];

    if (opts.date) {
      conditions.push('date = ?');
      params.push(opts.date);
    }
    if (opts.search) {
      conditions.push(`(topic LIKE ? OR teacherName LIKE ?)`);
      const like = `%${opts.search}%`;
      params.push(like, like);
    }

    const where = conditions.join(' AND ');

    const [countRows, lectures] = await Promise.all([
      prisma.$queryRawUnsafe<{ total: number }[]>(
        `SELECT COUNT(*) as total FROM Lecture WHERE ${where}`,
        ...params,
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT id, srNo, date, studioName, medium, startTime, endTime, teacherName, subject, topic, youtubeUrl
         FROM Lecture WHERE ${where} ORDER BY date DESC, srNo ASC LIMIT ? OFFSET ?`,
        ...params, PAGE_SIZE, offset,
      ),
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    return { total, page, pageSize: PAGE_SIZE, pages: Math.ceil(total / PAGE_SIZE), lectures };
  }

  /** All studio → channel mappings. */
  async channels() {
    return prisma.contentChannel.findMany({ orderBy: { studioName: 'asc' } });
  }

  /** Summary stats: total lectures, by studio, available years. */
  async stats() {
    const [byStudio, byStandard, years] = await Promise.all([
      prisma.$queryRawUnsafe<{ studioName: string; count: number }[]>(
        `SELECT studioName, COUNT(*) as count FROM Lecture GROUP BY studioName ORDER BY studioName`,
      ),
      prisma.$queryRawUnsafe<{ standard: number; count: number }[]>(
        `SELECT standard, COUNT(*) as count FROM Lecture GROUP BY standard ORDER BY standard`,
      ),
      prisma.$queryRawUnsafe<{ year: string }[]>(
        `SELECT DISTINCT substr(date,1,4) as year FROM Lecture ORDER BY year DESC`,
      ),
    ]);
    return {
      total: byStudio.reduce((a, r) => a + Number(r.count), 0),
      byStudio: byStudio.map(r => ({ ...r, count: Number(r.count) })),
      byStandard: byStandard.map(r => ({ ...r, standard: Number(r.standard), count: Number(r.count) })),
      years: years.map(r => r.year),
    };
  }

  /** Set a YouTube URL on a specific lecture (admin action). */
  async setYoutubeUrl(id: string, youtubeUrl: string | null) {
    await prisma.$executeRawUnsafe(
      `UPDATE Lecture SET youtubeUrl = ? WHERE id = ?`,
      youtubeUrl, id,
    );
    return { ok: true };
  }
}
