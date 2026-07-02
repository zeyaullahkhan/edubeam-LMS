import { createContext, useContext, useState, type ReactNode } from 'react';
import { ACADEMIC_YEAR } from '@edubeam/shared';

interface AcademicYearCtx {
  academicYear: string;
  setAcademicYear: (y: string) => void;
}

const Ctx = createContext<AcademicYearCtx>({
  academicYear: ACADEMIC_YEAR,
  setAcademicYear: () => {},
});

const STORAGE_KEY = 'edubeam_academic_year';

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const [academicYear, setYear] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? ACADEMIC_YEAR; } catch { return ACADEMIC_YEAR; }
  });

  const setAcademicYear = (y: string) => {
    setYear(y);
    try { localStorage.setItem(STORAGE_KEY, y); } catch { /* ignore */ }
  };

  return <Ctx.Provider value={{ academicYear, setAcademicYear }}>{children}</Ctx.Provider>;
}

export function useAcademicYear() {
  return useContext(Ctx);
}

export const YEAR_OPTIONS = ['2024-25', '2025-26', '2026-27', '2027-28'];
