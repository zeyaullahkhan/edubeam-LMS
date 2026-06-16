import { useState } from 'react';
import { Students } from './Students';
import { Staff } from './Staff';

type Section = 'students' | 'staff';

const SECTIONS: { id: Section; label: string; icon: string; description: string }[] = [
  { id: 'students', label: 'Students',  icon: 'fas fa-user-graduate',       description: 'Enrolment, attendance & academics' },
  { id: 'staff',    label: 'Staff',     icon: 'fas fa-chalkboard-teacher',   description: 'Teachers, faculty & admin staff' },
];

export function People() {
  const [section, setSection] = useState<Section>('students');

  return (
    <div className="space-y-5">
      {/* ── Section switcher ────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl border text-left transition-all duration-200 ${
              section === s.id
                ? 'bg-navy-800 border-navy-800 text-white shadow-brand-md'
                : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:shadow-sm'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              section === s.id ? 'bg-white/15' : 'bg-slate-100'
            }`}>
              <i className={`${s.icon} text-sm ${section === s.id ? 'text-white' : 'text-slate-500'}`} />
            </div>
            <div className="leading-tight">
              <div className={`font-semibold text-sm ${section === s.id ? 'text-white' : 'text-navy-700'}`}>
                {s.label}
              </div>
              <div className={`text-xs mt-0.5 ${section === s.id ? 'text-sky-200' : 'text-slate-400'}`}>
                {s.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Section content ──────────────────────────────────── */}
      {section === 'students' && <Students />}
      {section === 'staff'    && <Staff />}
    </div>
  );
}
