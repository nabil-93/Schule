# Ultimate School Dashboard

Enterprise-grade school management dashboard — Next.js 14 + TypeScript + Tailwind.

## Prerequisites

**Node.js 20 LTS** is required. Download from <https://nodejs.org/> (LTS, Windows installer).
After installing, close and reopen your terminal so `node` and `npm` are on the PATH.

Verify:
```bash
node -v   # should print v20.x
npm -v
```

## Setup

```bash
npm install
npm run dev
```

Open <http://localhost:3000> → you will be redirected to `/fr` (French is the default language).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server (hot reload) |
| `npm run build` | Production build |
| `npm start` | Run the built app |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Current status

- ✅ Step 2 — Foundation (Next.js 14 App Router, TS, Tailwind, i18n, theme)
- ✅ Step 3 — Core UI (Sidebar, Topbar, language selector FR/EN/DE/AR, light-default theme toggle)
- ⏳ Step 4 — Profile system
- ⏳ Step 5 — Students / Teachers / Classes CRUD
- ⏳ Step 6 — Schedule / Exams / Finance / Notifications
- ⏳ Step 7 — Supabase integration
- ⏳ Step 8 — Polish + responsive + RTL

## Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + custom design tokens (HSL CSS vars)
- **i18n**: next-intl (FR default, EN/DE/AR, RTL for AR)
- **Theme**: next-themes (**light mode default**, dark optional, persisted)
- **Icons**: lucide-react
- **Charts**: recharts
- **Forms (coming)**: react-hook-form + zod

## Project structure

```
src/
├── app/
│   ├── layout.tsx                 # Root pass-through
│   └── [locale]/
│       ├── layout.tsx             # html/body, providers, i18n
│       └── (dashboard)/
│           ├── layout.tsx         # Sidebar + Topbar shell
│           ├── page.tsx           # Overview (KPIs, trend, activity)
│           ├── students/
│           ├── teachers/
│           ├── classes/
│           ├── schedule/
│           ├── exams/
│           ├── finance/
│           ├── communication/
│           ├── profile/
│           └── settings/
├── components/
│   ├── layout/     (Sidebar, Topbar, ThemeToggle, LanguageSelector, UserMenu)
│   ├── providers/  (ThemeProvider)
│   ├── ui/         (Card, Button, Badge, Avatar, Input)
│   ├── charts/     (KpiCard, TrendChart)
│   └── shared/     (PagePlaceholder)
├── i18n/           (routing.ts, request.ts)
├── lib/            (utils.ts)
├── middleware.ts
messages/          (fr.json, en.json, de.json, ar.json)
```
