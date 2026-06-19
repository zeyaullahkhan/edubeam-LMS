import { Injectable } from '@nestjs/common';
import { prisma } from '@edubeam/db';
import type {
  AttendancePoint,
  AttendanceSeries,
  AuthUser,
  DistrictSummary,
  EnrollmentDemographics,
  SubjectAverage,
  TeacherStats,
} from '@edubeam/shared';
import { districtScope, schoolScope } from './scope';

// Small seeded RNG so sample attendance is deterministic and scope-scaled
// (the same scope always yields the same calendar, but each scope differs).
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Injectable()
export class AnalyticsService {
  /** Top-line totals for the user's scope (state/district/school). */
  async overview(user: AuthUser) {
    const { schoolWhere } = schoolScope(user);
    const dWhere = districtScope(user);
    const [schools, vc, ict, students, p10, p12, totalDistricts, totalBlocks] = await Promise.all([
      prisma.school.count({ where: schoolWhere }),
      prisma.school.count({ where: { ...schoolWhere, hasVirtualClassroom: true } }),
      prisma.school.count({ where: { ...schoolWhere, hasIctLab: true } }),
      prisma.enrollment.aggregate({ _sum: { total: true }, where: { school: schoolWhere } }),
      prisma.boardResult.aggregate({ _avg: { passPct: true }, where: { examType: '10TH', school: schoolWhere } }),
      prisma.boardResult.aggregate({ _avg: { passPct: true }, where: { examType: '12TH', school: schoolWhere } }),
      prisma.district.count({ where: dWhere }),
      prisma.block.count({ where: { district: dWhere } }),
    ]);
    return {
      schools,
      virtualClassroomSchools: vc,
      ictLabSchools: ict,
      totalStudents: students._sum.total ?? 0,
      avgPass10th: p10._avg.passPct,
      avgPass12th: p12._avg.passPct,
      totalDistricts,
      totalBlocks,
    };
  }

  /** One summary row per district in scope. */
  async districtSummaries(user: AuthUser): Promise<DistrictSummary[]> {
    const districts = await prisma.district.findMany({
      where: districtScope(user),
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      districts.map(async (d) => {
        const where = { block: { districtId: d.id } };
        const [schools, vc, ict, students, p10, p12, ictTeachers] = await Promise.all([
          prisma.school.count({ where }),
          prisma.school.count({ where: { ...where, hasVirtualClassroom: true } }),
          prisma.school.count({ where: { ...where, hasIctLab: true } }),
          prisma.enrollment.aggregate({ _sum: { total: true, boys: true, girls: true }, where: { school: where } }),
          prisma.boardResult.aggregate({ _avg: { passPct: true }, where: { examType: '10TH', school: where } }),
          prisma.boardResult.aggregate({ _avg: { passPct: true }, where: { examType: '12TH', school: where } }),
          prisma.ictDeployment.aggregate({ _sum: { teacherCount: true }, where: { school: where } }),
        ]);
        return {
          districtId: d.id,
          district: d.name,
          schools,
          virtualClassroomSchools: vc,
          ictLabSchools: ict,
          totalStudents: students._sum.total ?? 0,
          boys: students._sum.boys ?? 0,
          girls: students._sum.girls ?? 0,
          teachers: ictTeachers._sum.teacherCount ?? 0,
          avgPass10th: p10._avg.passPct,
          avgPass12th: p12._avg.passPct,
        };
      }),
    );
  }

  /** Boys/girls enrolment totals + class-wise split, from the Virtual Classroom
   * enrolment data (500 Virtual2526.xlsx), within the caller's scope. */
  async enrollmentDemographics(user: AuthUser): Promise<EnrollmentDemographics> {
    const { schoolWhere } = schoolScope(user);
    const grouped = await prisma.enrollment.groupBy({
      by: ['grade'],
      where: { school: schoolWhere },
      _sum: { boys: true, girls: true },
    });
    const byGrade = grouped
      .map((g) => ({ grade: g.grade, boys: g._sum.boys ?? 0, girls: g._sum.girls ?? 0 }))
      .sort((a, b) => a.grade - b.grade);
    const boys = byGrade.reduce((s, g) => s + g.boys, 0);
    const girls = byGrade.reduce((s, g) => s + g.girls, 0);
    return { boys, girls, total: boys + girls, byGrade };
  }

  /** Attendance calendar (by month or by day) for the caller's scope. Sample,
   * deterministic per scope; totals anchored to real enrolment. Sundays + a few
   * fixed dates are treated as holidays in the by-day view. */
  async attendance(
    user: AuthUser,
    period: 'month' | 'day',
    monthParam?: number,
    yearParam?: number,
  ): Promise<AttendanceSeries> {
    const { schoolWhere } = schoolScope(user);
    const agg = await prisma.enrollment.aggregate({ _sum: { total: true }, where: { school: schoolWhere } });
    const total = agg._sum.total ?? 0;
    const scopeKey = user.schoolId ?? user.districtId ?? user.tenantId ?? 'state';
    const points: AttendancePoint[] = [];

    if (period === 'month') {
      const rnd = mulberry32(hashStr(`${scopeKey}|month`));
      for (let i = 0; i < 12; i++) {
        // Summer vacation (May/Jun) and peak winter (Dec/Jan) dip a little.
        const seasonal = i === 4 || i === 5 ? -0.06 : i === 11 || i === 0 ? -0.03 : 0;
        const pct = clamp(0.88 + (rnd() - 0.5) * 0.1 + seasonal, 0.7, 0.97);
        points.push({ label: MONTHS[i], attendancePct: pct, present: Math.round(total * pct), total, isHoliday: false });
      }
    } else {
      const now = new Date();
      const year = yearParam ?? now.getFullYear();
      const month = monthParam ?? now.getMonth();
      // Seed includes month+year so each calendar month has its own deterministic data.
      const rnd = mulberry32(hashStr(`${scopeKey}|day|${year}-${month}`));
      const days = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const dow = new Date(year, month, d).getDay();
        const holiday = dow === 0; // Sundays off
        if (holiday) {
          points.push({ label: String(d), attendancePct: null, present: 0, total, isHoliday: true });
          continue;
        }
        const pct = clamp(0.88 + (rnd() - 0.5) * 0.14, 0.6, 0.98);
        points.push({ label: String(d), attendancePct: pct, present: Math.round(total * pct), total, isHoliday: false });
      }
    }

    const working = points.filter((p) => p.attendancePct != null);
    const averagePct = working.length
      ? working.reduce((s, p) => s + (p.attendancePct ?? 0), 0) / working.length
      : null;
    const now = new Date();
    const displayMonth = period === 'day' ? (monthParam ?? now.getMonth()) : undefined;
    const displayYear = period === 'day' ? (yearParam ?? now.getFullYear()) : undefined;
    const monthLabel =
      displayMonth !== undefined ? `${MONTHS[displayMonth]} ${displayYear}` : undefined;

    return { period, monthLabel, source: 'sample', averagePct, points };
  }

  /** Real teacher & student totals from ICT deployment data, with district breakdown. */
  async teacherStats(user: AuthUser, districtId?: string): Promise<TeacherStats> {
    const { schoolWhere } = schoolScope(user, districtId);
    const [total, ictSchools] = await Promise.all([
      prisma.ictDeployment.aggregate({
        _sum: { teacherCount: true, studentCount: true },
        where: { school: schoolWhere },
      }),
      prisma.school.count({ where: { ...schoolWhere, hasIctLab: true } }),
    ]);

    const districts = await prisma.district.findMany({
      where: districtScope(user),
      orderBy: { name: 'asc' },
    });
    const byDistrict = await Promise.all(
      districts.map(async (d) => {
        const dWhere = { school: { block: { districtId: d.id } } };
        const [agg, count] = await Promise.all([
          prisma.ictDeployment.aggregate({ _sum: { teacherCount: true, studentCount: true }, where: dWhere }),
          prisma.school.count({ where: { block: { districtId: d.id }, hasIctLab: true } }),
        ]);
        return {
          districtId: d.id,
          district: d.name,
          teachers: agg._sum.teacherCount ?? 0,
          students: agg._sum.studentCount ?? 0,
          schools: count,
        };
      }),
    );

    return {
      totalTeachers: total._sum.teacherCount ?? 0,
      totalStudents: total._sum.studentCount ?? 0,
      ictSchools,
      byDistrict: byDistrict.filter((d) => d.teachers > 0),
      source: 'real',
    };
  }

  /** Average pass % per subject for an exam, within scope. */
  async subjectAverages(user: AuthUser, examType: '10TH' | '12TH'): Promise<SubjectAverage[]> {
    const { schoolWhere } = schoolScope(user);
    const grouped = await prisma.boardResult.groupBy({
      by: ['subject'],
      where: { examType, school: schoolWhere },
      _avg: { passPct: true },
      _count: { _all: true },
    });
    return grouped
      .map((g) => ({
        examType,
        subject: g.subject,
        avgPassPct: g._avg.passPct ?? 0,
        schools: g._count._all,
      }))
      .sort((a, b) => b.avgPassPct - a.avgPassPct);
  }

  /** Block-level summaries within a district (for drill-down). */
  async blockSummaries(user: AuthUser, districtId: string) {
    const { schoolWhere } = schoolScope(user, districtId);
    const blocks = await prisma.block.findMany({ where: { districtId }, orderBy: { name: 'asc' } });
    return Promise.all(
      blocks.map(async (b) => {
        const where = { ...schoolWhere, blockId: b.id };
        const [schools, vc, ict, students, teachers, p10, p12] = await Promise.all([
          prisma.school.count({ where }),
          prisma.school.count({ where: { ...where, hasVirtualClassroom: true } }),
          prisma.school.count({ where: { ...where, hasIctLab: true } }),
          prisma.enrollment.aggregate({ _sum: { total: true, boys: true, girls: true }, where: { school: where } }),
          prisma.staff.count({ where: { school: where } }),
          prisma.boardResult.aggregate({ _avg: { passPct: true }, where: { examType: '10TH', school: where } }),
          prisma.boardResult.aggregate({ _avg: { passPct: true }, where: { examType: '12TH', school: where } }),
        ]);
        return {
          blockId: b.id,
          block: b.name,
          schools,
          virtualClassroomSchools: vc,
          ictLabSchools: ict,
          totalStudents: students._sum.total ?? 0,
          boys: students._sum.boys ?? 0,
          girls: students._sum.girls ?? 0,
          teachers,
          avgPass10th: p10._avg.passPct,
          avgPass12th: p12._avg.passPct,
        };
      }),
    );
  }
}
