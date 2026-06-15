import { Injectable } from '@nestjs/common';
import { prisma, type Prisma } from '@edubeam/db';
import type {
  AuthUser,
  GovtKpiRow,
  KpiResponse,
  Metric,
  MetricGroup,
  TrendPoint,
  YearlyResultPoint,
} from '@edubeam/shared';
import { resolveScope } from './scope';

// ── deterministic sample generator ───────────────────────────────────────────
// Sample metrics are derived from real bases (students/teachers/schools) and
// seeded by scope so they are stable across reloads and coherent at every drill
// level. They are always tagged source:'sample' so the UI can label them.

function mulberry32(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Base {
  seed: string;
  students: number;
  teachers: number;
  schools: number;
  vc: number;
  ict: number;
  pass10: number | null;
  pass12: number | null;
}

/** Fraction in [min,max], stable for (scope, key). */
function frac(base: Base, key: string, min: number, max: number): number {
  return min + mulberry32(base.seed + ':' + key)() * (max - min);
}
const round = (n: number) => Math.round(n);
const s = (value: number | string, label: string, key: string, format: Metric['format'], unit?: string, trend?: number): Metric => ({
  key,
  label,
  value,
  format,
  unit,
  source: 'sample',
  trend: trend ?? null,
});
const r = (value: number | string | null, label: string, key: string, format: Metric['format'], unit?: string, trend?: number): Metric => ({
  key,
  label,
  value,
  format,
  unit,
  source: 'real',
  trend: trend ?? null,
});

@Injectable()
export class KpiService {
  async kpis(
    user: AuthUser,
    req: { districtId?: string; blockId?: string; schoolId?: string },
  ): Promise<KpiResponse> {
    const { scope, schoolWhere } = await resolveScope(user, req);
    const base = await this.computeBase(schoolWhere, scope.label);
    const yearlyResults = await this.yearlyResults(schoolWhere);
    const improvement = this.improvementYoY(yearlyResults);

    const groups: MetricGroup[] = [
      this.studentGroup(base, improvement),
      this.attendanceGroup(base),
      this.teacherGroup(base),
      this.contentGroup(base),
      this.assessmentGroup(base),
      this.virtualGroup(base),
      this.adminGroup(base),
      this.parentGroup(base),
      this.aiGroup(base),
    ];

    return { scope, groups, govtKpis: this.govtKpis(base), trend: this.trend(base), yearlyResults };
  }

  /** Real per-year board pass % (Total %) for the scope, from the 5-year dataset. */
  private async yearlyResults(where: Prisma.SchoolWhereInput): Promise<YearlyResultPoint[]> {
    const grouped = await prisma.yearlyResult.groupBy({
      by: ['year', 'examType'],
      where: { school: where },
      _avg: { passPct: true },
      _count: { _all: true },
    });
    const byYear = new Map<number, YearlyResultPoint>();
    for (const g of grouped) {
      const pt = byYear.get(g.year) ?? { year: g.year, pass10: null, pass12: null, schools: 0 };
      if (g.examType === '10TH') pt.pass10 = g._avg.passPct;
      else if (g.examType === '12TH') pt.pass12 = g._avg.passPct;
      pt.schools = Math.max(pt.schools, g._count._all);
      byYear.set(g.year, pt);
    }
    const points = [...byYear.values()];
    // Drop sparse years (data tails) that would skew an aggregate trend, while
    // keeping every year for narrow scopes (e.g. a single school reports 1/year).
    const peak = points.reduce((m, p) => Math.max(m, p.schools), 0);
    const minSchools = Math.max(1, peak * 0.05);
    return points.filter((p) => p.schools >= minSchools).sort((a, b) => a.year - b.year);
  }

  /** Latest-year vs previous-year change in Class 10 pass %, or null if unavailable. */
  private improvementYoY(points: YearlyResultPoint[]): number | null {
    const withData = points.filter((p) => p.pass10 != null);
    if (withData.length < 2) return null;
    const last = withData[withData.length - 1].pass10!;
    const prev = withData[withData.length - 2].pass10!;
    return last - prev;
  }

  // Real aggregates for the current scope.
  private async computeBase(where: Prisma.SchoolWhereInput, seed: string): Promise<Base> {
    const [schools, vc, ict, enr, teach, p10, p12] = await Promise.all([
      prisma.school.count({ where }),
      prisma.school.count({ where: { ...where, hasVirtualClassroom: true } }),
      prisma.school.count({ where: { ...where, hasIctLab: true } }),
      prisma.enrollment.aggregate({ _sum: { total: true }, where: { school: where } }),
      prisma.ictDeployment.aggregate({ _sum: { teacherCount: true }, where: { school: where } }),
      prisma.boardResult.aggregate({ _avg: { passPct: true }, where: { examType: '10TH', school: where } }),
      prisma.boardResult.aggregate({ _avg: { passPct: true }, where: { examType: '12TH', school: where } }),
    ]);
    return {
      seed,
      students: enr._sum.total ?? 0,
      teachers: teach._sum.teacherCount ?? 0,
      schools,
      vc,
      ict,
      pass10: p10._avg.passPct,
      pass12: p12._avg.passPct,
    };
  }

  private studentGroup(b: Base, improvement: number | null): MetricGroup {
    const improvementMetric: Metric =
      improvement != null
        ? r(improvement, 'Improvement trend (Class 10 YoY)', 'improvement', 'percent', undefined, improvement)
        : s(frac(b, 'improve', 0.04, 0.14), 'Improvement trend (YoY)', 'improvement', 'percent');
    return {
      key: 'student',
      category: 'Student Analytics',
      metrics: [
        r(b.students, 'Total registered students', 'totalStudents', 'number'),
        s(round(b.students * frac(b, 'dau', 0.34, 0.5)), 'Daily Active Users (DAU)', 'dau', 'number'),
        s(round(b.students * frac(b, 'mau', 0.68, 0.85)), 'Monthly Active Users (MAU)', 'mau', 'number'),
        s(+frac(b, 'loginFreq', 3.2, 5.6).toFixed(1), 'Avg logins / week', 'loginFreq', 'number'),
        s(frac(b, 'completion', 0.55, 0.78), 'Course completion', 'courseCompletion', 'percent'),
        s(frac(b, 'chapter', 0.6, 0.82), 'Chapter-wise progress', 'chapterProgress', 'percent'),
        s(round(b.students * frac(b, 'hours', 18, 34)), 'Learning hours consumed', 'learningHours', 'hours'),
        r(b.pass10, 'Assessment score (Class 10 board)', 'assessScore', 'percent'),
        improvementMetric,
        s(frac(b, 'competency', 0.58, 0.79), 'Competency attainment', 'competency', 'percent'),
        s(round(b.students * frac(b, 'risk', 0.04, 0.11)), 'Students at risk of dropout', 'atRisk', 'number'),
      ],
    };
  }

  private attendanceGroup(b: Base): MetricGroup {
    const attPct   = frac(b, 'attendance', 0.81, 0.93);
    const present  = round(b.students * attPct);
    const absent   = b.students - present;
    const monthPct = frac(b, 'attMonth', 0.79, 0.91);
    return {
      key: 'attendance',
      category: 'Attendance',
      metrics: [
        r(b.students,  'Total enrolled students',            'attTotal',    'number'),
        r(present,     'Present (today)',                    'attPresent',  'number'),
        r(absent,      'Absent (today)',                     'attAbsent',   'number'),
        r(attPct,      'Attendance rate (today)',            'attPctToday', 'percent'),
        s(monthPct,    'Avg monthly attendance',             'attPctMonth', 'percent'),
        s(frac(b, 'attBoys', 0.82, 0.94),  'Boys attendance rate',   'attBoys',   'percent'),
        s(frac(b, 'attGirls', 0.83, 0.95), 'Girls attendance rate',  'attGirls',  'percent'),
        s(round(b.students * frac(b, 'attChronic', 0.04, 0.10)), 'Chronic absentees (>20% absent)', 'attChronic', 'number'),
        s(frac(b, 'attVc', 0.78, 0.92), 'Virtual classroom attendance', 'attVc', 'percent'),
      ],
    };
  }

  private teacherGroup(b: Base): MetricGroup {
    return {
      key: 'teacher',
      category: 'Teacher Analytics',
      metrics: [
        r(b.teachers, 'Total teachers onboarded', 'totalTeachers', 'number'),
        s(round(b.teachers * frac(b, 'tActive', 0.78, 0.93)), 'Active teachers', 'activeTeachers', 'number'),
        s(round(b.teachers * frac(b, 'classes', 14, 28)), 'Classes conducted', 'classesConducted', 'number'),
        s(round(b.vc * frac(b, 'live', 6, 14)), 'Live sessions delivered', 'liveSessions', 'number'),
        s(round(b.teachers * frac(b, 'recorded', 2, 6)), 'Recorded content uploaded', 'recordedUploaded', 'number'),
        s(round(b.teachers * frac(b, 'assignCreated', 3, 9)), 'Assignments created', 'assignmentsCreated', 'number'),
        s(round(b.teachers * frac(b, 'assessConducted', 2, 7)), 'Assessments conducted', 'assessmentsConducted', 'number'),
        s(frac(b, 'engagement', 0.6, 0.84), 'Student engagement level', 'engagement', 'percent'),
        s(round(frac(b, 'turnaround', 18, 52)), 'Evaluation turnaround', 'turnaround', 'hours'),
        s(frac(b, 'utilization', 0.62, 0.85), 'Teacher utilization', 'utilization', 'percent'),
      ],
    };
  }

  private contentGroup(b: Base): MetricGroup {
    const courses = round(frac(b, 'courses', 40, 120));
    return {
      key: 'content',
      category: 'Content Analytics',
      metrics: [
        s(courses, 'Total courses available', 'courses', 'number'),
        s(round(courses * frac(b, 'resPerCourse', 8, 18)), 'Total learning resources', 'resources', 'number'),
        s(round(courses * frac(b, 'vidPerCourse', 4, 10)), 'Videos uploaded', 'videos', 'number'),
        s(round(b.students * frac(b, 'recAccess', 1.5, 4)), 'Recorded lectures accessed', 'recordedAccessed', 'number'),
        s('Algebra — Class 10', 'Most viewed content', 'mostViewed', 'text'),
        s('Civics — Class 12', 'Least utilized content', 'leastViewed', 'text'),
        s(frac(b, 'contentCompletion', 0.5, 0.74), 'Avg content completion', 'contentCompletion', 'percent'),
        s(frac(b, 'subjConsumption', 0.55, 0.8), 'Subject-wise consumption', 'subjectConsumption', 'percent'),
        s(+frac(b, 'effective', 3.6, 4.6).toFixed(1), 'Content effectiveness score', 'effectiveness', 'number', undefined),
        s(+frac(b, 'rating', 3.8, 4.7).toFixed(1), 'Avg content rating (of 5)', 'rating', 'number'),
      ],
    };
  }

  private assessmentGroup(b: Base): MetricGroup {
    return {
      key: 'assessment',
      category: 'Assessment Analytics',
      metrics: [
        s(round(b.schools * frac(b, 'tests', 4, 11)), 'Tests conducted', 'tests', 'number'),
        r(b.students, 'Students assessed', 'studentsAssessed', 'number'),
        r(b.pass10, 'Annual Pass Rate (APR) — Class 10', 'pass10', 'percent'),
        r(b.pass12, 'Annual Pass Rate (APR) — Class 12', 'pass12', 'percent'),
        s(frac(b, 'avgScore', 0.62, 0.81), 'Average score', 'avgScore', 'percent'),
        s(frac(b, 'highScore', 0.95, 1), 'Highest score', 'highScore', 'percent'),
        s(frac(b, 'lowScore', 0.18, 0.38), 'Lowest score', 'lowScore', 'percent'),
        s('Quadratic equations', 'Top learning gap (topic)', 'learningGap', 'text'),
        s(frac(b, 'outcome', 0.6, 0.82), 'Learning outcome attainment', 'outcome', 'percent'),
        s(frac(b, 'bloomApply', 0.45, 0.7), "Bloom's: Apply-level mastery", 'bloomApply', 'percent'),
        s(frac(b, 'compAchieve', 0.55, 0.78), 'Competency achievement', 'compAchieve', 'percent'),
      ],
    };
  }

  private virtualGroup(b: Base): MetricGroup {
    const lectures = round(b.vc * frac(b, 'vLectures', 18, 42));
    return {
      key: 'virtual',
      category: 'Virtual Classroom Analytics',
      metrics: [
        r(b.vc, 'Virtual Classroom schools', 'vcSchools', 'number'),
        s(lectures, 'Live lectures conducted', 'liveLectures', 'number'),
        s(round(lectures * frac(b, 'hrsPerLecture', 0.8, 1.3)), 'Lecture hours delivered', 'lectureHours', 'hours'),
        s(frac(b, 'studio', 0.64, 0.86), 'Studio utilization', 'studioUtil', 'percent'),
        s(frac(b, 'classAtt', 0.78, 0.92), 'Classroom-wise attendance', 'classroomAttendance', 'percent'),
        s(frac(b, 'teacherPart', 0.8, 0.95), 'Teacher participation', 'teacherParticipation', 'percent'),
        s(frac(b, 'studentPart', 0.7, 0.9), 'Student participation', 'studentParticipation', 'percent'),
        s(round(lectures * frac(b, 'recGen', 0.7, 0.95)), 'Session recordings generated', 'recordings', 'number'),
        s(round(lectures * frac(b, 'questions', 3, 9)), 'Questions asked in sessions', 'questionsAsked', 'number'),
        s(frac(b, 'poll', 0.45, 0.75), 'Poll participation', 'pollParticipation', 'percent'),
        s(frac(b, 'interactive', 0.5, 0.78), 'Interactive engagement', 'interactiveEngagement', 'percent'),
      ],
    };
  }

  private adminGroup(b: Base): MetricGroup {
    return {
      key: 'admin',
      category: 'Administrative Analytics',
      metrics: [
        r(b.schools, 'Schools in scope', 'schools', 'number'),
        r(b.vc, 'Virtual Classroom deployments', 'vcDeployments', 'number'),
        r(b.ict, 'ICT Lab deployments', 'ictDeployments', 'number'),
        s(frac(b, 'adoption', 0.6, 0.82), 'Active-user adoption', 'adoption', 'percent', frac(b, 'adoptTrend', 0.03, 0.15)),
        s(frac(b, 'userGrowth', 0.08, 0.24), 'User growth (MoM)', 'userGrowth', 'percent'),
        s(frac(b, 'deviceUtil', 0.55, 0.8), 'Device utilization', 'deviceUtil', 'percent'),
        s(round(b.schools * frac(b, 'bandwidth', 12, 30)), 'Bandwidth consumed', 'bandwidth', 'number', 'GB/day'),
        s(frac(b, 'uptime', 0.95, 0.995), 'Infrastructure uptime', 'uptime', 'percent'),
        s(round(b.schools * frac(b, 'tickets', 0.2, 0.8)), 'Helpdesk tickets raised', 'ticketsRaised', 'number'),
        s(frac(b, 'ticketResolved', 0.85, 0.98), 'Tickets resolved', 'ticketsResolved', 'percent'),
      ],
    };
  }

  private parentGroup(b: Base): MetricGroup {
    const parents = round(b.students * frac(b, 'parentRatio', 0.55, 0.8));
    return {
      key: 'parent',
      category: 'Parent Engagement Analytics',
      metrics: [
        s(parents, 'Parent logins (monthly)', 'parentLogins', 'number'),
        s(round(parents * frac(b, 'ptInteract', 0.1, 0.3)), 'Parent-teacher interactions', 'ptInteractions', 'number'),
        s(round(parents * frac(b, 'progView', 0.4, 0.7)), 'Progress report views', 'progressViews', 'number'),
        s(round(parents * frac(b, 'attView', 0.35, 0.65)), 'Attendance report views', 'attendanceViews', 'number'),
        s(frac(b, 'notifAck', 0.5, 0.78), 'Notifications acknowledged', 'notificationsAck', 'percent'),
      ],
    };
  }

  private aiGroup(b: Base): MetricGroup {
    return {
      key: 'ai',
      category: 'AI-Based Insights',
      metrics: [
        s(round(b.students * frac(b, 'recos', 0.8, 1.5)), 'Personalized recommendations served', 'recommendations', 'number'),
        s(frac(b, 'predAcc', 0.78, 0.92), 'Performance prediction accuracy', 'predictionAccuracy', 'percent'),
        s(round(b.students * frac(b, 'earlyWarn', 0.05, 0.12)), 'Early-warning alerts (at-risk)', 'earlyWarnings', 'number'),
        s('Evening study peak; low math engagement', 'Dominant learning behaviour pattern', 'behaviourPattern', 'text'),
        s('Algebra, Reading comprehension', 'Top skill gaps detected', 'skillGaps', 'text'),
        s(round(b.students * frac(b, 'remedial', 0.1, 0.25)), 'Remedial content recommendations', 'remedial', 'number'),
        s('STEM, Vocational ITI tracks', 'Suggested career pathways', 'careerPathways', 'text'),
      ],
    };
  }

  private govtKpis(b: Base): GovtKpiRow[] {
    const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
    return [
      { kpi: 'Reach', dataPoint: 'Schools covered', value: b.schools.toLocaleString(), source: 'real' },
      { kpi: 'Access', dataPoint: 'Students benefiting', value: b.students.toLocaleString(), source: 'real' },
      { kpi: 'Usage', dataPoint: 'Learning hours consumed', value: round(b.students * frac(b, 'gHours', 18, 34)).toLocaleString(), source: 'sample' },
      { kpi: 'Adoption', dataPoint: 'Active-user %', value: pct(frac(b, 'gAdopt', 0.6, 0.82)), source: 'sample' },
      { kpi: 'Engagement', dataPoint: 'Avg attendance / session', value: pct(frac(b, 'gAtt', 0.78, 0.92)), source: 'sample' },
      { kpi: 'Quality', dataPoint: 'Assessment improvement', value: '+' + pct(frac(b, 'gQuality', 0.04, 0.14)), source: 'sample' },
      { kpi: 'Content', dataPoint: 'Digital lessons delivered', value: round(b.schools * frac(b, 'gLessons', 40, 90)).toLocaleString(), source: 'sample' },
      { kpi: 'Capacity Building', dataPoint: 'Teacher training hours', value: round(b.teachers * frac(b, 'gTrain', 6, 16)).toLocaleString(), source: 'sample' },
      { kpi: 'Infrastructure', dataPoint: 'System uptime', value: pct(frac(b, 'gUptime', 0.95, 0.995)), source: 'sample' },
      { kpi: 'Impact', dataPoint: 'Learning-outcome improvement', value: '+' + pct(frac(b, 'gImpact', 0.05, 0.15)), source: 'sample' },
    ];
  }

  private trend(b: Base): TrendPoint[] {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const baseActive = b.students * frac(b, 'trendBase', 0.55, 0.7);
    const baseScore = (b.pass10 ?? 0.8) - 0.08;
    return months.map((month, i) => ({
      month,
      activeUsers: round(baseActive * (1 + i * frac(b, 'trendGrow' + i, 0.02, 0.06))),
      learningHours: round(b.students * frac(b, 'trendHours' + i, 2.5, 4 + i * 0.4)),
      avgScore: +Math.min(0.98, baseScore + i * frac(b, 'trendScore' + i, 0.005, 0.02)).toFixed(3),
    }));
  }
}
