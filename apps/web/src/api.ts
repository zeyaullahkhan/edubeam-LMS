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
  boys: number;
  girls: number;
  teachers: number;
  avgPass10th: number | null;
  avgPass12th: number | null;
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
  phone2: string | null;
  teachers: number | null;
  students: number | null;
  enrolledStudents: number | null;
  boys: number | null;
  girls: number | null;
  avgPass10th: number | null;
  avgPass12th: number | null;
  // Infrastructure
  campusArea: number | null;
  campusAreaUnit: string | null;
  builtUpArea: number | null;
  numBuildings: number | null;
  numClassrooms: number | null;
  hasPlayground: boolean | null;
  hasBoundaryWall: boolean | null;
  hasLibrary: boolean | null;
  hasLaboratory: boolean | null;
  hasComputerLab: boolean | null;
  hasSmartClassroom: boolean | null;
  hasElectricity: boolean | null;
  hasInternet: boolean | null;
  hasCctv: boolean | null;
  // Water & Sanitation
  hasDrinkingWater: boolean | null;
  drinkingWaterSource: string | null;
  numToilets: number | null;
  numBoysToilets: number | null;
  numGirlsToilets: number | null;
  hasCwsnToilet: boolean | null;
  hasHandwashing: boolean | null;
  // Academic
  classesFrom: number | null;
  classesTo: number | null;
  streams: string | null;
  // Safety
  hasFireSafety: boolean | null;
  hasDisasterPlan: boolean | null;
  hasFirstAid: boolean | null;
  hasSecurityGuard: boolean | null;
  emergencyContact: string | null;
  // General Info (extended)
  registrationNumber: string | null;
  email: string | null;
  yearEstablished: number | null;
  assemblyConstituency: string | null;
  gramPanchayat: string | null;
  managedBy: string | null;
  mediumOfInstruction: string | null;
  // Computer Lab
  numDesktopPCs: number | null;
  hasUPS: boolean | null;
  hasInternetConnectivity: boolean | null;
  // Hostel
  numHostelStudentRooms: number | null;
  hostelStudentCapacity: number | null;
  numHostelStudents: number | null;
  // Profile tracking
  profileUpdatedBy: string | null;
  profileUpdatedAt: string | null;
  // Detail-only (returned by GET /schools/:id)
  enrollments?: { grade: number; boys: number; girls: number; total: number }[];
  boardResults?: { examType: string; subject: string; passPct: number; academicYear: string }[];
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
  // Infrastructure
  campusArea?: number | null;
  campusAreaUnit?: string;
  builtUpArea?: number | null;
  numBuildings?: number | null;
  numClassrooms?: number | null;
  hasPlayground?: boolean | null;
  hasBoundaryWall?: boolean | null;
  hasLibrary?: boolean | null;
  hasLaboratory?: boolean | null;
  hasComputerLab?: boolean | null;
  hasSmartClassroom?: boolean | null;
  hasElectricity?: boolean | null;
  hasInternet?: boolean | null;
  hasCctv?: boolean | null;
  // Water & Sanitation
  hasDrinkingWater?: boolean | null;
  drinkingWaterSource?: string;
  numToilets?: number | null;
  numBoysToilets?: number | null;
  numGirlsToilets?: number | null;
  hasCwsnToilet?: boolean | null;
  hasHandwashing?: boolean | null;
  // Academic
  classesFrom?: number | null;
  classesTo?: number | null;
  streams?: string;
  // Safety
  hasFireSafety?: boolean | null;
  hasDisasterPlan?: boolean | null;
  hasFirstAid?: boolean | null;
  hasSecurityGuard?: boolean | null;
  emergencyContact?: string;
}

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => req<AuthUser>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  snapshot: () => req<{
    overview: Overview;
    districts: DistrictSummary[];
    mapDistricts: DistrictSummary[];
    enrollment: EnrollmentDemographics;
    teacherStats: TeacherStats;
    todayAtt: any;
    holidays: any[];
  }>('/analytics/snapshot'),
  overview: () => req<Overview>('/analytics/overview'),
  districts: () => req<DistrictSummary[]>('/analytics/districts'),
  mapDistricts: () => req<DistrictSummary[]>('/analytics/map-districts'),
  blocks: (districtId: string) => req<BlockSummary[]>(`/analytics/blocks?districtId=${districtId}`),
  subjects: (examType: '10TH' | '12TH') =>
    req<SubjectAverage[]>(`/analytics/subjects?examType=${examType}`),
  enrollment: (scope?: { districtId?: string; blockId?: string; schoolId?: string }) => {
    const qs = scope ? new URLSearchParams(Object.entries(scope).filter(([, v]) => v) as [string, string][]).toString() : '';
    return req<EnrollmentDemographics>(`/analytics/enrollment${qs ? `?${qs}` : ''}`);
  },
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
  school: (id: string) => req<SchoolRow>(`/schools/${id}`),
  schoolDistricts: () => req<DistrictMeta[]>('/schools/meta/districts'),
  createSchool: (body: SchoolFormData) =>
    req<SchoolRow>('/schools', { method: 'POST', body: JSON.stringify(body) }),
  updateSchool: (id: string, body: Partial<SchoolFormData>) =>
    req<SchoolRow>(`/schools/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Academic Years (tenant-wide — common for entire state)
  academicYears: () => req<any[]>(`/schools/academic-years`),
  createAcademicYear: (body: { label: string; startDate: string; endDate: string; tenantId?: string }) =>
    req<any>(`/schools/academic-years`, { method: 'POST', body: JSON.stringify(body) }),
  updateAcademicYear: (id: string, body: { label: string; startDate: string; endDate: string }) =>
    req<any>(`/schools/academic-years/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  setCurrentAcademicYear: (id: string) =>
    req<any>(`/schools/academic-years/${id}/set-current`, { method: 'PATCH', body: '{}' }),
  deleteAcademicYear: (id: string) =>
    req<{ ok: boolean }>(`/schools/academic-years/${id}`, { method: 'DELETE' }),
  tenants: () => req<{ id: string; name: string }[]>(`/auth/tenants`),

  // Class Sections
  classSections: (schoolId: string, academicYear?: string) =>
    req<any[]>(`/schools/${schoolId}/class-sections${academicYear ? `?academicYear=${academicYear}` : ''}`),
  bulkCreateClassSections: (body: { schoolId?: string; districtId?: string; blockId?: string; academicYear: string; gradeFrom: number; gradeTo: number; sections: string[]; capacity?: number }) =>
    req<{ created: number; skipped: number; schools: number }>(`/schools/class-sections/bulk`, { method: 'POST', body: JSON.stringify(body) }),
  createClassSection: (schoolId: string, body: any) =>
    req<any>(`/schools/${schoolId}/class-sections`, { method: 'POST', body: JSON.stringify(body) }),
  updateClassSection: (id: string, body: any) =>
    req<any>(`/schools/class-sections/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteClassSection: (id: string) =>
    req<{ ok: boolean }>(`/schools/class-sections/${id}`, { method: 'DELETE' }),

  // Subjects (state-wide catalog)
  schoolSubjects: (tenantId?: string) =>
    req<any[]>(`/schools/subjects${tenantId ? `?tenantId=${tenantId}` : ''}`),
  createSubject: (body: any) =>
    req<any>(`/schools/subjects`, { method: 'POST', body: JSON.stringify(body) }),
  bulkCreateSubjects: (body: { tenantId?: string; subjects: any[] }) =>
    req<{ created: number; skipped: number }>(`/schools/subjects/bulk`, { method: 'POST', body: JSON.stringify(body) }),
  updateSubject: (id: string, body: any) =>
    req<any>(`/schools/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSubject: (id: string) =>
    req<any>(`/schools/subjects/${id}`, { method: 'DELETE' }),

  // Subject Assignments
  sectionAssignments: (classSectionId: string) =>
    req<any[]>(`/schools/class-sections/${classSectionId}/assignments`),
  createAssignment: (classSectionId: string, body: any) =>
    req<any>(`/schools/class-sections/${classSectionId}/assignments`, { method: 'POST', body: JSON.stringify(body) }),
  deleteAssignment: (id: string) =>
    req<{ ok: boolean }>(`/schools/assignments/${id}`, { method: 'DELETE' }),

  // Notices
  notices: (params: { schoolId?: string; tenantId?: string; districtId?: string; blockId?: string }) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return req<any[]>(`/planner/notices${qs ? `?${qs}` : ''}`);
  },
  createNotice: (body: { title: string; description?: string; type?: string; publishDate: string; expiryDate?: string; scope?: string; schoolId?: string; blockId?: string; districtId?: string; tenantId?: string }) =>
    req<any>('/planner/notices', { method: 'POST', body: JSON.stringify(body) }),
  updateNotice: (id: string, body: any) =>
    req<any>(`/planner/notices/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteNotice: (id: string) =>
    req<{ ok: boolean }>(`/planner/notices/${id}`, { method: 'DELETE' }),
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
    schoolLogin: (schoolId: string) => req<{ hasLogin: boolean; email: string | null }>(`/users/school-login/${schoolId}`),
    upsertSchoolLogin: (schoolId: string) => req<{ email: string; password: string }>(`/users/school-login/${schoolId}`, { method: 'POST' }),
    upsertStudentLogin: (studentId: string) => req<{ email: string; password: string }>(`/users/student-login/${studentId}`, { method: 'POST' }),
    upsertParentLogin: (studentId: string) => req<{ email: string; password: string }>(`/users/parent-login/${studentId}`, { method: 'POST' }),
  },
  students: {
    list: (params: PeopleFilter & { grade?: number; gender?: string; q?: string; rte?: boolean; dropout?: boolean } = {}) =>
      req<Student[]>(`/students${qstr(params)}`),
    summary: (params: PeopleFilter = {}) => req<StudentDemographics>(`/students/summary${qstr(params)}`),
    create: (body: Partial<Student> & { schoolId?: string }) =>
      req<{ id: string; studentLogin: { email: string; password: string }; parentLogin: { email: string; password: string } }>('/students', { method: 'POST', body: JSON.stringify(body) }),
    bulk: (schoolId: string | undefined, rows: Partial<Student>[]) =>
      req<{ inserted: number; skipped: number }>('/students/bulk', { method: 'POST', body: JSON.stringify({ schoolId, rows }) }),
    promote: (schoolId?: string, grade?: number) =>
      req<{ promoted: number; graduated: number }>('/students/promote', { method: 'POST', body: JSON.stringify({ schoolId, grade }) }),
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
    clearStudents: (body: { schoolId?: string; date: string; studentIds?: string[]; grade?: number }) =>
      req<{ cleared: number; date: string }>('/attendance/students/clear', { method: 'POST', body: JSON.stringify(body) }),
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
    todayDrilldown: () =>
      req<any[]>('/attendance/today-drilldown'),
    studentMe: () =>
      req<any>('/attendance/students/me'),
    children: () =>
      req<any>('/attendance/children'),
    createHoliday: (body: { title: string; description?: string; startDate: string; endDate: string; scope: string; scopeId: string }) =>
      req<any>('/attendance/holidays', { method: 'POST', body: JSON.stringify(body) }),
    holidays: (schoolId: string, month?: string) =>
      req<any[]>(`/attendance/holidays?schoolId=${schoolId}${month ? `&month=${month}` : ''}`),
    deleteHoliday: (id: string) =>
      req<{ ok: boolean }>(`/attendance/holidays/${id}`, { method: 'DELETE' }),
    applyLeave: (body: { startDate: string; endDate: string; reason: string; remarks?: string }) =>
      req<any>('/attendance/leave/apply', { method: 'POST', body: JSON.stringify(body) }),
    myLeaves: () =>
      req<{ leaves: any[] }>('/attendance/leave/my'),
    schoolLeaves: (schoolId?: string, status?: string) =>
      req<{ leaves: any[] }>(`/attendance/leave/school${qstr({ schoolId, status })}`),
    approveLeave: (id: string, remarks?: string) =>
      req<any>(`/attendance/leave/${id}/approve`, { method: 'PUT', body: JSON.stringify({ remarks }) }),
    rejectLeave: (id: string, remarks?: string) =>
      req<any>(`/attendance/leave/${id}/reject`, { method: 'PUT', body: JSON.stringify({ remarks }) }),
  },

  planner: {
    scopeOptions: () =>
      req<{ tenants: any[]; districts: any[]; blocks: any[] }>('/planner/scope-options'),
    holidays: (month?: string) =>
      req<any[]>(`/planner/holidays${month ? `?month=${month}` : ''}`),
    upcoming: (limit = 5) =>
      req<any[]>(`/planner/holidays/upcoming?limit=${limit}`),
    createHoliday: (body: {
      title: string; description?: string; startDate: string; endDate: string;
      scopeLevel?: string; scopeTargetId?: string;
    }) =>
      req<any>('/planner/holidays', { method: 'POST', body: JSON.stringify(body) }),
    deleteHoliday: (id: string) =>
      req<{ ok: boolean }>(`/planner/holidays/${id}`, { method: 'DELETE' }),
    events: (month?: string) =>
      req<any[]>(`/planner/events${month ? `?month=${month}` : ''}`),
    createEvent: (body: {
      title: string; description?: string; type?: string;
      date: string; endDate?: string; urgent?: boolean;
      scopeLevel?: string; scopeTargetId?: string;
    }) =>
      req<any>('/planner/events', { method: 'POST', body: JSON.stringify(body) }),
    deleteEvent: (id: string) =>
      req<{ ok: boolean }>(`/planner/events/${id}`, { method: 'DELETE' }),
  },

  quiz: {
    list: (params: { schoolId?: string; grade?: number } = {}) =>
      req<any[]>(`/quiz${qstr(params)}`),
    get: (id: string) => req<any>(`/quiz/${id}`),
    create: (body: { schoolId?: string; scope?: string; blockId?: string; districtId?: string; title: string; description?: string; subject: string; grade: number; section?: string; dueDate?: string }) =>
      req<any>('/quiz', { method: 'POST', body: JSON.stringify(body) }),
    setQuestions: (id: string, questions: { question: string; options: string[]; correct: number; marks?: number; explanation?: string }[]) =>
      req<any>(`/quiz/${id}/questions`, { method: 'POST', body: JSON.stringify({ questions }) }),
    submitAttempt: (id: string, body: { answers: Record<string, number>; timeTaken?: number }) =>
      req<any>(`/quiz/${id}/attempt`, { method: 'POST', body: JSON.stringify(body) }),
    results: (id: string) => req<any>(`/quiz/${id}/results`),
    review: (id: string) => req<any>(`/quiz/${id}/review`),
    stats: (params: { tenantId?: string; districtId?: string; blockId?: string; schoolId?: string } = {}) =>
      req<any>(`/quiz/stats${qstr(params)}`),
    generate: (body: {
      sourceKind: 'pdf' | 'image' | 'text'; fileBase64?: string; mediaType?: string; text?: string;
      subject: string; grade: number; numQuestions: number; totalMarks: number;
      difficulty: 'Easy' | 'Medium' | 'Hard';
    }) =>
      req<{ questions: { question: string; options: string[]; correct: number; marks: number; explanation?: string }[]; provider: string }>(
        '/quiz/generate', { method: 'POST', body: JSON.stringify(body) }),
    toggle: (id: string) => req<any>(`/quiz/${id}/toggle`, { method: 'PATCH' }),
    remove: (id: string) => req<any>(`/quiz/${id}`, { method: 'DELETE' }),
  },

  content: {
    stats: () => req<any>('/content/stats'),
    channels: () => req<any>('/content/channels'),
    subjects: (standard: number) => req<any>(`/content/subjects?standard=${standard}`),
    allSubjects: () => req<string[]>('/content/all-subjects'),
    lectures: (standard: number, subject: string, opts?: { search?: string; date?: string; page?: number }) => {
      const qs = new URLSearchParams({ standard: String(standard), subject });
      if (opts?.search) qs.set('search', opts.search);
      if (opts?.date) qs.set('date', opts.date);
      if (opts?.page) qs.set('page', String(opts.page));
      return req<any>(`/content/lectures?${qs}`);
    },
    setUrl: (id: string, youtubeUrl: string | null) =>
      req<any>(`/content/lectures/${id}/url`, { method: 'PATCH', body: JSON.stringify({ youtubeUrl }) }),
    createLecture: (body: {
      topic: string; teacherName: string; subject: string; standard: number;
      studioName: string; date: string; startTime: string; endTime: string;
      medium?: string; youtubeUrl?: string | null;
    }) => req<any>('/content/lectures', { method: 'POST', body: JSON.stringify(body) }),
    updateLecture: (id: string, body: Partial<{
      topic: string; teacherName: string; subject: string; standard: number;
      studioName: string; date: string; startTime: string; endTime: string;
      medium: string; youtubeUrl: string | null;
    }>) => req<any>(`/content/lectures/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteLecture: (id: string) =>
      req<{ ok: boolean }>(`/content/lectures/${id}`, { method: 'DELETE' }),
    schedule: (from: string, to: string) =>
      req<any[]>(`/content/schedule?from=${from}&to=${to}`),
    importSchedule: (rows: any[]) =>
      req<{ inserted: number; replacedStudios: number; replacedFrom: string | null; replacedTo: string | null }>(
        '/content/lectures/import', { method: 'POST', body: JSON.stringify({ rows }) }),
  },

  storage: {
    presign: (folder: string, fileName: string, contentType: string) =>
      req<{ uploadUrl: string; publicUrl: string; key: string }>('/storage/presign', {
        method: 'POST',
        body: JSON.stringify({ folder, fileName, contentType }),
      }),

    deleteFile: (key: string) =>
      req<{ ok: boolean }>(`/storage/file?key=${encodeURIComponent(key)}`, { method: 'DELETE' }),

    /** Presign then PUT the file directly to S3. Returns the public URL. */
    upload: async (file: File, folder: string, onProgress?: (pct: number) => void): Promise<string> => {
      const { uploadUrl, publicUrl } = await api.storage.presign(folder, file.name, file.type || 'application/octet-stream');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        if (onProgress) {
          xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
        }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error('Upload network error'));
        xhr.send(file);
      });
      if (onProgress) onProgress(1);
      return publicUrl;
    },
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
