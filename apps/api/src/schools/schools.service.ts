import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@edubeam/db';
import type { AuthUser } from '@edubeam/shared';
import { schoolScope } from '../analytics/scope';

@Injectable()
export class SchoolsService {
  async list(user: AuthUser, opts: { districtId?: string; blockId?: string; q?: string }) {
    const { schoolWhere } = schoolScope(user, opts.districtId);
    const schools = await prisma.school.findMany({
      where: {
        ...schoolWhere,
        ...(opts.blockId ? { blockId: opts.blockId } : {}),
        ...(opts.q ? { name: { contains: opts.q } } : {}),
      },
      orderBy: { name: 'asc' },
      take: 500,
      include: { block: { include: { district: true } }, ictDeployment: true },
    });

    const schoolIds = schools.map((s) => s.id);
    const [boardResults, enrollTotals] = await Promise.all([
      prisma.boardResult.groupBy({
        by: ['schoolId', 'examType'],
        _avg: { passPct: true },
        where: { schoolId: { in: schoolIds }, examType: { in: ['10TH', '12TH'] } },
      }),
      prisma.enrollment.groupBy({
        by: ['schoolId'],
        _sum: { total: true },
        where: { schoolId: { in: schoolIds } },
      }),
    ]);

    const pass10Map = new Map(
      boardResults.filter((r) => r.examType === '10TH').map((r) => [r.schoolId, r._avg.passPct]),
    );
    const pass12Map = new Map(
      boardResults.filter((r) => r.examType === '12TH').map((r) => [r.schoolId, r._avg.passPct]),
    );
    const enrollMap = new Map(enrollTotals.map((e) => [e.schoolId, e._sum.total]));

    return schools.map((s) => ({
      id: s.id,
      name: s.name,
      udiseCode: s.udiseCode,
      siteCode: s.siteCode,
      type: s.type,
      district: s.block.district.name,
      block: s.block.name,
      hasVirtualClassroom: s.hasVirtualClassroom,
      hasIctLab: s.hasIctLab,
      teachers: s.ictDeployment?.teacherCount ?? null,
      students: s.ictDeployment?.studentCount ?? null,
      enrolledStudents: enrollMap.get(s.id) ?? null,
      avgPass10th: pass10Map.get(s.id) ?? null,
      avgPass12th: pass12Map.get(s.id) ?? null,
    }));
  }

  async detail(user: AuthUser, id: string) {
    const { schoolWhere } = schoolScope(user);
    const school = await prisma.school.findUnique({
      where: { id },
      include: {
        block: { include: { district: true } },
        enrollments: { orderBy: { grade: 'asc' } },
        boardResults: true,
        ictDeployment: true,
      },
    });
    if (!school) throw new NotFoundException('School not found');

    // Re-check scope: ensure this school is within the caller's allowed set.
    const allowed = await prisma.school.findFirst({ where: { id, ...schoolWhere }, select: { id: true } });
    if (!allowed) throw new ForbiddenException('Outside your scope');

    return school;
  }
}
