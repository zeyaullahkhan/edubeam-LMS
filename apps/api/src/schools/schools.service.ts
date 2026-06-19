import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@edubeam/db';
import type { AuthUser } from '@edubeam/shared';
import { schoolScope } from '../analytics/scope';

const IS_POSTGRES = process.env.DATABASE_URL?.startsWith('postgresql') ?? false;

@Injectable()
export class SchoolsService {
  async list(user: AuthUser, opts: { districtId?: string; blockId?: string; q?: string }) {
    const { schoolWhere } = schoolScope(user, opts.districtId);
    const schools = await prisma.school.findMany({
      where: {
        ...schoolWhere,
        ...(opts.blockId ? { blockId: opts.blockId } : {}),
        ...(opts.q ? { name: { contains: opts.q, ...(IS_POSTGRES ? { mode: 'insensitive' as const } : {}) } } : {}),
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
        _sum: { total: true, boys: true, girls: true },
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
    const boyMap = new Map(enrollTotals.map((e) => [e.schoolId, e._sum.boys]));
    const girlMap = new Map(enrollTotals.map((e) => [e.schoolId, e._sum.girls]));

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
      boys: boyMap.get(s.id) ?? null,
      girls: girlMap.get(s.id) ?? null,
      avgPass10th: pass10Map.get(s.id) ?? null,
      avgPass12th: pass12Map.get(s.id) ?? null,
      // Infrastructure
      campusArea: s.campusArea,
      campusAreaUnit: s.campusAreaUnit,
      builtUpArea: s.builtUpArea,
      numBuildings: s.numBuildings,
      numClassrooms: s.numClassrooms,
      hasPlayground: s.hasPlayground,
      hasBoundaryWall: s.hasBoundaryWall,
      hasLibrary: s.hasLibrary,
      hasLaboratory: s.hasLaboratory,
      hasComputerLab: s.hasComputerLab,
      hasSmartClassroom: s.hasSmartClassroom,
      hasElectricity: s.hasElectricity,
      hasInternet: s.hasInternet,
      hasCctv: s.hasCctv,
      // Water & Sanitation
      hasDrinkingWater: s.hasDrinkingWater,
      drinkingWaterSource: s.drinkingWaterSource,
      numToilets: s.numToilets,
      numBoysToilets: s.numBoysToilets,
      numGirlsToilets: s.numGirlsToilets,
      hasCwsnToilet: s.hasCwsnToilet,
      hasHandwashing: s.hasHandwashing,
      // Academic
      classesFrom: s.classesFrom,
      classesTo: s.classesTo,
      streams: s.streams,
      // Safety
      hasFireSafety: s.hasFireSafety,
      hasDisasterPlan: s.hasDisasterPlan,
      hasFirstAid: s.hasFirstAid,
      hasSecurityGuard: s.hasSecurityGuard,
      emergencyContact: s.emergencyContact,
      // Profile tracking
      profileUpdatedBy: s.profileUpdatedBy,
      profileUpdatedAt: s.profileUpdatedAt?.toISOString() ?? null,
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

    const {
      name, udiseCode, siteCode, blockId, type, hasVirtualClassroom, hasIctLab,
      address, principalName, phone,
      campusArea, campusAreaUnit, builtUpArea, numBuildings, numClassrooms,
      hasPlayground, hasBoundaryWall, hasLibrary, hasLaboratory, hasComputerLab,
      hasSmartClassroom, hasElectricity, hasInternet, hasCctv,
      hasDrinkingWater, drinkingWaterSource, numToilets, numBoysToilets, numGirlsToilets,
      hasCwsnToilet, hasHandwashing,
      classesFrom, classesTo, streams,
      hasFireSafety, hasDisasterPlan, hasFirstAid, hasSecurityGuard, emergencyContact,
    } = body;

    const nullBool = (v: any) => v === null ? null : v !== undefined ? Boolean(v) : undefined;
    const nullInt  = (v: any) => v === null ? null : v !== undefined ? parseInt(v, 10) : undefined;
    const nullFlt  = (v: any) => v === null ? null : v !== undefined ? parseFloat(v) : undefined;
    const nullStr  = (v: any) => v === null ? null : v !== undefined ? (String(v).trim() || null) : undefined;

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
        ...(address !== undefined && { address: nullStr(address) }),
        ...(principalName !== undefined && { principalName: nullStr(principalName) }),
        ...(phone !== undefined && { phone: nullStr(phone) }),
        // Infrastructure
        ...(campusArea !== undefined && { campusArea: nullFlt(campusArea) }),
        ...(campusAreaUnit !== undefined && { campusAreaUnit: nullStr(campusAreaUnit) }),
        ...(builtUpArea !== undefined && { builtUpArea: nullFlt(builtUpArea) }),
        ...(numBuildings !== undefined && { numBuildings: nullInt(numBuildings) }),
        ...(numClassrooms !== undefined && { numClassrooms: nullInt(numClassrooms) }),
        ...(hasPlayground !== undefined && { hasPlayground: nullBool(hasPlayground) }),
        ...(hasBoundaryWall !== undefined && { hasBoundaryWall: nullBool(hasBoundaryWall) }),
        ...(hasLibrary !== undefined && { hasLibrary: nullBool(hasLibrary) }),
        ...(hasLaboratory !== undefined && { hasLaboratory: nullBool(hasLaboratory) }),
        ...(hasComputerLab !== undefined && { hasComputerLab: nullBool(hasComputerLab) }),
        ...(hasSmartClassroom !== undefined && { hasSmartClassroom: nullBool(hasSmartClassroom) }),
        ...(hasElectricity !== undefined && { hasElectricity: nullBool(hasElectricity) }),
        ...(hasInternet !== undefined && { hasInternet: nullBool(hasInternet) }),
        ...(hasCctv !== undefined && { hasCctv: nullBool(hasCctv) }),
        // Water & Sanitation
        ...(hasDrinkingWater !== undefined && { hasDrinkingWater: nullBool(hasDrinkingWater) }),
        ...(drinkingWaterSource !== undefined && { drinkingWaterSource: nullStr(drinkingWaterSource) }),
        ...(numToilets !== undefined && { numToilets: nullInt(numToilets) }),
        ...(numBoysToilets !== undefined && { numBoysToilets: nullInt(numBoysToilets) }),
        ...(numGirlsToilets !== undefined && { numGirlsToilets: nullInt(numGirlsToilets) }),
        ...(hasCwsnToilet !== undefined && { hasCwsnToilet: nullBool(hasCwsnToilet) }),
        ...(hasHandwashing !== undefined && { hasHandwashing: nullBool(hasHandwashing) }),
        // Academic
        ...(classesFrom !== undefined && { classesFrom: nullInt(classesFrom) }),
        ...(classesTo !== undefined && { classesTo: nullInt(classesTo) }),
        ...(streams !== undefined && { streams: nullStr(streams) }),
        // Safety
        ...(hasFireSafety !== undefined && { hasFireSafety: nullBool(hasFireSafety) }),
        ...(hasDisasterPlan !== undefined && { hasDisasterPlan: nullBool(hasDisasterPlan) }),
        ...(hasFirstAid !== undefined && { hasFirstAid: nullBool(hasFirstAid) }),
        ...(hasSecurityGuard !== undefined && { hasSecurityGuard: nullBool(hasSecurityGuard) }),
        ...(emergencyContact !== undefined && { emergencyContact: nullStr(emergencyContact) }),
        // Auto-track who updated profile
        profileUpdatedBy: user.name,
        profileUpdatedAt: new Date(),
      },
      include: { block: { include: { district: true } } },
    });
  }
}
