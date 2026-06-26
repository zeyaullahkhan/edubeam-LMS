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
