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
    const updated = await prisma.student.update({
      where: { id },
      data: {
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
      },
    });
    // Keep linked User records in sync when the student's name changes
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

  /** Promote all non-dropout students one grade up; grade 12 graduates (deactivated). Tender §6.2.8.15. */
  async promote(user: AuthUser, schoolId?: string) {
    assertCanWrite(user);
    const resolved = await resolveWritableSchool(user, schoolId);
    const graduated = await prisma.student.updateMany({
      where: { schoolId: resolved, isDropout: false, grade: { gte: 12 } },
      data: { active: false },
    });
    const promoted = await prisma.student.updateMany({
      where: { schoolId: resolved, isDropout: false, active: true, grade: { lt: 12 } },
      data: { grade: { increment: 1 } },
    });
    return { promoted: promoted.count, graduated: graduated.count };
  }
}
