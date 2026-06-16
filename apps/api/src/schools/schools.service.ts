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
      districtId: s.block.districtId,
      block: s.block.name,
      blockId: s.blockId,
      hasVirtualClassroom: s.hasVirtualClassroom,
      hasIctLab: s.hasIctLab,
      address: s.address,
      principalName: s.principalName,
      phone: s.phone,
      teachers: s.ictDeployment?.teacherCount ?? null,
      students: s.ictDeployment?.studentCount ?? null,
      enrolledStudents: enrollMap.get(s.id) ?? null,
      avgPass10th: pass10Map.get(s.id) ?? null,
      avgPass12th: pass12Map.get(s.id) ?? null,
    }));
  }

  async listDistricts(user: AuthUser) {
    const { schoolWhere } = schoolScope(user);
    // Get districts that contain schools in the user's scope
    const blocks = await prisma.block.findMany({
      where: { schools: { some: schoolWhere } },
      include: { district: true },
      orderBy: { district: { name: 'asc' } },
    });
    const districtMap = new Map<string, { id: string; name: string; blocks: { id: string; name: string }[] }>();
    for (const b of blocks) {
      if (!districtMap.has(b.districtId)) {
        districtMap.set(b.districtId, { id: b.districtId, name: b.district.name, blocks: [] });
      }
      districtMap.get(b.districtId)!.blocks.push({ id: b.id, name: b.name });
    }
    return [...districtMap.values()].sort((a, b) => a.name.localeCompare(b.name));
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

    const allowed = await prisma.school.findFirst({ where: { id, ...schoolWhere }, select: { id: true } });
    if (!allowed) throw new ForbiddenException('Outside your scope');

    return school;
  }

  async create(user: AuthUser, body: any) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    const { blockId, name, udiseCode, siteCode, type, hasVirtualClassroom, hasIctLab,
            address, principalName, phone } = body;

    const block = await prisma.block.findUnique({ where: { id: blockId } });
    if (!block) throw new NotFoundException('Block not found');

    return prisma.school.create({
      data: {
        blockId,
        name: String(name).trim(),
        udiseCode: String(udiseCode).trim(),
        siteCode: siteCode ? String(siteCode).trim() : null,
        type: type ?? null,
        hasVirtualClassroom: Boolean(hasVirtualClassroom),
        hasIctLab: Boolean(hasIctLab),
        address: address ? String(address).trim() : null,
        principalName: principalName ? String(principalName).trim() : null,
        phone: phone ? String(phone).trim() : null,
      },
      include: { block: { include: { district: true } } },
    });
  }

  async update(user: AuthUser, id: string, body: any) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('School not found');

    const { name, udiseCode, siteCode, blockId, type, hasVirtualClassroom, hasIctLab,
            address, principalName, phone } = body;

    return prisma.school.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(udiseCode !== undefined && { udiseCode: String(udiseCode).trim() }),
        ...(siteCode !== undefined && { siteCode: siteCode ? String(siteCode).trim() : null }),
        ...(blockId !== undefined && { blockId }),
        ...(type !== undefined && { type: type || null }),
        ...(hasVirtualClassroom !== undefined && { hasVirtualClassroom: Boolean(hasVirtualClassroom) }),
        ...(hasIctLab !== undefined && { hasIctLab: Boolean(hasIctLab) }),
        ...(address !== undefined && { address: address ? String(address).trim() : null }),
        ...(principalName !== undefined && { principalName: principalName ? String(principalName).trim() : null }),
        ...(phone !== undefined && { phone: phone ? String(phone).trim() : null }),
      },
      include: { block: { include: { district: true } } },
    });
  }
}
