import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { prisma } from '@edubeam/db';
import { ACADEMIC_YEAR, type AuthUser, type StudentDemographics } from '@edubeam/shared';
import { schoolScope } from '../analytics/scope';
import { assertCanWrite, resolveWritableSchool } from './people.scope';

const IS_POSTGRES = process.env.DATABASE_URL?.startsWith('postgresql') ?? false;

interface StudentInput {
  schoolId?: string;
  name: string;
  gender?: string;
  dateOfBirth?: string | null;
  grade: number;
  section?: string | null;
  rollNo?: string | null;
  admissionNo?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianRelation?: string | null;
  address?: string | null;
  category?: string;
  religion?: string | null;
  isRte?: boolean;
  bankAccount?: string | null;
  healthNotes?: string | null;
  isDropout?: boolean;
  dropoutReason?: string | null;
  // Extended profile
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  bloodGroup?: string | null;
  aadhaarNo?: string | null;
  nationality?: string | null;
  motherTongue?: string | null;
  photoUrl?: string | null;
  admissionDate?: string | null;
  admissionClass?: number | null;
  house?: string | null;
  admissionType?: string | null;
  fatherName?: string | null;
  fatherPhone?: string | null;
  fatherOccupation?: string | null;
  fatherEducation?: string | null;
  motherName?: string | null;
  motherPhone?: string | null;
  motherOccupation?: string | null;
  motherEducation?: string | null;
  stateAddr?: string | null;
  districtAddr?: string | null;
  blockAddr?: string | null;
  village?: string | null;
  permanentAddress?: string | null;
  correspondenceAddress?: string | null;
  pinCode?: string | null;
  previousSchool?: string | null;
  previousClass?: number | null;
  tcNumber?: string | null;
  medium?: string | null;
  subjectsOpted?: string | null;
  promotionStatus?: string | null;
  cgpa?: number | null;
  height?: number | null;
  weight?: number | null;
  cwsnStatus?: boolean | null;
  vaccinationStatus?: string | null;
  healthCheckupDate?: string | null;
  hostelRequired?: boolean | null;
  hostelName?: string | null;
  roomNumber?: string | null;
  hostelFeeStatus?: string | null;
  docAadhaar?: string | null;
  docBirthCert?: string | null;
  docTc?: string | null;
  docCaste?: string | null;
  docIncome?: string | null;
  docResidence?: string | null;
  docPhoto?: string | null;
  docMedical?: string | null;
  docOther?: string | null;
}

const toDate = (v?: string | null) => (v ? new Date(v) : null);

@Injectable()
export class StudentsService {
  /** Build the school where-filter for the caller, scoped + optional district/block/school. */
  private async studentWhere(
    user: AuthUser,
    opts: { districtId?: string; blockId?: string; schoolId?: string },
  ) {
    const { schoolWhere } = schoolScope(user, opts.districtId);
    const school: Record<string, unknown> = { ...schoolWhere };
    if (opts.blockId) school.blockId = opts.blockId;
    if (opts.schoolId) school.id = opts.schoolId;
    return { school: school as object };
  }

  async list(
    user: AuthUser,
    opts: { districtId?: string; blockId?: string; schoolId?: string; grade?: number; gender?: string; q?: string; rte?: boolean; dropout?: boolean },
  ) {
    const where = await this.studentWhere(user, opts);
    const students = await prisma.student.findMany({
      where: {
        ...where,
        ...(opts.grade ? { grade: opts.grade } : {}),
        ...(opts.gender ? { gender: opts.gender } : {}),
        ...(opts.rte !== undefined ? { isRte: opts.rte } : {}),
        ...(opts.dropout !== undefined ? { isDropout: opts.dropout } : {}),
        ...(opts.q ? { name: { contains: opts.q, ...(IS_POSTGRES ? { mode: 'insensitive' as const } : {}) } } : {}),
      },
      include: { school: { select: { name: true } } },
      orderBy: [{ grade: 'asc' }, { name: 'asc' }],
      take: 1000,
    });
    return students.map((s) => ({ ...s, school: s.school?.name ?? null }));
  }

  async summary(
    user: AuthUser,
    opts: { districtId?: string; blockId?: string; schoolId?: string },
  ): Promise<StudentDemographics> {
    const where = await this.studentWhere(user, opts);
    const rows = await prisma.student.findMany({
      where,
      select: { gender: true, grade: true, category: true, religion: true, isRte: true, isDropout: true },
      take: 100000,
    });
    const byGrade = new Map<number, number>();
    const byCategory = new Map<string, number>();
    const byReligion = new Map<string, number>();
    let boys = 0, girls = 0, rte = 0, dropouts = 0;
    for (const r of rows) {
      if (r.gender === 'M') boys++;
      else if (r.gender === 'F') girls++;
      if (r.isRte) rte++;
      if (r.isDropout) dropouts++;
      byGrade.set(r.grade, (byGrade.get(r.grade) ?? 0) + 1);
      byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
      const rel = r.religion ?? 'Unknown';
      byReligion.set(rel, (byReligion.get(rel) ?? 0) + 1);
    }
    return {
      total: rows.length,
      boys,
      girls,
      rte,
      dropouts,
      byGrade: [...byGrade.entries()].sort((a, b) => a[0] - b[0]).map(([grade, count]) => ({ grade, count })),
      byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count })),
      byReligion: [...byReligion.entries()].sort((a, b) => b[1] - a[1]).map(([religion, count]) => ({ religion, count })),
    };
  }

  async create(user: AuthUser, dto: StudentInput) {
    assertCanWrite(user);
    if (!dto.name?.trim()) throw new BadRequestException('Name is required');
    if (!dto.grade) throw new BadRequestException('Grade is required');
    const schoolId = await resolveWritableSchool(user, dto.schoolId);
    const s = await prisma.student.create({
      data: {
        schoolId,
        name: dto.name.trim(),
        gender: dto.gender ?? 'M',
        dateOfBirth: toDate(dto.dateOfBirth),
        grade: Number(dto.grade),
        section: dto.section ?? null,
        rollNo: dto.rollNo ?? null,
        admissionNo: dto.admissionNo ?? null,
        guardianName: dto.guardianName ?? null,
        guardianPhone: dto.guardianPhone ?? null,
        guardianRelation: dto.guardianRelation ?? null,
        address: dto.address ?? null,
        category: dto.category ?? 'GEN',
        religion: dto.religion ?? null,
        isRte: dto.isRte ?? false,
        bankAccount: dto.bankAccount ?? null,
        healthNotes: dto.healthNotes ?? null,
        isDropout: dto.isDropout ?? false,
        dropoutReason: dto.dropoutReason ?? null,
        academicYear: ACADEMIC_YEAR,
      },
    });
    const credentials = await this.provisionLogins(user, s);
    return { id: s.id, ...credentials };
  }

  /** Create or reset student + parent logins simultaneously. */
  private async provisionLogins(
    admin: AuthUser,
    student: { id: string; name: string; schoolId: string; admissionNo: string | null; rollNo: string | null },
  ) {
    const key = (student.admissionNo || student.rollNo || student.id)
      .replace(/\s+/g, '').toLowerCase();

    const stuPass = `st${key}`;
    const stuEmail = `${stuPass}@edubeam.com`;
    await prisma.user.upsert({
      where: { email: stuEmail },
      create: {
        id: `ustu_${key}`,
        email: stuEmail,
        name: student.name,
        role: 'STUDENT',
        tenantId: admin.tenantId!,
        schoolId: student.schoolId,
        studentId: student.id,
        passwordHash: await bcrypt.hash(stuPass, 10),
      },
      update: { passwordHash: await bcrypt.hash(stuPass, 10), studentId: student.id, name: student.name },
    });

    const parPass = `pr${key}`;
    const parEmail = `${parPass}@edubeam.com`;
    await prisma.user.upsert({
      where: { email: parEmail },
      create: {
        id: `upar_${key}`,
        email: parEmail,
        name: `Parent — ${student.name}`,
        role: 'PARENT',
        tenantId: admin.tenantId!,
        schoolId: student.schoolId,
        linkedStudentIds: student.id,
        passwordHash: await bcrypt.hash(parPass, 10),
      },
      update: { passwordHash: await bcrypt.hash(parPass, 10), linkedStudentIds: student.id, name: `Parent — ${student.name}` },
    });

    return {
      studentLogin: { email: stuEmail, password: stuPass },
      parentLogin: { email: parEmail, password: parPass },
    };
  }

  /** Bulk insert from a parsed upload (tender §6.2.8.3). Rows missing name/grade are skipped. */
  async bulkCreate(user: AuthUser, schoolId: string | undefined, rows: StudentInput[]) {
    assertCanWrite(user);
    if (!Array.isArray(rows) || rows.length === 0) throw new BadRequestException('No rows provided');
    const resolved = await resolveWritableSchool(user, schoolId);
    const data = rows
      .filter((r) => r.name?.trim() && r.grade)
      .map((r) => ({
        schoolId: resolved,
        name: String(r.name).trim(),
        gender: r.gender ?? 'M',
        grade: Number(r.grade),
        section: r.section ?? null,
        rollNo: r.rollNo ?? null,
        admissionNo: r.admissionNo ?? null,
        guardianName: r.guardianName ?? null,
        guardianPhone: r.guardianPhone ?? null,
        guardianRelation: r.guardianRelation ?? null,
        category: r.category ?? 'GEN',
        religion: r.religion ?? null,
        isRte: r.isRte ?? false,
        academicYear: ACADEMIC_YEAR,
      }));
    if (!data.length) throw new BadRequestException('No valid rows (each needs name and grade)');
    for (let i = 0; i < data.length; i += 500) {
      await prisma.student.createMany({ data: data.slice(i, i + 500) });
    }
    return { inserted: data.length, skipped: rows.length - data.length };
  }

  private async findInScope(user: AuthUser, id: string) {
    const { schoolWhere } = schoolScope(user);
    const s = await prisma.student.findFirst({ where: { id, school: schoolWhere }, select: { id: true } });
    if (!s) throw new NotFoundException('Student not found in your scope');
  }

  async update(user: AuthUser, id: string, dto: Partial<StudentInput>) {
    assertCanWrite(user);
    await this.findInScope(user, id);

    const nullBool = (v?: boolean | null) => v === undefined ? undefined : (v ?? null);
    const nullInt  = (v?: number | null)  => v === undefined ? undefined : (v !== null ? Number(v) : null);
    const nullFlt  = (v?: number | null)  => v === undefined ? undefined : (v !== null ? parseFloat(String(v)) : null);
    const nullStr  = (v?: string | null)  => v === undefined ? undefined : (v?.trim() || null);

    const updated = await prisma.student.update({
      where: { id },
      data: {
        // Core
        name: dto.name?.trim(),
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth !== undefined ? toDate(dto.dateOfBirth) : undefined,
        grade: dto.grade !== undefined ? Number(dto.grade) : undefined,
        section: dto.section,
        rollNo: dto.rollNo,
        admissionNo: dto.admissionNo,
        guardianName: dto.guardianName,
        guardianPhone: dto.guardianPhone,
        guardianRelation: dto.guardianRelation,
        address: dto.address,
        category: dto.category,
        religion: dto.religion,
        isRte: dto.isRte,
        bankAccount: dto.bankAccount,
        healthNotes: dto.healthNotes,
        isDropout: dto.isDropout,
        dropoutReason: dto.dropoutReason,
        // Basic Info extras
        firstName:      nullStr(dto.firstName),
        middleName:     nullStr(dto.middleName),
        lastName:       nullStr(dto.lastName),
        bloodGroup:     nullStr(dto.bloodGroup),
        aadhaarNo:      nullStr(dto.aadhaarNo),
        nationality:    nullStr(dto.nationality),
        motherTongue:   nullStr(dto.motherTongue),
        photoUrl:       nullStr(dto.photoUrl),
        admissionDate:  dto.admissionDate  !== undefined ? toDate(dto.admissionDate)  : undefined,
        admissionClass: nullInt(dto.admissionClass),
        house:          nullStr(dto.house),
        admissionType:  nullStr(dto.admissionType),
        // Family
        fatherName:       nullStr(dto.fatherName),
        fatherPhone:      nullStr(dto.fatherPhone),
        fatherOccupation: nullStr(dto.fatherOccupation),
        fatherEducation:  nullStr(dto.fatherEducation),
        motherName:       nullStr(dto.motherName),
        motherPhone:      nullStr(dto.motherPhone),
        motherOccupation: nullStr(dto.motherOccupation),
        motherEducation:  nullStr(dto.motherEducation),
        // Address
        stateAddr:             nullStr(dto.stateAddr),
        districtAddr:          nullStr(dto.districtAddr),
        blockAddr:             nullStr(dto.blockAddr),
        village:               nullStr(dto.village),
        permanentAddress:      nullStr(dto.permanentAddress),
        correspondenceAddress: nullStr(dto.correspondenceAddress),
        pinCode:               nullStr(dto.pinCode),
        // Academic
        previousSchool:  nullStr(dto.previousSchool),
        previousClass:   nullInt(dto.previousClass),
        tcNumber:        nullStr(dto.tcNumber),
        medium:          nullStr(dto.medium),
        subjectsOpted:   nullStr(dto.subjectsOpted),
        promotionStatus: nullStr(dto.promotionStatus),
        cgpa:            nullFlt(dto.cgpa),
        // Health
        height:            nullFlt(dto.height),
        weight:            nullFlt(dto.weight),
        cwsnStatus:        nullBool(dto.cwsnStatus),
        vaccinationStatus: nullStr(dto.vaccinationStatus),
        healthCheckupDate: dto.healthCheckupDate !== undefined ? toDate(dto.healthCheckupDate) : undefined,
        // Hostel
        hostelRequired:  nullBool(dto.hostelRequired),
        hostelName:      nullStr(dto.hostelName),
        roomNumber:      nullStr(dto.roomNumber),
        hostelFeeStatus: nullStr(dto.hostelFeeStatus),
        // Documents
        docAadhaar:   nullStr(dto.docAadhaar),
        docBirthCert: nullStr(dto.docBirthCert),
        docTc:        nullStr(dto.docTc),
        docCaste:     nullStr(dto.docCaste),
        docIncome:    nullStr(dto.docIncome),
        docResidence: nullStr(dto.docResidence),
        docPhoto:     nullStr(dto.docPhoto),
        docMedical:   nullStr(dto.docMedical),
        docOther:     nullStr(dto.docOther),
        // Profile tracking
        profileUpdatedAt: new Date(),
        profileUpdatedBy: user.name,
      },
    });
    if (dto.name?.trim()) {
      const newName = updated.name;
      await prisma.user.updateMany({ where: { studentId: id }, data: { name: newName } });
      await prisma.user.updateMany({ where: { linkedStudentIds: id, role: 'PARENT' }, data: { name: `Parent — ${newName}` } });
    }
    return { ok: true };
  }

  async remove(user: AuthUser, id: string) {
    assertCanWrite(user);
    await this.findInScope(user, id);
    await prisma.student.delete({ where: { id } });
    return { ok: true };
  }

  /** Promote non-dropout students one grade up; grade 12 graduates (deactivated). Tender §6.2.8.15.
   *  Optional `grade` narrows to a single class (e.g. promote only Class 10). */
  async promote(user: AuthUser, schoolId?: string, grade?: number) {
    assertCanWrite(user);
    const resolved = await resolveWritableSchool(user, schoolId);
    const gradeFilter = grade ? { equals: grade } : { gte: 12 };
    const graduated = await prisma.student.updateMany({
      where: { schoolId: resolved, isDropout: false, grade: grade ? { equals: grade, gte: 12 } : { gte: 12 } },
      data: { active: false },
    });
    const promoted = await prisma.student.updateMany({
      where: {
        schoolId: resolved, isDropout: false, active: true,
        grade: grade ? { equals: grade, lt: 12 } : { lt: 12 },
      },
      data: { grade: { increment: 1 } },
    });
    return { promoted: promoted.count, graduated: graduated.count };
  }
}
