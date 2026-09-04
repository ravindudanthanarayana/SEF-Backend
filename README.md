# RiceShare Backend

Express + TypeScript + Prisma REST API for [RiceShare](https://github.com/ravindudanthanarayana/SEF-Frontend) — a surplus-food marketplace for Sri Lanka. Handles auth (JWT, bcrypt-hashed passwords in Postgres), listings, and the Gemini-powered RiceShare Food Assistant.

## Tech stack

- Node.js + Express
- PostgreSQL (Neon) via Prisma 7 (`@prisma/adapter-pg`)
- JWT auth (`jsonwebtoken` + `bcryptjs`), no third-party auth provider
- Google Gemini (`@google/genai`) for the AI assistant, called server-side only

## Local setup

```bash
npm install
cp .env.example .env   # fill in real values
npm run db:generate
npm run db:push
npm run db:seed        # optional: sample providers + listings
npm run dev             # http://localhost:4000
```

## Environment variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon pooled connection) |
| `JWT_SECRET` | Long random string signing login tokens |
| `GEMINI_API_KEY` | From [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `FRONTEND_URL` | Comma-separated allowed CORS origin(s), e.g. your Vercel URL |
| `PORT` | Defaults to 4000; Railway sets this automatically |

## Scripts

```bash
npm run dev         # tsx watch src/index.ts
npm run build        # tsc -> dist/
npm run start        # node dist/src/index.js
npm run typecheck
npm run db:generate  # prisma generate
npm run db:push      # prisma db push
npm run db:seed      # prisma/seed.ts
```

## Deploying to Railway

1. Create a new Railway project from this repo.
2. Set environment variables: `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `FRONTEND_URL` (your Vercel frontend URL).
3. Build command: `npm run build` · Start command: `npm run start`.
4. After first deploy, run `npm run db:push` (and optionally `npm run db:seed`) once against the production `DATABASE_URL`, e.g. via `railway run npm run db:push`.

## API surface

REST endpoints under `/api`: `auth` (register/login/provider-register/me), `listings`, `reservations`, `donation-requests`, `providers`, `reports`, `admin` (users/providers/listings/reports), `ai/chat`, `stats`. All mutating/role-gated routes require `Authorization: Bearer <token>`.

Customers browse and contact providers directly by phone (no customer accounts) — the `reservations`/`donation-requests` endpoints remain for provider-side record keeping but aren't used by the current frontend flow.
