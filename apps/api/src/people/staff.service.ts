import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@edubeam/db';
import { ACADEMIC_YEAR, type AuthUser, type StaffDemographics } from '@edubeam/shared';
import { schoolScope } from '../analytics/scope';
import { assertCanWrite, resolveWritableSchool } from './people.scope';

interface StaffInput {
  schoolId?: string;
  name: string;
  gender?: string;
  dateOfBirth?: string | null;
  staffType?: string;
  designation?: string | null;
  qualification?: string | null;
  subjects?: string | null;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  salaryGroup?: string | null;
  joiningDate?: string | null;
  employeeId?: string | null;
  isClassTeacher?: boolean;
  classTeacherOf?: string | null;
  active?: boolean;
  // Extended profile
  photoUrl?: string | null;
  bloodGroup?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;
  category?: string | null;
  religion?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  altPhone?: string | null;
  aadhaarNo?: string | null;
  panNo?: string | null;
  identificationMark?: string | null;
  disabilityDetails?: string | null;
  employeeType?: string | null;
  presentAddress?: string | null;
  permanentAddress?: string | null;
  pinCode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
}

const EXTENDED_FIELDS = [
  'photoUrl', 'bloodGroup', 'maritalStatus', 'nationality', 'category', 'religion',
  'fatherName', 'motherName', 'altPhone', 'aadhaarNo', 'panNo',
  'identificationMark', 'disabilityDetails', 'employeeType',
  'presentAddress', 'permanentAddress', 'pinCode',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
] as const;

const toDate = (v?: string | null) => (v ? new Date(v) : null);

@Injectable()
export class StaffService {
  private async staffWhere(user: AuthUser, opts: { districtId?: string; blockId?: string; schoolId?: string }) {
    const { schoolWhere } = schoolScope(user, opts.districtId);
    const school: Record<string, unknown> = { ...schoolWhere };
    if (opts.blockId) school.blockId = opts.blockId;
    if (opts.schoolId) school.id = opts.schoolId;
    return { school: school as object };
  }

  async list(
    user: AuthUser,
    opts: { districtId?: string; blockId?: string; schoolId?: string; staffType?: string; q?: string },
  ) {
    const where = await this.staffWhere(user, opts);
    const staff = await prisma.staff.findMany({
      where: {
        ...where,
        ...(opts.staffType ? { staffType: opts.staffType } : {}),
        ...(opts.q ? { name: { contains: opts.q } } : {}),
      },
      include: { school: { select: { name: true } } },
      orderBy: [{ staffType: 'asc' }, { name: 'asc' }],
      take: 1000,
    });
    return staff.map((s) => ({ ...s, school: s.school?.name ?? null }));
  }

  async summary(user: AuthUser, opts: { districtId?: string; blockId?: string; schoolId?: string }): Promise<StaffDemographics> {
    const where = await this.staffWhere(user, opts);
    const rows = await prisma.staff.findMany({
      where,
      select: { staffType: true, qualification: true, isClassTeacher: true },
      take: 100000,
    });
    const byType = new Map<string, number>();
    const byQual = new Map<string, number>();
    let classTeachers = 0;
    for (const r of rows) {
      byType.set(r.staffType, (byType.get(r.staffType) ?? 0) + 1);
      const q = r.qualification ?? 'Unspecified';
      byQual.set(q, (byQual.get(q) ?? 0) + 1);
      if (r.isClassTeacher) classTeachers++;
    }
    return {
      total: rows.length,
      classTeachers,
      byType: [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([staffType, count]) => ({ staffType, count })),
      byQualification: [...byQual.entries()].sort((a, b) => b[1] - a[1]).map(([qualification, count]) => ({ qualification, count })),
    };
  }

  async create(user: AuthUser, dto: StaffInput) {
    assertCanWrite(user);
    if (!dto.name?.trim()) throw new BadRequestException('Name is required');
    const schoolId = await resolveWritableSchool(user, dto.schoolId);
    const extended = Object.fromEntries(
      EXTENDED_FIELDS.map((k) => [k, dto[k] ?? null]),
    );
    const s = await prisma.staff.create({
      data: {
        schoolId,
        name: dto.name.trim(),
        gender: dto.gender ?? 'M',
        dateOfBirth: toDate(dto.dateOfBirth),
        staffType: dto.staffType ?? 'TEACHER',
        designation: dto.designation ?? null,
        qualification: dto.qualification ?? null,
        subjects: dto.subjects ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        department: dto.department ?? null,
        salaryGroup: dto.salaryGroup ?? null,
        joiningDate: toDate(dto.joiningDate),
        employeeId: dto.employeeId ?? null,
        isClassTeacher: dto.isClassTeacher ?? false,
        classTeacherOf: dto.classTeacherOf ?? null,
        active: dto.active ?? true,
        academicYear: ACADEMIC_YEAR,
        ...extended,
        profileUpdatedBy: user.name,
        profileUpdatedAt: new Date(),
      },
    });
    return { id: s.id };
  }

  async bulkCreate(user: AuthUser, schoolId: string | undefined, rows: StaffInput[]) {
    assertCanWrite(user);
    if (!Array.isArray(rows) || rows.length === 0) throw new BadRequestException('No rows provided');
    const resolved = await resolveWritableSchool(user, schoolId);
    const data = rows
      .filter((r) => r.name?.trim())
      .map((r) => ({
        schoolId: resolved,
        name: String(r.name).trim(),
        gender: r.gender ?? 'M',
        staffType: r.staffType ?? 'TEACHER',
        designation: r.designation ?? null,
        qualification: r.qualification ?? null,
        subjects: r.subjects ?? null,
        phone: r.phone ?? null,
        email: r.email ?? null,
        department: r.department ?? null,
        salaryGroup: r.salaryGroup ?? null,
        employeeId: r.employeeId ?? null,
        dateOfBirth: toDate(r.dateOfBirth),
        joiningDate: toDate(r.joiningDate),
        isClassTeacher: r.isClassTeacher ?? false,
        classTeacherOf: r.classTeacherOf ?? null,
        aadhaarNo: r.aadhaarNo ?? null,
        employeeType: (r as any).contractType ?? r.employeeType ?? null,
        presentAddress: (r as any).address ?? r.presentAddress ?? null,
        academicYear: ACADEMIC_YEAR,
      }));
    if (!data.length) throw new BadRequestException('No valid rows (each needs a name)');
    for (let i = 0; i < data.length; i += 500) {
      await prisma.staff.createMany({ data: data.slice(i, i + 500) });
    }
    return { inserted: data.length, skipped: rows.length - data.length };
  }

  private async findInScope(user: AuthUser, id: string) {
    const { schoolWhere } = schoolScope(user);
    const s = await prisma.staff.findFirst({ where: { id, school: schoolWhere }, select: { id: true } });
    if (!s) throw new NotFoundException('Staff member not found in your scope');
  }

  async update(user: AuthUser, id: string, dto: Partial<StaffInput>) {
    assertCanWrite(user);
    await this.findInScope(user, id);
    const extended = Object.fromEntries(
      EXTENDED_FIELDS.filter((k) => dto[k] !== undefined).map((k) => [k, dto[k]]),
    );
    await prisma.staff.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth !== undefined ? toDate(dto.dateOfBirth) : undefined,
        staffType: dto.staffType,
        designation: dto.designation,
        qualification: dto.qualification,
        subjects: dto.subjects,
        phone: dto.phone,
        email: dto.email,
        department: dto.department,
        salaryGroup: dto.salaryGroup,
        joiningDate: dto.joiningDate !== undefined ? toDate(dto.joiningDate) : undefined,
        employeeId: dto.employeeId,
        isClassTeacher: dto.isClassTeacher,
        classTeacherOf: dto.classTeacherOf,
        active: dto.active,
        ...extended,
        profileUpdatedBy: user.name,
        profileUpdatedAt: new Date(),
      },
    });
    return { ok: true };
  }

  async remove(user: AuthUser, id: string) {
    assertCanWrite(user);
    await this.findInScope(user, id);
    await prisma.staff.delete({ where: { id } });
    return { ok: true };
  }
}
