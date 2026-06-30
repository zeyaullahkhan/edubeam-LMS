import * as XLSX from 'xlsx';

/** Download a workbook as .xlsx */
export function downloadXlsx(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

/** Generate and download the student bulk-upload template */
export function downloadStudentTemplate() {
  const cols = [
    // Basic Info
    { k: 'name',              h: 'Full Name*',           ex: 'Ravi Kumar' },
    { k: 'gender',            h: 'Gender* (M/F)',         ex: 'M' },
    { k: 'grade',             h: 'Grade/Class* (6-12)',   ex: '9' },
    { k: 'section',           h: 'Section',               ex: 'A' },
    { k: 'rollNo',            h: 'Roll No',               ex: '101' },
    { k: 'admissionNo',       h: 'Admission No',          ex: 'ADM2025001' },
    { k: 'dateOfBirth',       h: 'Date of Birth (YYYY-MM-DD)', ex: '2010-04-15' },
    { k: 'aadhaarNo',         h: 'Aadhaar No',            ex: '1234 5678 9012' },
    { k: 'bloodGroup',        h: 'Blood Group',           ex: 'B+' },
    { k: 'nationality',       h: 'Nationality',           ex: 'Indian' },
    { k: 'motherTongue',      h: 'Mother Tongue',         ex: 'Hindi' },
    { k: 'category',          h: 'Category (GEN/OBC/SC/ST)', ex: 'GEN' },
    { k: 'religion',          h: 'Religion',              ex: 'Hindu' },
    { k: 'isRte',             h: 'RTE (Yes/No)',          ex: 'No' },
    { k: 'admissionDate',     h: 'Admission Date (YYYY-MM-DD)', ex: '2025-04-01' },
    { k: 'house',             h: 'House',                 ex: 'Blue' },
    // Family
    { k: 'fatherName',        h: "Father's Name",         ex: 'Suresh Kumar' },
    { k: 'fatherPhone',       h: "Father's Phone",        ex: '9876543210' },
    { k: 'fatherOccupation',  h: "Father's Occupation",   ex: 'Farmer' },
    { k: 'fatherEducation',   h: "Father's Education",    ex: 'Graduate' },
    { k: 'motherName',        h: "Mother's Name",         ex: 'Sunita Kumar' },
    { k: 'motherPhone',       h: "Mother's Phone",        ex: '9876543211' },
    { k: 'motherOccupation',  h: "Mother's Occupation",   ex: 'Homemaker' },
    { k: 'motherEducation',   h: "Mother's Education",    ex: 'Intermediate' },
    { k: 'guardianName',      h: 'Guardian Name',         ex: '' },
    { k: 'guardianPhone',     h: 'Guardian Phone',        ex: '' },
    { k: 'guardianRelation',  h: 'Guardian Relation',     ex: 'Father' },
    { k: 'annualIncome',      h: 'Annual Family Income',  ex: '120000' },
    // Address
    { k: 'stateAddr',         h: 'State',                 ex: 'Uttarakhand' },
    { k: 'districtAddr',      h: 'District',              ex: 'Dehradun' },
    { k: 'blockAddr',         h: 'Block',                 ex: 'Rajpur' },
    { k: 'village',           h: 'Village / Town',        ex: 'Sahastradhara' },
    { k: 'pinCode',           h: 'PIN Code',              ex: '248001' },
    { k: 'permanentAddress',  h: 'Permanent Address',     ex: 'House No. 12, Sahastradhara, Dehradun' },
    { k: 'correspondenceAddress', h: 'Correspondence Address', ex: '' },
    // Academic
    { k: 'previousSchool',    h: 'Previous School',       ex: 'GPS Rajpur' },
    { k: 'medium',            h: 'Medium of Instruction', ex: 'Hindi' },
    { k: 'subjectsOpted',     h: 'Subjects Opted',        ex: 'Science,Maths' },
    // Health
    { k: 'height',            h: 'Height (cm)',           ex: '152' },
    { k: 'weight',            h: 'Weight (kg)',           ex: '42' },
    { k: 'vaccinationStatus', h: 'Vaccination Status',    ex: 'Complete' },
    // Hostel
    { k: 'hostelRequired',    h: 'Hostel Required (Yes/No)', ex: 'No' },
  ];

  const headers = cols.map(c => c.h);
  const example = cols.map(c => c.ex);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  // Column widths
  ws['!cols'] = cols.map(() => ({ wch: 22 }));

  // Style header row bold (xlsx lite approach via cell metadata)
  cols.forEach((_, i) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[addr]) ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'D0E4F7' } } };
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  // Instructions sheet
  const instr = XLSX.utils.aoa_to_sheet([
    ['STUDENT BULK UPLOAD TEMPLATE — Instructions'],
    [''],
    ['1. Fill data starting from row 3 (row 2 is the example row — you may clear it).'],
    ['2. Columns marked * are required; others are optional.'],
    ['3. Gender: use M for Male, F for Female.'],
    ['4. Category: GEN, OBC, SC, ST.'],
    ['5. Grade: numeric class number (6 to 12).'],
    ['6. Dates must be in YYYY-MM-DD format (e.g. 2010-04-15).'],
    ['7. Do not rename or reorder column headers.'],
    ['8. Save as .xlsx and upload via the Bulk Upload button.'],
  ]);
  XLSX.utils.book_append_sheet(wb, instr, 'Instructions');

  downloadXlsx(wb, 'student-bulk-upload-template.xlsx');
}

/** Generate and download the staff bulk-upload template */
export function downloadStaffTemplate() {
  const cols = [
    { k: 'name',          h: 'Full Name*',               ex: 'Dr. Priya Sharma' },
    { k: 'gender',        h: 'Gender* (M/F)',             ex: 'F' },
    { k: 'staffType',     h: 'Staff Type*',               ex: 'TEACHER' },
    { k: 'designation',   h: 'Designation',               ex: 'Lecturer' },
    { k: 'qualification', h: 'Qualification',             ex: 'M.Sc, B.Ed' },
    { k: 'subjects',      h: 'Subjects',                  ex: 'Physics,Chemistry' },
    { k: 'department',    h: 'Department',                ex: 'Science' },
    { k: 'employeeId',    h: 'Employee ID',               ex: 'EMP1001' },
    { k: 'phone',         h: 'Phone',                     ex: '9876543210' },
    { k: 'email',         h: 'Email',                     ex: 'priya@school.edu' },
    { k: 'aadhaarNo',     h: 'Aadhaar No',               ex: '1234 5678 9012' },
    { k: 'dateOfBirth',   h: 'Date of Birth (YYYY-MM-DD)', ex: '1985-06-15' },
    { k: 'joiningDate',   h: 'Joining Date (YYYY-MM-DD)', ex: '2015-07-01' },
    { k: 'salaryGroup',   h: 'Salary Group',              ex: 'Grade Pay 4200' },
    { k: 'contractType',  h: 'Contract Type',             ex: 'Regular' },
    { k: 'isClassTeacher',h: 'Class Teacher (Yes/No)',    ex: 'No' },
    { k: 'classTeacherOf',h: 'Class Teacher Of',          ex: '9A' },
    { k: 'address',       h: 'Address',                   ex: 'New Colony, Dehradun' },
    { k: 'bankAccount',   h: 'Bank Account No',           ex: '1234567890' },
    { k: 'ifscCode',      h: 'IFSC Code',                 ex: 'SBIN0001234' },
  ];

  const headers = cols.map(c => c.h);
  const example = cols.map(c => c.ex);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = cols.map(() => ({ wch: 22 }));

  cols.forEach((_, i) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[addr]) ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'D4EDDA' } } };
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Staff');

  const instr = XLSX.utils.aoa_to_sheet([
    ['STAFF BULK UPLOAD TEMPLATE — Instructions'],
    [''],
    ['1. Fill data from row 3 (row 2 is the example row).'],
    ['2. Columns marked * are required.'],
    ['3. Staff Type options: TEACHER, LAB_ASSISTANT, LIBRARIAN, PRINCIPAL, ADMIN_STAFF, OTHER.'],
    ['4. Gender: M for Male, F for Female.'],
    ['5. Class Teacher: Yes or No. If Yes, fill Class Teacher Of (e.g. 9A, 10B).'],
    ['6. Dates must be YYYY-MM-DD format.'],
    ['7. Do not rename or reorder column headers.'],
    ['8. Save as .xlsx and upload via the Bulk Upload button.'],
  ]);
  XLSX.utils.book_append_sheet(wb, instr, 'Instructions');

  downloadXlsx(wb, 'staff-bulk-upload-template.xlsx');
}

// ── Lecture schedule template + parser ──────────────────────────────────────
// One sheet per studio. Each sheet is a weekly/monthly grid:
//   Row 1: title       Row 2: "Schedule For …"
//   Row 3: Day | Date | <ClassA> | <ClassA> | <ClassB> | <ClassB>
//   Row 4:  -  |  -   | 10:00-10:40 | 10:40-11:20 | 11:20-12:00 | 12:00-12:40
//   Row 5+: <Weekday> | <DD-MM-YYYY> | "Subject\nTeacher" × 4
export const LECTURE_TIME_SLOTS = ['10:00-10:40', '10:40-11:20', '11:20-12:00', '12:00-12:40'];
export const STUDIO_TEMPLATE = [
  { studio: 1, sheet: 'Studio1', title: 'Schedule For Class 6th and 7th From Studio 1',  classes: ['Class VI', 'Class VII'] },
  { studio: 2, sheet: 'Studio2', title: 'Schedule For Class 8th and 9th From Studio 2',  classes: ['Class VIII', 'Class IX'] },
  { studio: 3, sheet: 'Studio3', title: 'Schedule For Class 10th and 11th From Studio 3', classes: ['Class X', 'Class XI'] },
  { studio: 4, sheet: 'Studio4', title: 'Schedule For Class 12th From Studio 4',          classes: ['Class XII', 'Class XII'] },
];
const CLASS_TO_STD: Record<string, number> = {
  'CLASS VI': 6, 'CLASS VII': 7, 'CLASS VIII': 8, 'CLASS IX': 9,
  'CLASS X': 10, 'CLASS XI': 11, 'CLASS XII': 12,
};
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Download a blank lecture-schedule template (4 studio sheets) for a given month. */
export function downloadLectureScheduleTemplate() {
  const wb = XLSX.utils.book_new();
  for (const st of STUDIO_TEMPLATE) {
    const aoa: any[][] = [
      ['Lecture Schedule'],
      [st.title],
      ['Day', 'Date', st.classes[0], st.classes[0], st.classes[1], st.classes[1]],
      [null, null, ...LECTURE_TIME_SLOTS],
      // Example week — duplicate/extend these rows for the full month.
      ...WEEKDAYS.map(d => [d, 'DD-MM-YYYY', 'Subject\nTeacher', 'Subject\nTeacher', 'Subject\nTeacher', 'Subject\nTeacher']),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, st.sheet);
  }
  const instr = XLSX.utils.aoa_to_sheet([
    ['How to fill the Lecture Schedule template'],
    [''],
    ['1. One sheet per studio (Studio1–Studio4). Do not rename the sheets.'],
    ['2. Keep rows 1–4 (titles, class headers, time slots) unchanged.'],
    ['3. From row 5: one row per teaching day.'],
    ['4. Date format: DD-MM-YYYY (e.g. 08-06-2026).'],
    ['5. Each subject cell: Subject name on line 1, Teacher name on line 2 (Alt+Enter).'],
    ['6. Leave a cell blank for a free period. Skip Sundays/holidays (omit the row).'],
    ['7. Save as .xlsx and use "Import Schedule" in the Lecture Schedule tab.'],
  ]);
  XLSX.utils.book_append_sheet(wb, instr, 'Instructions');
  downloadXlsx(wb, 'lecture-schedule-template.xlsx');
}

export interface ParsedLecture {
  srNo: number; date: string; studioName: string; medium: string;
  startTime: string; endTime: string; standard: number;
  teacherName: string; subject: string; topic: string;
}

/** Parse a filled lecture-schedule workbook (4 studio sheets) into Lecture rows. */
export async function parseLectureScheduleFile(file: File): Promise<{ rows: ParsedLecture[]; warnings: string[] }> {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: 'array', cellDates: false });
  const rows: ParsedLecture[] = [];
  const warnings: string[] = [];
  let sr = 1;

  for (const st of STUDIO_TEMPLATE) {
    const ws = wb.Sheets[st.sheet];
    if (!ws) { warnings.push(`Sheet "${st.sheet}" not found — skipped.`); continue; }
    const grid: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    // Locate the header row (has "Day" + "Date") and the time-slot row beneath it.
    const hIdx = grid.findIndex(r => String(r?.[0] ?? '').trim().toLowerCase() === 'day');
    if (hIdx < 0) { warnings.push(`${st.sheet}: header row not found — skipped.`); continue; }
    const classRow = grid[hIdx];
    const slotRow = grid[hIdx + 1] ?? [];
    const cols = [2, 3, 4, 5].map(c => ({
      std: CLASS_TO_STD[String(classRow[c] ?? '').trim().toUpperCase()] ?? null,
      slot: normalizeSlot(String(slotRow[c] ?? '')),
    }));

    for (let r = hIdx + 2; r < grid.length; r++) {
      const row = grid[r];
      if (!row) continue;
      const date = parseTemplateDate(row[1]);
      if (!date) continue; // skip rows without a usable date
      for (let c = 2; c <= 5; c++) {
        const cell = String(row[c] ?? '').trim();
        if (!cell) continue;
        const col = cols[c - 2];
        if (!col.std || !col.slot) { warnings.push(`${st.sheet} row ${r + 1}: bad class/slot header.`); continue; }
        const parts = cell.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const subject = parts[0] ?? '';
        const teacherName = parts[1] ?? '';
        if (!subject) continue;
        rows.push({
          srNo: sr++, date, studioName: st.sheet, medium: 'Hindi',
          startTime: col.slot[0], endTime: col.slot[1], standard: col.std,
          teacherName, subject, topic: subject,
        });
      }
    }
  }
  return { rows, warnings };
}

function normalizeSlot(raw: string): [string, string] | null {
  const m = raw.replace(/\s/g, '').match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  return m ? [m[1], m[2]] : null;
}

// Accepts an Excel serial number, a Date, or DD-MM-YYYY / YYYY-MM-DD string → "YYYY-MM-DD".
function parseTemplateDate(v: any): string | null {
  if (v == null || v === '' || String(v).toUpperCase().includes('DD-MM')) return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/); // DD-MM-YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Parse an uploaded Excel or CSV file and return rows as plain objects */
export async function parseUploadFile(file: File): Promise<Record<string, string>[]> {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
  // Normalise keys: lowercase, strip spaces/special chars
  return rows.map(row =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ''), String(v).trim()])
    )
  );
}
