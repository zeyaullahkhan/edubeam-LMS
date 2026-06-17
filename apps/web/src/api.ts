import type {
  AttendanceSeries,
  AuthUser,
  DistrictSummary,
  EnrollmentDemographics,
  KpiResponse,
  Staff,
  StaffDemographics,
  Student,
  StudentDemographics,
  SubjectAverage,
  TeacherStats,
} from '@edubeam/shared';

const TOKEN_KEY = 'edubeam_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface Overview {
  schools: number;
  virtualClassroomSchools: number;
  ictLabSchools: number;
  totalStudents: number;
  avgPass10th: number | null;
  avgPass12th: number | null;
  totalDistricts: number;
  totalBlocks: number;
}

export interface BlockSummary {
  blockId: string;
  block: string;
  schools: number;
  virtualClassroomSchools: number;
  ictLabSchools: number;
  totalStudents: number;
  teachers: number;
}

export interface SchoolRow {
  id: string;
  name: string;
  udiseCode: string;
  siteCode: string | null;
  type: string | null;
  district: string;
  districtId: string;
  block: string;
  blockId: string;
  hasVirtualClassroom: boolean;
  hasIctLab: boolean;
  address: string | null;
  principalName: string | null;
  phone: string | null;
  teachers: number | null;
  students: number | null;
  enrolledStudents: number | null;
  avgPass10th: number | null;
  avgPass12th: number | null;
}

export interface DistrictMeta {
  id: string;
  name: string;
  blocks: { id: string; name: string }[];
}

export interface SchoolFormData {
  name: string;
  udiseCode: string;
  siteCode?: string;
  blockId: string;
  type?: string;
  hasVirtualClassroom: boolean;
  hasIctLab: boolean;
  address?: string;
  principalName?: string;
  phone?: string;
}

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => req<AuthUser>('/auth/me'),
  overview: () => req<Overview>('/analytics/overview'),
  districts: () => req<DistrictSummary[]>('/analytics/districts'),
  blocks: (districtId: string) => req<BlockSummary[]>(`/analytics/blocks?districtId=${districtId}`),
  subjects: (examType: '10TH' | '12TH') =>
    req<SubjectAverage[]>(`/analytics/subjects?examType=${examType}`),
  enrollment: () => req<EnrollmentDemographics>('/analytics/enrollment'),
  teacherStats: (districtId?: string) =>
    req<TeacherStats>(`/analytics/teacher-stats${districtId ? `?districtId=${encodeURIComponent(districtId)}` : ''}`),
  attendanceSeries: (period: 'month' | 'day', month?: number, year?: number) => {
    const qs = new URLSearchParams({ period });
    if (month !== undefined) qs.set('month', String(month));
    if (year !== undefined) qs.set('year', String(year));
    return req<AttendanceSeries>(`/analytics/attendance?${qs}`);
  },
  schools: (params: { districtId?: string; blockId?: string; q?: string } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    ).toString();
    return req<SchoolRow[]>(`/schools${qs ? `?${qs}` : ''}`);
  },
  schoolDistricts: () => req<DistrictMeta[]>('/schools/meta/districts'),
  createSchool: (body: SchoolFormData) =>
    req<SchoolRow>('/schools', { method: 'POST', body: JSON.stringify(body) }),
  updateSchool: (id: string, body: Partial<SchoolFormData>) =>
    req<SchoolRow>(`/schools/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  kpis: (params: { districtId?: string; blockId?: string; schoolId?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    ).toString();
    return req<KpiResponse>(`/analytics/kpis${qs ? `?${qs}` : ''}`);
  },
  users: {
    list: (params: { q?: string; role?: string; districtId?: string; blockId?: string; schoolId?: string; page?: number } = {}) => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][],
      ).toString();
      return req<{ total: number; page: number; pages: number; users: ManagedUser[] }>(`/users${qs ? `?${qs}` : ''}`);
    },
    create: (body: NewUser) => req<{ id: string }>('/users', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<NewUser> & { active?: boolean }) =>
      req<{ ok: boolean }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) => req<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),
  },
  students: {
    list: (params: PeopleFilter & { grade?: number; gender?: string; q?: string; rte?: boolean; dropout?: boolean } = {}) =>
      req<Student[]>(`/students${qstr(params)}`),
    summary: (params: PeopleFilter = {}) => req<StudentDemographics>(`/students/summary${qstr(params)}`),
    create: (body: Partial<Student> & { schoolId?: string }) =>
      req<{ id: string }>('/students', { method: 'POST', body: JSON.stringify(body) }),
    bulk: (schoolId: string | undefined, rows: Partial<Student>[]) =>
      req<{ inserted: number; skipped: number }>('/students/bulk', { method: 'POST', body: JSON.stringify({ schoolId, rows }) }),
    promote: (schoolId?: string) =>
      req<{ promoted: number; graduated: number }>('/students/promote', { method: 'POST', body: JSON.stringify({ schoolId }) }),
    update: (id: string, body: Partial<Student>) =>
      req<{ ok: boolean }>(`/students/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) => req<{ ok: boolean }>(`/students/${id}`, { method: 'DELETE' }),
  },
  staff: {
    list: (params: PeopleFilter & { staffType?: string; q?: string } = {}) =>
      req<Staff[]>(`/staff${qstr(params)}`),
    summary: (params: PeopleFilter = {}) => req<StaffDemographics>(`/staff/summary${qstr(params)}`),
    create: (body: Partial<Staff> & { schoolId?: string }) =>
      req<{ id: string }>('/staff', { method: 'POST', body: JSON.stringify(body) }),
    bulk: (schoolId: string | undefined, rows: Partial<Staff>[]) =>
      req<{ inserted: number; skipped: number }>('/staff/bulk', { method: 'POST', body: JSON.stringify({ schoolId, rows }) }),
    update: (id: string, body: Partial<Staff>) =>
      req<{ ok: boolean }>(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) => req<{ ok: boolean }>(`/staff/${id}`, { method: 'DELETE' }),
  },
  attendance: {
    markStudents: (body: { schoolId?: string; date?: string; academicYear: string; records: { studentId: string; status: string }[] }) =>
      req<{ marked: number; date: string }>('/attendance/students/mark', { method: 'POST', body: JSON.stringify(body) }),
    byDate: (schoolId: string, date: string, grade?: number) =>
      req<any>(`/attendance/students/date?schoolId=${schoolId}&date=${date}${grade ? `&grade=${grade}` : ''}`),
    calendar: (studentId: string, month: string) =>
      req<any>(`/attendance/students/calendar?studentId=${studentId}&month=${month}`),
    monthly: (schoolId: string, month: string, grade?: number) =>
      req<any>(`/attendance/students/monthly?schoolId=${schoolId}&month=${month}${grade ? `&grade=${grade}` : ''}`),
    report: (schoolId: string, from: string, to: string) =>
      req<any>(`/attendance/students/report?schoolId=${schoolId}&from=${from}&to=${to}`),
    markStaff: (body: { schoolId?: string; date?: string; academicYear: string; records: { staffId: string; status: string }[] }) =>
      req<{ marked: number }>('/attendance/staff/mark', { method: 'POST', body: JSON.stringify(body) }),
    staffByDate: (schoolId: string, date: string) =>
      req<any>(`/attendance/staff/date?schoolId=${schoolId}&date=${date}`),
    staffMonthly: (schoolId: string, month: string) =>
      req<any>(`/attendance/staff/monthly?schoolId=${schoolId}&month=${month}`),
    saveResults: (body: any) =>
      req<{ saved: number }>('/attendance/results/save', { method: 'POST', body: JSON.stringify(body) }),
    reportCard: (studentId: string, year: string) =>
      req<any>(`/attendance/results/reportcard?studentId=${studentId}&year=${year}`),
    classResults: (schoolId: string, grade: number, examType: string, year: string, section?: string) =>
      req<any>(`/attendance/results/class?schoolId=${schoolId}&grade=${grade}&examType=${examType}&year=${year}${section ? `&section=${section}` : ''}`),
    today: (schoolId?: string) =>
      req<any>(`/attendance/today${schoolId ? `?schoolId=${schoolId}` : ''}`),
    studentMe: () =>
      req<any>('/attendance/students/me'),
    children: () =>
      req<any>('/attendance/children'),
  },

  content: {
    stats: () => req<any>('/content/stats'),
    channels: () => req<any>('/content/channels'),
    subjects: (standard: number) => req<any>(`/content/subjects?standard=${standard}`),
    lectures: (standard: number, subject: string, opts?: { search?: string; date?: string; page?: number }) => {
      const qs = new URLSearchParams({ standard: String(standard), subject });
      if (opts?.search) qs.set('search', opts.search);
      if (opts?.date) qs.set('date', opts.date);
      if (opts?.page) qs.set('page', String(opts.page));
      return req<any>(`/content/lectures?${qs}`);
    },
    setUrl: (id: string, youtubeUrl: string | null) =>
      req<any>(`/content/lectures/${id}/url`, { method: 'PATCH', body: JSON.stringify({ youtubeUrl }) }),
  },
};

interface PeopleFilter {
  districtId?: string;
  blockId?: string;
  schoolId?: string;
}

/** Build a query string, dropping undefined/empty/false values. */
function qstr(params: object): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '' && v !== false)
    .map(([k, v]) => [k, String(v)] as [string, string]);
  const qs = new URLSearchParams(entries).toString();
  return qs ? `?${qs}` : '';
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  districtId: string | null;
  district: string | null;
  blockId: string | null;
  block: string | null;
  schoolId: string | null;
  school: string | null;
  createdAt: string;
}

export interface NewUser {
  email: string;
  name: string;
  password: string;
  role: string;
  districtId?: string | null;
  blockId?: string | null;
  schoolId?: string | null;
}
