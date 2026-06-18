# Edubeam LMS — Roadmap

Phased delivery of all 18 feature categories on one architecture.
**Phase 0 + Phase 1 are implemented today.**

| Phase | Scope | Feature categories | Status |
|---|---|---|---|
| **0 — Foundation** | Monorepo, NestJS skeleton, Prisma+DB, React shell, JWT auth, multi-tenant + RBAC | #1 (partial), #17 (partial) | ✅ Done |
| **1 — Data & Monitoring** | Excel importers, district/block/school drill-down dashboards, board-result analytics, Virtual/ICT coverage, CSV/PDF export | #7, #11, #18 (state/district analytics) | ✅ Done |
| **1b — Analytics Hub** | 9-category KPI hub (Student, Teacher, Content, Assessment, Virtual Classroom, Admin, Parent, AI Insights, Govt Project KPIs) with State→District→Block→School drill-down; real metrics from seeded data + clearly-tagged **Sample** values for not-yet-tracked KPIs; 6-month trend chart | #7, #11, #13 (preview), #14 (preview), #18 | ✅ Done |
| **2 — User Management & Admin** | Registration/onboarding, bulk upload, profiles, batch/section, academic calendar, timetable, multi-campus, audit logs | #1, #15 | ⏳ Planned |
| **3 — Course & Content** | Courses, curriculum/lessons, pathways, versioning; content upload, digital library, SCORM/xAPI | #2, #3 | ⏳ Planned |
| **4 — Live Classroom & Attendance** | Lecture scheduling, video conferencing, attendance, recording/playback, absentee alerts | #4, #8 | ⏳ Planned |
| **5 — Assessments & Assignments** | Quiz/exam builder, question bank, auto-grading, proctoring; assignment submission, rubrics | #5, #6 | ⏳ Planned |
| **6 — Communication, Certs, Parent Portal** | Announcements, forums, chat; certificates, badges; parent portal | #9, #10, #14 | ⏳ Planned |
| **7 — Advanced Analytics & AI** | Competency reporting, personalized learning, adaptive assessments, chatbot, auto-tagging | #13 | ⏳ Planned |
| **8 — Mobile Apps** | Capacitor Android + iOS, offline content, push, mobile assessments | #12 | ⏳ Planned |
| **9 — Integrations & Compliance** | SSO, ERP/SIS, payments, email/SMS, public API, govt portals; encryption, backup/DR, GDPR/DPDP | #16, #17 | ⏳ Planned |

Multi-language & state-board curriculum alignment (#18) layer across the content phases.

## Analytics Hub — metric sourcing

The Analytics Hub (Phase 1b) covers the full KPI framework from the project brief.
Each metric is tagged by source so stakeholders can tell live data from projections:

- **REAL** — computed from seeded data: registered students (enrollment), teachers
  (ICT deployment counts), schools/Virtual/ICT coverage, board pass % and subject
  scores, and the Reach/Access Govt KPIs.
  Year-over-year improvement and the **5-Year Board Result Trend** (Class 10 & 12
  Total-pass-% by year, 2020–2025) are now REAL, sourced from `yearly.xlsx`.
- **SAMPLE** — deterministic, scope-scaled placeholder values for KPIs that require
  usage/event tracking introduced in later phases (DAU/MAU, session duration, watch
  time, live-lecture hours, assignment/parent engagement, AI insights, etc.). These
  become real as Phases 2–9 land the underlying event data.
