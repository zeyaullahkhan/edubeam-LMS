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
      phone2: s.phone2,
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
      // General Info (extended)
      registrationNumber: s.registrationNumber,
      email: s.email,
      yearEstablished: s.yearEstablished,
      assemblyConstituency: s.assemblyConstituency,
      gramPanchayat: s.gramPanchayat,
      managedBy: s.managedBy,
      mediumOfInstruction: s.mediumOfInstruction,
      // Land Record
      totalLand: s.totalLand,
      totalLandUnit: s.totalLandUnit,
      hasGarden: s.hasGarden,
      landInSchoolName: s.landInSchoolName,
      // Building
      buildingType: s.buildingType,
      hasHmRoom: s.hasHmRoom,
      hasOfficeRoom: s.hasOfficeRoom,
      hasCommonRoom: s.hasCommonRoom,
      hasComputerRoom: s.hasComputerRoom,
      hasArtCraftRoom: s.hasArtCraftRoom,
      // Furniture
      hmChairs: s.hmChairs, hmTables: s.hmTables, hmCupboards: s.hmCupboards,
      officeChairs: s.officeChairs, officeTables: s.officeTables, officeCupboards: s.officeCupboards,
      commonChairs: s.commonChairs, commonTables: s.commonTables, commonCupboards: s.commonCupboards,
      classChairs: s.classChairs, classTables: s.classTables, classCupboards: s.classCupboards,
      computerChairs: s.computerChairs, computerTables: s.computerTables, computerCupboards: s.computerCupboards,
      libraryChairs: s.libraryChairs, libraryTables: s.libraryTables, libraryCupboards: s.libraryCupboards,
      artChairs: s.artChairs, artTables: s.artTables, artCupboards: s.artCupboards,
      vcChairs: s.vcChairs, vcTables: s.vcTables, vcCupboards: s.vcCupboards,
      // Water (additional)
      hasOverheadTank: s.hasOverheadTank,
      waterQuantity: s.waterQuantity,
      hasWaterPurifier: s.hasWaterPurifier,
      purifierInstallDate: s.purifierInstallDate,
      // Toilets (detailed)
      numUsableToilets: s.numUsableToilets,
      numUnusableToilets: s.numUnusableToilets,
      numStaffToilets: s.numStaffToilets,
      numCwsnToilets: s.numCwsnToilets,
      numOtherToilets: s.numOtherToilets,
      // Electricity
      electricityAvailability: s.electricityAvailability,
      // Computer Lab
      numDesktopPCs: s.numDesktopPCs,
      hasUPS: s.hasUPS,
      hasInternetConnectivity: s.hasInternetConnectivity,
      // Hostel
      numHostelStudentRooms: s.numHostelStudentRooms,
      hostelStudentCapacity: s.hostelStudentCapacity,
      numHostelStudents: s.numHostelStudents,
      numHostelStaffRooms: s.numHostelStaffRooms,
      hostelStaffCapacity: s.hostelStaffCapacity,
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
            address, principalName, phone, phone2 } = body;

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
        phone2: phone2 ? String(phone2).trim() : null,
      },
      include: { block: { include: { district: true } } },
    });
  }

  async update(user: AuthUser, id: string, body: any) {
    const isPrincipalOwnSchool = user.role === 'PRINCIPAL' && user.schoolId === id;
    if (user.role !== 'ADMIN' && !isPrincipalOwnSchool) throw new ForbiddenException('Not authorized');
    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('School not found');
    // Principals cannot change identity/location fields
    if (isPrincipalOwnSchool) {
      delete body.name; delete body.udiseCode; delete body.siteCode; delete body.blockId;
    }

    const {
      name, udiseCode, siteCode, blockId, type, hasVirtualClassroom, hasIctLab,
      address, principalName, phone, phone2,
      campusArea, campusAreaUnit, builtUpArea, numBuildings, numClassrooms,
      hasPlayground, hasBoundaryWall, hasLibrary, hasLaboratory, hasComputerLab,
      hasSmartClassroom, hasElectricity, hasInternet, hasCctv,
      hasDrinkingWater, drinkingWaterSource, numToilets, numBoysToilets, numGirlsToilets,
      hasCwsnToilet, hasHandwashing,
      classesFrom, classesTo, streams,
      hasFireSafety, hasDisasterPlan, hasFirstAid, hasSecurityGuard, emergencyContact,
      // Extended fields
      registrationNumber, email, yearEstablished, assemblyConstituency, gramPanchayat,
      managedBy, mediumOfInstruction,
      totalLand, totalLandUnit, hasGarden, landInSchoolName,
      buildingType, hasHmRoom, hasOfficeRoom, hasCommonRoom, hasComputerRoom, hasArtCraftRoom,
      hmChairs, hmTables, hmCupboards,
      officeChairs, officeTables, officeCupboards,
      commonChairs, commonTables, commonCupboards,
      classChairs, classTables, classCupboards,
      computerChairs, computerTables, computerCupboards,
      libraryChairs, libraryTables, libraryCupboards,
      artChairs, artTables, artCupboards,
      vcChairs, vcTables, vcCupboards,
      hasOverheadTank, waterQuantity, hasWaterPurifier, purifierInstallDate,
      numUsableToilets, numUnusableToilets, numStaffToilets, numCwsnToilets, numOtherToilets,
      electricityAvailability,
      numDesktopPCs, hasUPS, hasInternetConnectivity,
      numHostelStudentRooms, hostelStudentCapacity, numHostelStudents, numHostelStaffRooms, hostelStaffCapacity,
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
        ...(phone2 !== undefined && { phone2: nullStr(phone2) }),
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
        // General Info (extended)
        ...(registrationNumber !== undefined && { registrationNumber: nullStr(registrationNumber) }),
        ...(email !== undefined && { email: nullStr(email) }),
        ...(yearEstablished !== undefined && { yearEstablished: nullInt(yearEstablished) }),
        ...(assemblyConstituency !== undefined && { assemblyConstituency: nullStr(assemblyConstituency) }),
        ...(gramPanchayat !== undefined && { gramPanchayat: nullStr(gramPanchayat) }),
        ...(managedBy !== undefined && { managedBy: nullStr(managedBy) }),
        ...(mediumOfInstruction !== undefined && { mediumOfInstruction: nullStr(mediumOfInstruction) }),
        // Land Record
        ...(totalLand !== undefined && { totalLand: nullFlt(totalLand) }),
        ...(totalLandUnit !== undefined && { totalLandUnit: nullStr(totalLandUnit) }),
        ...(hasGarden !== undefined && { hasGarden: nullBool(hasGarden) }),
        ...(landInSchoolName !== undefined && { landInSchoolName: nullBool(landInSchoolName) }),
        // Building
        ...(buildingType !== undefined && { buildingType: nullStr(buildingType) }),
        ...(hasHmRoom !== undefined && { hasHmRoom: nullBool(hasHmRoom) }),
        ...(hasOfficeRoom !== undefined && { hasOfficeRoom: nullBool(hasOfficeRoom) }),
        ...(hasCommonRoom !== undefined && { hasCommonRoom: nullBool(hasCommonRoom) }),
        ...(hasComputerRoom !== undefined && { hasComputerRoom: nullBool(hasComputerRoom) }),
        ...(hasArtCraftRoom !== undefined && { hasArtCraftRoom: nullBool(hasArtCraftRoom) }),
        // Furniture
        ...(hmChairs !== undefined && { hmChairs: nullInt(hmChairs) }),
        ...(hmTables !== undefined && { hmTables: nullInt(hmTables) }),
        ...(hmCupboards !== undefined && { hmCupboards: nullInt(hmCupboards) }),
        ...(officeChairs !== undefined && { officeChairs: nullInt(officeChairs) }),
        ...(officeTables !== undefined && { officeTables: nullInt(officeTables) }),
        ...(officeCupboards !== undefined && { officeCupboards: nullInt(officeCupboards) }),
        ...(commonChairs !== undefined && { commonChairs: nullInt(commonChairs) }),
        ...(commonTables !== undefined && { commonTables: nullInt(commonTables) }),
        ...(commonCupboards !== undefined && { commonCupboards: nullInt(commonCupboards) }),
        ...(classChairs !== undefined && { classChairs: nullInt(classChairs) }),
        ...(classTables !== undefined && { classTables: nullInt(classTables) }),
        ...(classCupboards !== undefined && { classCupboards: nullInt(classCupboards) }),
        ...(computerChairs !== undefined && { computerChairs: nullInt(computerChairs) }),
        ...(computerTables !== undefined && { computerTables: nullInt(computerTables) }),
        ...(computerCupboards !== undefined && { computerCupboards: nullInt(computerCupboards) }),
        ...(libraryChairs !== undefined && { libraryChairs: nullInt(libraryChairs) }),
        ...(libraryTables !== undefined && { libraryTables: nullInt(libraryTables) }),
        ...(libraryCupboards !== undefined && { libraryCupboards: nullInt(libraryCupboards) }),
        ...(artChairs !== undefined && { artChairs: nullInt(artChairs) }),
        ...(artTables !== undefined && { artTables: nullInt(artTables) }),
        ...(artCupboards !== undefined && { artCupboards: nullInt(artCupboards) }),
        ...(vcChairs !== undefined && { vcChairs: nullInt(vcChairs) }),
        ...(vcTables !== undefined && { vcTables: nullInt(vcTables) }),
        ...(vcCupboards !== undefined && { vcCupboards: nullInt(vcCupboards) }),
        // Water (additional)
        ...(hasOverheadTank !== undefined && { hasOverheadTank: nullBool(hasOverheadTank) }),
        ...(waterQuantity !== undefined && { waterQuantity: nullFlt(waterQuantity) }),
        ...(hasWaterPurifier !== undefined && { hasWaterPurifier: nullBool(hasWaterPurifier) }),
        ...(purifierInstallDate !== undefined && { purifierInstallDate: nullStr(purifierInstallDate) }),
        // Toilets (detailed)
        ...(numUsableToilets !== undefined && { numUsableToilets: nullInt(numUsableToilets) }),
        ...(numUnusableToilets !== undefined && { numUnusableToilets: nullInt(numUnusableToilets) }),
        ...(numStaffToilets !== undefined && { numStaffToilets: nullInt(numStaffToilets) }),
        ...(numCwsnToilets !== undefined && { numCwsnToilets: nullInt(numCwsnToilets) }),
        ...(numOtherToilets !== undefined && { numOtherToilets: nullInt(numOtherToilets) }),
        // Electricity
        ...(electricityAvailability !== undefined && { electricityAvailability: nullStr(electricityAvailability) }),
        // Computer Lab
        ...(numDesktopPCs !== undefined && { numDesktopPCs: nullInt(numDesktopPCs) }),
        ...(hasUPS !== undefined && { hasUPS: nullBool(hasUPS) }),
        ...(hasInternetConnectivity !== undefined && { hasInternetConnectivity: nullBool(hasInternetConnectivity) }),
        // Hostel
        ...(numHostelStudentRooms !== undefined && { numHostelStudentRooms: nullInt(numHostelStudentRooms) }),
        ...(hostelStudentCapacity !== undefined && { hostelStudentCapacity: nullInt(hostelStudentCapacity) }),
        ...(numHostelStudents !== undefined && { numHostelStudents: nullInt(numHostelStudents) }),
        ...(numHostelStaffRooms !== undefined && { numHostelStaffRooms: nullInt(numHostelStaffRooms) }),
        ...(hostelStaffCapacity !== undefined && { hostelStaffCapacity: nullInt(hostelStaffCapacity) }),
        // Auto-track who updated profile
        profileUpdatedBy: user.name,
        profileUpdatedAt: new Date(),
      },
      include: { block: { include: { district: true } } },
    });
  }

  // ── Academic Year ───────────────────────────────────────────────────────────

  private resolveSchoolId(user: AuthUser, schoolId?: string): string {
    const sid = schoolId ?? user.schoolId;
    if (!sid) throw new ForbiddenException('School ID required');
    return sid;
  }

  async listAcademicYears(user: AuthUser) {
    const tid = user.tenantId;
    // ADMIN with no tenantId sees all years; scoped users see their tenant only
    return prisma.academicYear.findMany({
      where: tid ? { tenantId: tid } : undefined,
      orderBy: { label: 'desc' },
    });
  }

  async createAcademicYear(user: AuthUser, dto: { label: string; startDate: string; endDate: string; tenantId?: string }) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Only platform admin can create academic years');
    const tid = dto.tenantId ?? user.tenantId;
    if (!tid) throw new ForbiddenException('Tenant ID required — platform admin must supply tenantId');
    return prisma.academicYear.create({ data: { tenantId: tid, label: dto.label, startDate: dto.startDate, endDate: dto.endDate } });
  }

  async setCurrentAcademicYear(user: AuthUser, id: string) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Only platform admin can change the active year');
    const year = await prisma.academicYear.findUnique({ where: { id } });
    if (!year) throw new NotFoundException('Academic year not found');
    await prisma.academicYear.updateMany({ where: { tenantId: year.tenantId }, data: { isCurrent: false } });
    return prisma.academicYear.update({ where: { id }, data: { isCurrent: true } });
  }

  async updateAcademicYear(user: AuthUser, id: string, dto: { label?: string; startDate?: string; endDate?: string }) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Only platform admin can edit academic years');
    return prisma.academicYear.update({ where: { id }, data: { ...dto } });
  }

  async deleteAcademicYear(user: AuthUser, id: string) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Only platform admin can delete academic years');
    await prisma.academicYear.delete({ where: { id } });
    return { ok: true };
  }

  // ── Class Section ────────────────────────────────────────────────────────────

  async listClassSections(user: AuthUser, schoolId?: string, academicYear?: string) {
    const sid = this.resolveSchoolId(user, schoolId);
    return prisma.classSection.findMany({
      where: { schoolId: sid, ...(academicYear ? { academicYear } : {}) },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }],
      include: { subjectAssignments: { include: { subject: true } } },
    });
  }

  async createClassSection(user: AuthUser, dto: {
    grade: number; section: string; academicYear: string;
    classTeacherId?: string; capacity?: number; stream?: string; schoolId?: string;
  }) {
    const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'PRINCIPAL'];
    if (!WRITE_ROLES.includes(user.role)) throw new ForbiddenException('Not authorized');
    const sid = this.resolveSchoolId(user, dto.schoolId);
    return prisma.classSection.create({
      data: { schoolId: sid, grade: dto.grade, section: dto.section, academicYear: dto.academicYear, classTeacherId: dto.classTeacherId, capacity: dto.capacity, stream: dto.stream },
    });
  }

  async bulkCreateClassSections(user: AuthUser, dto: {
    schoolId?: string; districtId?: string; blockId?: string;
    academicYear: string; gradeFrom: number; gradeTo: number;
    sections: string[]; capacity?: number;
  }) {
    const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'PRINCIPAL'];
    if (!WRITE_ROLES.includes(user.role)) throw new ForbiddenException('Not authorized');

    const grades = Array.from({ length: dto.gradeTo - dto.gradeFrom + 1 }, (_, i) => dto.gradeFrom + i);

    // Resolve which schools to create sections for
    let schoolIds: string[];
    if (dto.schoolId || user.role === 'PRINCIPAL') {
      // Specific school (or principal always scoped to their own school)
      schoolIds = [this.resolveSchoolId(user, dto.schoolId)];
    } else {
      // District/block/state level — find all matching schools
      const tenantId = user.tenantId;
      const where: any = {};
      if (tenantId) where.block = { district: { tenantId } };
      if (dto.districtId) where.block = { ...(where.block ?? {}), districtId: dto.districtId };
      if (dto.blockId) where.blockId = dto.blockId;
      const schools = await prisma.school.findMany({ where, select: { id: true } });
      schoolIds = schools.map(s => s.id);
    }

    if (schoolIds.length === 0) return { created: 0, skipped: 0, schools: 0 };

    // Get all existing sections for these schools in this academic year
    const existing = await prisma.classSection.findMany({
      where: { schoolId: { in: schoolIds }, academicYear: dto.academicYear },
      select: { schoolId: true, grade: true, section: true },
    });
    const existSet = new Set(existing.map(e => `${e.schoolId}|${e.grade}|${e.section}`));

    const toCreate: { schoolId: string; grade: number; section: string; academicYear: string; capacity?: number }[] = [];
    for (const sid of schoolIds) {
      for (const grade of grades) {
        for (const section of dto.sections) {
          if (!existSet.has(`${sid}|${grade}|${section}`)) {
            toCreate.push({ schoolId: sid, grade, section, academicYear: dto.academicYear, capacity: dto.capacity });
          }
        }
      }
    }

    if (toCreate.length === 0) return { created: 0, skipped: schoolIds.length * grades.length * dto.sections.length, schools: schoolIds.length };
    await prisma.classSection.createMany({ data: toCreate });
    return { created: toCreate.length, skipped: (schoolIds.length * grades.length * dto.sections.length) - toCreate.length, schools: schoolIds.length };
  }

  async updateClassSection(user: AuthUser, id: string, dto: any) {
    if (!['ADMIN', 'STATE_OFFICIAL', 'PRINCIPAL'].includes(user.role)) throw new ForbiddenException('Not authorized');
    return prisma.classSection.update({ where: { id }, data: dto });
  }

  async deleteClassSection(user: AuthUser, id: string) {
    if (!['ADMIN', 'PRINCIPAL'].includes(user.role)) throw new ForbiddenException('Not authorized');
    await prisma.classSection.delete({ where: { id } });
    return { ok: true };
  }

  // ── Subject Master ───────────────────────────────────────────────────────────

  async listSubjects(user: AuthUser, tenantId?: string) {
    const tid = tenantId ?? user.tenantId;
    return prisma.subject.findMany({
      where: { ...(tid ? { tenantId: tid } : {}), isActive: true },
      orderBy: [{ stream: 'asc' }, { grade: 'asc' }, { name: 'asc' }],
    });
  }

  async createSubject(user: AuthUser, dto: {
    name: string; code?: string; grade?: number; stream?: string;
    maxMarks?: number; isElective?: boolean; tenantId?: string;
  }) {
    if (!['ADMIN', 'PRINCIPAL'].includes(user.role)) throw new ForbiddenException('Only admin or principal can manage subjects');
    const tid = dto.tenantId ?? user.tenantId;
    if (!tid) throw new ForbiddenException('Tenant ID required');
    return prisma.subject.create({
      data: { tenantId: tid, name: dto.name, code: dto.code, grade: dto.grade, stream: dto.stream ?? '', maxMarks: dto.maxMarks ?? 100, isElective: dto.isElective ?? false },
    });
  }

  async bulkCreateSubjects(user: AuthUser, dto: { tenantId?: string; subjects: { name: string; code?: string; grade?: number; stream?: string; maxMarks?: number; isElective?: boolean }[] }) {
    if (!['ADMIN', 'PRINCIPAL'].includes(user.role)) throw new ForbiddenException('Only admin or principal can manage subjects');
    const tid = dto.tenantId ?? user.tenantId;
    if (!tid) throw new ForbiddenException('Tenant ID required');
    const existing = await prisma.subject.findMany({ where: { tenantId: tid }, select: { name: true, grade: true } });
    const existSet = new Set(existing.map(e => `${e.name}|${e.grade ?? ''}`));
    // Deduplicate input by (name, grade) — the DB unique constraint — keeping first match
    const seen = new Set<string>();
    const toCreate = dto.subjects.filter(s => {
      const key = `${s.name}|${s.grade ?? ''}`;
      if (existSet.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (toCreate.length === 0) return { created: 0, skipped: dto.subjects.length };
    await prisma.subject.createMany({
      data: toCreate.map(s => ({ tenantId: tid!, name: s.name, code: s.code, grade: s.grade, stream: s.stream ?? '', maxMarks: s.maxMarks ?? 100, isElective: s.isElective ?? false })),
    });
    return { created: toCreate.length, skipped: dto.subjects.length - toCreate.length };
  }

  async updateSubject(user: AuthUser, id: string, dto: any) {
    if (!['ADMIN', 'PRINCIPAL'].includes(user.role)) throw new ForbiddenException('Only admin or principal can manage subjects');
    return prisma.subject.update({ where: { id }, data: dto });
  }

  async deleteSubject(user: AuthUser, id: string) {
    if (!['ADMIN', 'PRINCIPAL'].includes(user.role)) throw new ForbiddenException('Only admin or principal can manage subjects');
    return prisma.subject.update({ where: { id }, data: { isActive: false } });
  }

  // ── Subject Assignment ───────────────────────────────────────────────────────

  async listAssignments(user: AuthUser, classSectionId: string) {
    return prisma.subjectAssignment.findMany({
      where: { classSectionId },
      include: { subject: true },
    });
  }

  async createAssignment(user: AuthUser, dto: { staffId: string; classSectionId: string; subjectId: string; academicYear: string }) {
    if (!['ADMIN', 'STATE_OFFICIAL', 'PRINCIPAL'].includes(user.role)) throw new ForbiddenException('Not authorized');
    return prisma.subjectAssignment.create({ data: dto });
  }

  async deleteAssignment(user: AuthUser, id: string) {
    if (!['ADMIN', 'PRINCIPAL'].includes(user.role)) throw new ForbiddenException('Not authorized');
    await prisma.subjectAssignment.delete({ where: { id } });
    return { ok: true };
  }
}
