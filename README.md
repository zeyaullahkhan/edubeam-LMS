# Edubeam LMS

Multi-tenant Learning Management System for government schools — built for
**Edubeam (Valuable Group)**. Phase 0 + Phase 1 are implemented: foundation,
real-data ingestion, and the **Monitoring & Analytics dashboards**. The full
18-category roadmap lives in [`docs/ROADMAP.md`](docs/ROADMAP.md).

Launched with **Uttarakhand 2025-26** as the first tenant, seeded from real
project data (500 Virtual Classroom + ICT Lab schools, 10th/12th board results).

## Stack

| Layer | Tech |
|---|---|
| Web | React + TypeScript, Vite, Tailwind, Recharts, React Router |
| API | NestJS (REST), JWT auth, RBAC scoping |
| Data | Prisma ORM. **SQLite for local dev**, PostgreSQL in production |
| Monorepo | npm workspaces (`apps/*`, `packages/*`) |

> Local dev uses SQLite for zero-setup. For production, change `provider` in
> `packages/db/prisma/schema.prisma` to `postgresql` and set `DATABASE_URL`.

## Layout

```
apps/web      React monitoring dashboard (login, KPIs, district drill-down, schools)
apps/api      NestJS API: auth, analytics, schools (RBAC-scoped)
packages/db   Prisma schema + Excel seed importer (data/*.xlsx)
packages/shared  Shared types, roles, scope helpers
```

## Setup

```bash
npm install
npm run db:generate     # generate Prisma client
npm run db:push         # create the SQLite schema
npm run db:seed         # import the 3 Excel files + demo users
```

The importer loads `packages/db/data/{virtual,ict,results,yearly}.xlsx`. UDISE codes
are normalised (leading zeros stripped) so each school joins across all files into
a single record. `yearly.xlsx` adds 5 years (2020–2025) of board Total-pass-% history
(matched to the 500 schools) powering the real year-over-year trend.

## Run

```bash
npm run dev:api   # API on http://localhost:3001/api
npm run dev:web   # Web on http://localhost:5173  (proxies /api -> 3001)
```

## Demo accounts (password: `password123`)

| Email | Role | Scope |
|---|---|---|
| `admin@edubeam.in` | Administrator | tenant-wide |
| `state@edubeam.in` | State Official | all 14 districts |
| `almora@edubeam.in` | District Official | Almora only |
| `principal@edubeam.in` | Principal | GIC Barechhina only |

RBAC is enforced server-side: a district official sees only their district, a
principal only their school.

### Administrator console

The **ADMIN** role (`admin@edubeam.in`) has full tenant-wide visibility plus a
**Users** tab (`/admin/users`) to manage the application:

- Create users with a role and geographic scope (district officials require a
  district; principals/teachers/students/parents require a school).
- Activate / deactivate accounts (inactive users cannot log in).
- Reset passwords and delete users.

All `/users` endpoints are guarded by `AdminGuard` — non-admins get 403.

## Verified

- Import: 500 schools, 14 districts, 99 blocks, 3,426 enrollment rows, 5,770 board results.
- Analytics: 10th-grade Hindi avg pass = 94.6% across 419 schools (matches source workbook).
- Scoping: State → 500 schools, Almora district → 103, principal → 1.
