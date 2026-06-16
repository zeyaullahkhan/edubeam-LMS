// Shared types, constants and role helpers used by both API and web.

export const ROLES = [
  'ADMIN',
  'STATE_OFFICIAL',
  'DISTRICT_OFFICIAL',
  'BLOCK_OFFICIAL',
  'PRINCIPAL',
  'TEACHER',
  'STUDENT',
  'PARENT',
] as const;
export type Role = (typeof ROLES)[number];

export const ACADEMIC_YEAR = '2025-26';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId?: string | null;
  districtId?: string | null;
  blockId?: string | null;
  schoolId?: string | null;
  studentId?: string | null;        // STUDENT role: linked Student.id
  linkedStudentIds?: string | null; // PARENT role: comma-separated Student ids
}

export interface DistrictSummary {
  districtId: string;
  district: string;
  schools: number;
  virtualClassroomSchools: number;
  ictLabSchools: number;
  totalStudents: number;
  avgPass10th: number | null;
  avgPass12th: number | null;
}

export interface SubjectAverage {
  examType: '10TH' | '12TH';
  subject: string;
  avgPassPct: number;
  schools: number;
}

/** Boys/girls enrolment totals + class-wise split (from 500 Virtual2526.xlsx). */
export interface EnrollmentDemographics {
  boys: number;
  girls: number;
  total: number;
  byGrade: { grade: number; boys: number; girls: number }[];
}

/** One bar in the attendance calendar view (a month or a day). */
export interface AttendancePoint {
  label: string;
  /** Attendance rate 0..1, or null for a holiday/non-working day. */
  attendancePct: number | null;
  present: number;
  total: number;
  isHoliday: boolean;
}

/** Attendance calendar series. `source` is 'sample' until live attendance
 * tracking (tender §6.2.8.8) lands; totals are anchored to real enrolment. */
export interface AttendanceSeries {
  period: 'month' | 'day';
  monthLabel?: string;
  source: 'sample';
  averagePct: number | null;
  points: AttendancePoint[];
}

// ── Student & Staff registry ────────────────────────────────────────────────

export const GENDERS = ['M', 'F', 'O'] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABELS: Record<Gender, string> = { M: 'Male', F: 'Female', O: 'Other' };

export const CATEGORIES = ['GEN', 'OBC', 'SC', 'ST'] as const;
export type Category = (typeof CATEGORIES)[number];

export const RELIGIONS = ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Buddhist', 'Other'] as const;

export const STAFF_TYPES = ['TEACHER', 'FACULTY', 'LAB_ASSISTANT', 'PRINCIPAL'] as const;
export type StaffType = (typeof STAFF_TYPES)[number];
export const STAFF_TYPE_LABELS: Record<StaffType, string> = {
  TEACHER: 'Teacher',
  FACULTY: 'Faculty',
  LAB_ASSISTANT: 'Lab Assistant',
  PRINCIPAL: 'Principal',
};

export interface Student {
  id: string;
  schoolId: string;
  school?: string | null;
  admissionNo: string | null;
  rollNo: string | null;
  name: string;
  gender: Gender;
  dateOfBirth: string | null;
  grade: number;
  section: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianRelation: string | null;
  address: string | null;
  category: Category;
  religion: string | null;
  isRte: boolean;
  bankAccount: string | null;
  healthNotes: string | null;
  isDropout: boolean;
  dropoutReason: string | null;
  academicYear: string;
  active: boolean;
}

export interface Staff {
  id: string;
  schoolId: string;
  school?: string | null;
  employeeId: string | null;
  name: string;
  gender: Gender;
  dateOfBirth: string | null;
  staffType: StaffType;
  designation: string | null;
  qualification: string | null;
  subjects: string | null;
  phone: string | null;
  email: string | null;
  department: string | null;
  salaryGroup: string | null;
  joiningDate: string | null;
  isClassTeacher: boolean;
  classTeacherOf: string | null;
  active: boolean;
  academicYear: string;
}

/** Student demographics summary (tender §6.2.6.10.a report). */
export interface StudentDemographics {
  total: number;
  boys: number;
  girls: number;
  rte: number;
  dropouts: number;
  byGrade: { grade: number; count: number }[];
  byCategory: { category: string; count: number }[];
  byReligion: { religion: string; count: number }[];
}

/** Staff demographics summary (tender §6.2.6.10.b report). */
export interface StaffDemographics {
  total: number;
  byType: { staffType: string; count: number }[];
  byQualification: { qualification: string; count: number }[];
  classTeachers: number;
}

// ── Analytics / KPI layer ─────────────────────────────────────────────────

export type MetricSource = 'real' | 'sample';
export type MetricFormat = 'number' | 'percent' | 'duration' | 'hours' | 'minutes' | 'text';

export interface Metric {
  key: string;
  label: string;
  value: number | string | null;
  unit?: string;
  format: MetricFormat;
  source: MetricSource;
  /** Optional period-over-period change as a fraction (e.g. 0.12 = +12%). */
  trend?: number | null;
}

export interface MetricGroup {
  key: string;
  category: string;
  metrics: Metric[];
}

export interface GovtKpiRow {
  kpi: string;
  dataPoint: string;
  value: string;
  source: MetricSource;
}

export interface TrendPoint {
  month: string;
  activeUsers: number;
  learningHours: number;
  avgScore: number;
}

/** Real historical board-result point (from the 5-year dataset). */
export interface YearlyResultPoint {
  year: number;
  pass10: number | null;
  pass12: number | null;
  schools: number;
}

export interface KpiScope {
  level: 'state' | 'district' | 'block' | 'school';
  label: string;
  districtId?: string | null;
  blockId?: string | null;
  schoolId?: string | null;
}

export interface KpiResponse {
  scope: KpiScope;
  groups: MetricGroup[];
  govtKpis: GovtKpiRow[];
  trend: TrendPoint[];
  yearlyResults: YearlyResultPoint[];
}

export const KPI_CATEGORIES = [
  'Student Analytics',
  'Teacher Analytics',
  'Content Analytics',
  'Assessment Analytics',
  'Virtual Classroom Analytics',
  'Administrative Analytics',
  'Parent Engagement Analytics',
  'AI-Based Insights',
  'Government Project KPIs',
] as const;

/** Real teacher & student counts from ICT deployment data (ict.xlsx). */
export interface TeacherStats {
  totalTeachers: number;
  totalStudents: number;
  ictSchools: number;
  byDistrict: { districtId: string; district: string; teachers: number; students: number; schools: number }[];
  source: 'real';
}

/** Roles that can see the whole tenant vs. a single district/block vs. a single school. */
export function scopeOf(user: Pick<AuthUser, 'role' | 'districtId' | 'blockId' | 'schoolId'>): {
  level: 'tenant' | 'district' | 'block' | 'school';
  districtId?: string | null;
  blockId?: string | null;
  schoolId?: string | null;
} {
  switch (user.role) {
    case 'ADMIN':
    case 'STATE_OFFICIAL':
      return { level: 'tenant' };
    case 'DISTRICT_OFFICIAL':
      return { level: 'district', districtId: user.districtId };
    case 'BLOCK_OFFICIAL':
      return { level: 'block', blockId: user.blockId, districtId: user.districtId };
    default:
      return { level: 'school', schoolId: user.schoolId, districtId: user.districtId };
  }
}
