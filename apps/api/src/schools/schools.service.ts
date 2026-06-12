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
