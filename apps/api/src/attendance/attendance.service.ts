import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { AuthUser } from '@edubeam/shared';

const prisma = new PrismaClient();

function today() {
  return new Date().toISOString().slice(0, 10);
}

function gradeLabel(s: string) {
  return ({ P: 'Present', A: 'Absent', L: 'Late', HD: 'Half-day' } as Record<string, string>)[s] ?? s;
}

function letterGrade(pct: number) {
  if (pct >= 90) return 'A+';
  if (pct >= 75) return 'A';
  if (pct >= 60) return 'B';
  if (pct >= 45) return 'C';
  return 'D';
}

@Injectable()
export class AttendanceService {
  // ── resolve which schools this user can mark ────────────────────────────
  private async resolveSchoolId(user: AuthUser, reqSchoolId?: string): Promise<string> {
    if (user.role === 'PRINCIPAL' || user.role === 'TEACHER') {
      if (!user.schoolId) throw new ForbiddenException('No school linked to user');
      return user.schoolId;
    }
    if (!reqSchoolId) throw new ForbiddenException('schoolId required');
    return reqSchoolId;
  }

  // ── STUDENT ATTENDANCE ──────────────────────────────────────────────────

  async markStudents(user: AuthUser, dto: {
    schoolId?: string; date?: string; academicYear: string;
    records: { studentId: string; status: string }[];
  }) {
    const schoolId = await this.resolveSchoolId(user, dto.schoolId);
    const date = dto.date ?? today();

    const ops = dto.records.map(r =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: r.studentId, date } },
        update: { status: r.status, markedBy: user.id },
        create: { studentId: r.studentId, schoolId, date, status: r.status, markedBy: user.id, academicYear: dto.academicYear },
      })
    );
    await prisma.$transaction(ops);
    return { marked: dto.records.length, date, schoolId };
  }

  async getByDate(user: AuthUser, schoolId: string, date: string, grade?: number) {
    const students = await prisma.student.findMany({
      where: { schoolId, ...(grade ? { grade } : {}), active: true },
      orderBy: [{ grade: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, rollNo: true, grade: true, section: true, gender: true },
    });

    const records = await prisma.attendance.findMany({
      where: { schoolId, date, studentId: { in: students.map(s => s.id) } },
    });

    const map = Object.fromEntries(records.map(r => [r.studentId, r.status]));

    return {
      date,
      students: students.map(s => ({ ...s, status: map[s.id] ?? null, statusLabel: map[s.id] ? gradeLabel(map[s.id]) : 'Not marked' })),
      summary: {
        total: students.length,
        present: records.filter(r => r.status === 'P').length,
        absent: records.filter(r => r.status === 'A').length,
        late: records.filter(r => r.status === 'L').length,
        halfDay: records.filter(r => r.status === 'HD').length,
        notMarked: students.length - records.length,
      },
    };
  }

  async getStudentCalendar(studentId: string, month: string) {
    // month = "YYYY-MM"
    const records = await prisma.attendance.findMany({
      where: { studentId, date: { startsWith: month } },
      orderBy: { date: 'asc' },
    });
    const total = records.length;
    const present = records.filter(r => r.status === 'P').length;
    return {
      records: records.map(r => ({ date: r.date, status: r.status, label: gradeLabel(r.status) })),
      summary: { total, present, absent: records.filter(r => r.status === 'A').length, late: records.filter(r => r.status === 'L').length, pct: total ? Math.round(present / total * 100) : 0 },
    };
  }

  async getMonthlyReport(schoolId: string, month: string, grade?: number) {
    const students = await prisma.student.findMany({
      where: { schoolId, ...(grade ? { grade } : {}), active: true },
      orderBy: [{ grade: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, rollNo: true, grade: true, section: true },
    });

    const records = await prisma.attendance.findMany({
      where: { schoolId, date: { startsWith: month }, studentId: { in: students.map(s => s.id) } },
    });

    const byStudent: Record<string, { P: number; A: number; L: number; HD: number }> = {};
    for (const s of students) byStudent[s.id] = { P: 0, A: 0, L: 0, HD: 0 };
    for (const r of records) {
      if (byStudent[r.studentId]) {
        (byStudent[r.studentId] as Record<string, number>)[r.status] = ((byStudent[r.studentId] as Record<string, number>)[r.status] ?? 0) + 1;
      }
    }

    const workingDays = [...new Set(records.map(r => r.date))].length;

    return {
      month,
      workingDays,
      students: students.map(s => {
        const c = byStudent[s.id];
        const marked = c.P + c.A + c.L + c.HD;
        const pct = marked ? Math.round(c.P / marked * 100) : 0;
        return { ...s, present: c.P, absent: c.A, late: c.L, halfDay: c.HD, pct, grade_letter: letterGrade(pct) };
      }),
    };
  }

  async getSchoolDateReport(schoolId: string, from: string, to: string) {
    const rows = await prisma.attendance.groupBy({
      by: ['date', 'status'],
      where: { schoolId, date: { gte: from, lte: to } },
      _count: { status: true },
      orderBy: { date: 'asc' },
    });

    const byDate: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!byDate[r.date]) byDate[r.date] = { P: 0, A: 0, L: 0, HD: 0 };
      byDate[r.date][r.status] = r._count.status;
    }

    return Object.entries(byDate).map(([date, counts]) => ({
      date,
      present: counts.P ?? 0,
      absent: counts.A ?? 0,
      late: counts.L ?? 0,
      halfDay: counts.HD ?? 0,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    }));
  }

  // ── STAFF ATTENDANCE ────────────────────────────────────────────────────

  async markStaff(user: AuthUser, dto: {
    schoolId?: string; date?: string; academicYear: string;
    records: { staffId: string; status: string }[];
  }) {
    const schoolId = await this.resolveSchoolId(user, dto.schoolId);
    const date = dto.date ?? today();

    const ops = dto.records.map(r =>
      prisma.staffAttendance.upsert({
        where: { staffId_date: { staffId: r.staffId, date } },
        update: { status: r.status, markedBy: user.id },
        create: { staffId: r.staffId, schoolId, date, status: r.status, markedBy: user.id, academicYear: dto.academicYear },
      })
    );
    await prisma.$transaction(ops);
    return { marked: dto.records.length, date, schoolId };
  }

  async getStaffByDate(schoolId: string, date: string) {
    const staff = await prisma.staff.findMany({
      where: { schoolId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, staffType: true, designation: true, gender: true },
    });

    const records = await prisma.staffAttendance.findMany({
      where: { schoolId, date },
    });

    const map = Object.fromEntries(records.map(r => [r.staffId, r.status]));

    return {
      date,
      staff: staff.map(s => ({ ...s, status: map[s.id] ?? null })),
      summary: {
        total: staff.length,
        present: records.filter(r => r.status === 'P').length,
        absent: records.filter(r => r.status === 'A').length,
        onDuty: records.filter(r => r.status === 'OD').length,
        notMarked: staff.length - records.length,
      },
    };
  }

  async getStaffMonthlyReport(schoolId: string, month: string) {
    const staff = await prisma.staff.findMany({
      where: { schoolId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, staffType: true, designation: true },
    });

    const records = await prisma.staffAttendance.findMany({
      where: { schoolId, date: { startsWith: month } },
    });

    const byStaff: Record<string, { P: number; A: number; L: number; OD: number }> = {};
    for (const s of staff) byStaff[s.id] = { P: 0, A: 0, L: 0, OD: 0 };
    for (const r of records) {
      if (byStaff[r.staffId]) {
        (byStaff[r.staffId] as Record<string, number>)[r.status] = ((byStaff[r.staffId] as Record<string, number>)[r.status] ?? 0) + 1;
      }
    }

    const workingDays = [...new Set(records.map(r => r.date))].length;

    return {
      month,
      workingDays,
      staff: staff.map(s => {
        const c = byStaff[s.id];
        const marked = c.P + c.A + c.L + c.OD;
        const pct = marked ? Math.round(c.P / marked * 100) : 0;
        return { ...s, present: c.P, absent: c.A, late: c.L, onDuty: c.OD, pct };
      }),
    };
  }

  // ── EXAM RESULTS ────────────────────────────────────────────────────────

  async saveResults(user: AuthUser, dto: {
    schoolId?: string; grade: number; section?: string; examType: string; academicYear: string;
    results: { studentId: string; subject: string; marksObtained: number; maxMarks: number }[];
  }) {
    const schoolId = await this.resolveSchoolId(user, dto.schoolId);

    const ops = dto.results.map(r => {
      const pct = r.maxMarks ? (r.marksObtained / r.maxMarks) * 100 : 0;
      const grade_letter = pct >= 90 ? 'A+' : pct >= 75 ? 'A' : pct >= 60 ? 'B+' : pct >= 45 ? 'B' : pct >= 33 ? 'C' : 'F';
      return prisma.examResult.upsert({
        where: { studentId_subject_examType_academicYear: { studentId: r.studentId, subject: r.subject, examType: dto.examType, academicYear: dto.academicYear } },
        update: { marksObtained: r.marksObtained, maxMarks: r.maxMarks, grade_letter },
        create: {
          studentId: r.studentId, schoolId, subject: r.subject, grade: dto.grade,
          section: dto.section, examType: dto.examType, academicYear: dto.academicYear,
          marksObtained: r.marksObtained, maxMarks: r.maxMarks, grade_letter,
        },
      });
    });
    await prisma.$transaction(ops);
    return { saved: dto.results.length };
  }

  async getReportCard(studentId: string, academicYear: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, rollNo: true, grade: true, section: true, gender: true, school: { select: { name: true, udiseCode: true } } },
    });
    if (!student) return null;

    const results = await prisma.examResult.findMany({
      where: { studentId, academicYear },
      orderBy: [{ subject: 'asc' }, { examType: 'asc' }],
    });

    const bySubject: Record<string, Record<string, { marks: number; max: number; grade: string }>> = {};
    for (const r of results) {
      if (!bySubject[r.subject]) bySubject[r.subject] = {};
      bySubject[r.subject][r.examType] = { marks: r.marksObtained, max: r.maxMarks, grade: r.grade_letter ?? '' };
    }

    const totalMarks = results.reduce((a, r) => a + r.marksObtained, 0);
    const maxTotal = results.reduce((a, r) => a + r.maxMarks, 0);
    const overallPct = maxTotal ? Math.round(totalMarks / maxTotal * 100) : 0;

    return { student, academicYear, bySubject, totalMarks, maxTotal, overallPct, overallGrade: letterGrade(overallPct) };
  }

  async getClassResults(schoolId: string, grade: number, examType: string, academicYear: string, section?: string) {
    const students = await prisma.student.findMany({
      where: { schoolId, grade, ...(section ? { section } : {}), active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, rollNo: true, section: true },
    });

    const results = await prisma.examResult.findMany({
      where: { schoolId, grade, examType, academicYear, studentId: { in: students.map(s => s.id) } },
    });

    const byStudent: Record<string, { total: number; max: number; subjects: Record<string, number> }> = {};
    for (const s of students) byStudent[s.id] = { total: 0, max: 0, subjects: {} };
    for (const r of results) {
      if (byStudent[r.studentId]) {
        byStudent[r.studentId].total += r.marksObtained;
        byStudent[r.studentId].max += r.maxMarks;
        byStudent[r.studentId].subjects[r.subject] = r.marksObtained;
      }
    }

    const subjects = [...new Set(results.map(r => r.subject))].sort();

    return {
      grade, examType, academicYear,
      subjects,
      students: students.map(s => {
        const d = byStudent[s.id];
        const pct = d.max ? Math.round(d.total / d.max * 100) : 0;
        return { ...s, total: d.total, max: d.max, pct, grade_letter: letterGrade(pct), subjects: d.subjects };
      }).sort((a, b) => b.pct - a.pct),
    };
  }

  // ── STUDENT SELF-SERVICE ────────────────────────────────────────────────

  async getStudentProfile(user: AuthUser) {
    if (!user.studentId) return null;
    const student = await prisma.student.findUnique({
      where: { id: user.studentId },
      include: { school: { select: { name: true, udiseCode: true } } },
    });
    if (!student) return null;

    const month = today().slice(0, 7);
    const [attRecords, results] = await Promise.all([
      prisma.attendance.findMany({ where: { studentId: user.studentId, date: { startsWith: month } } }),
      prisma.examResult.findMany({ where: { studentId: user.studentId, academicYear: '2025-26' } }),
    ]);

    const attSummary = { present: 0, absent: 0, late: 0, halfDay: 0 };
    for (const r of attRecords) {
      if (r.status === 'P') attSummary.present++;
      else if (r.status === 'A') attSummary.absent++;
      else if (r.status === 'L') attSummary.late++;
      else if (r.status === 'HD') attSummary.halfDay++;
    }

    const totalMarks = results.reduce((a, r) => a + r.marksObtained, 0);
    const maxTotal = results.reduce((a, r) => a + r.maxMarks, 0);

    return {
      student: { ...student, school: student.school.name },
      thisMonth: { ...attSummary, total: attRecords.length },
      examResults: { count: results.length, totalMarks, maxTotal, pct: maxTotal ? Math.round(totalMarks / maxTotal * 100) : null },
    };
  }

  // ── PARENT PORTAL ───────────────────────────────────────────────────────

  async getChildren(user: AuthUser) {
    if (!user.linkedStudentIds) return { children: [] };
    const ids = user.linkedStudentIds.split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) return { children: [] };

    const students = await prisma.student.findMany({
      where: { id: { in: ids } },
      include: { school: { select: { name: true } } },
    });

    const month = today().slice(0, 7);
    const attRecords = await prisma.attendance.findMany({
      where: { studentId: { in: ids }, date: { startsWith: month } },
    });

    const attByStudent: Record<string, { present: number; absent: number; late: number; total: number }> = {};
    for (const id of ids) attByStudent[id] = { present: 0, absent: 0, late: 0, total: 0 };
    for (const r of attRecords) {
      if (!attByStudent[r.studentId]) continue;
      attByStudent[r.studentId].total++;
      if (r.status === 'P') attByStudent[r.studentId].present++;
      else if (r.status === 'A') attByStudent[r.studentId].absent++;
      else if (r.status === 'L') attByStudent[r.studentId].late++;
    }

    return {
      children: students.map(s => ({
        id: s.id,
        name: s.name,
        grade: s.grade,
        section: s.section,
        gender: s.gender,
        school: s.school.name,
        rollNo: s.rollNo,
        category: s.category,
        guardianName: s.guardianName,
        thisMonth: attByStudent[s.id] ?? { present: 0, absent: 0, late: 0, total: 0 },
      })),
    };
  }

  // ── DASHBOARD TODAY SUMMARY ─────────────────────────────────────────────

  async todaySummary(user: AuthUser, schoolId?: string) {
    const date = today();
    const where = schoolId ? { schoolId, date } : { date };

    const [studAtt, staffAtt, totalStudents, totalStaff] = await prisma.$transaction([
      prisma.attendance.groupBy({ by: ['status'], where, _count: { status: true } }),
      prisma.staffAttendance.groupBy({ by: ['status'], where, _count: { status: true } }),
      prisma.student.count({ where: schoolId ? { schoolId, active: true } : { active: true } }),
      prisma.staff.count({ where: schoolId ? { schoolId, active: true } : { active: true } }),
    ]);

    const studMap = Object.fromEntries(studAtt.map(r => [r.status, r._count.status]));
    const staffMap = Object.fromEntries(staffAtt.map(r => [r.status, r._count.status]));

    return {
      date,
      students: { total: totalStudents, present: studMap['P'] ?? 0, absent: studMap['A'] ?? 0, late: studMap['L'] ?? 0, notMarked: totalStudents - Object.values(studMap).reduce((a, b) => a + b, 0) },
      staff: { total: totalStaff, present: staffMap['P'] ?? 0, absent: staffMap['A'] ?? 0, onDuty: staffMap['OD'] ?? 0, notMarked: totalStaff - Object.values(staffMap).reduce((a, b) => a + b, 0) },
    };
  }
}
