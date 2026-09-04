# AI Prompt Log

This project was built end-to-end using **Claude Code** (Anthropic) as an AI pair
programmer during a hackathon. This log records the AI-assisted work honestly, as
required by the brief — no part of the implementation should be read as manually
written from scratch.

## Tool

Claude Code (Sonnet 5), operating directly on this repository with file read/write
and shell access (installing packages, running the Clerk CLI, running Postgres
locally, running builds/tests).

## 1. Overall application scaffold and architecture

- **Purpose**: Stand up a Next.js + TypeScript + Tailwind app, decide on Prisma vs.
  another ORM, and decide how to structure "backend" given the brief's preference for
  a separate Node/Render backend vs. the explicit fallback allowing Next.js API routes.
- **Prompt (summarized from the full hackathon brief supplied by the user)**: "Build
  RiceShare, a surplus-food marketplace for Sri Lanka... Next.js/TypeScript/Tailwind
  frontend, Node/REST backend (Next.js API routes acceptable if kept clean), Neon
  Postgres via Prisma, Clerk auth, Gemini chatbot... inspect the repo, implement
  everything, run it, fix all errors, make sure it builds."
- **What was generated**: `create-next-app` scaffold, `prisma/schema.prisma`,
  `prisma.config.ts`, `lib/prisma.ts` (Prisma 7 requires a driver adapter —
  `@prisma/adapter-pg` — a change from earlier Prisma versions the model initially
  assumed), the full `app/api/*` REST surface, and all dashboard/browse/details pages.
- **How it was reviewed/modified**: The model discovered mid-build that the installed
  Prisma version (`latest` dist-tag resolved to an `8.0.0-rc` release candidate) was
  unstable for a hackathon deliverable and pinned to the last stable release (`7.10.0`)
  instead. It also discovered Prisma 7 removed `datasource.url` from `schema.prisma` in
  favor of `prisma.config.ts` + a runtime driver adapter, and adjusted the schema/client
  code accordingly after reading the actual installed package's type definitions and
  CLI error output (rather than relying on possibly-outdated training knowledge).
- **How it was tested**: `prisma generate`, `prisma db push` against a local disposable
  Postgres instance, and a smoke-test script (`tsx -e ...`) confirming the client could
  connect and query.

## 2. Clerk authentication integration

- **Purpose**: Wire up sign-in/sign-up/sign-out and a `UserButton`, and map Clerk
  identities to application roles.
- **Prompt**: The brief's "Add Clerk Authentication" section, instructing use of the
  Clerk CLI (`clerk auth login`, `clerk init --app <id>`), verification of the Next.js
  proxy matcher, and use of `@clerk/nextjs` control components.
- **What was generated**: Ran `clerk init`, which scaffolded `proxy.ts`,
  `app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`, and
  wired `ClerkProvider` into `app/layout.tsx`. The model then built `lib/auth.ts`
  (`getOrCreateAppUser`, `requireAppUser`, `requireRole`, `requireProvider`) to lazily
  sync a signed-in Clerk user into the app's own `users` table (no webhooks, to keep
  the hackathon setup simple) and to enforce role-based authorization in every API
  route.
- **How it was reviewed/modified**: The model hit a runtime error —
  `<SignedIn>`/`<SignedOut>` throw in the installed Clerk major version ("Core 3"),
  which replaced them with a single `<Show when="signed-in" | "signed-out">`
  component. It read the actual installed package's deprecation-error type
  definitions (which included fix-it instructions) and migrated every usage
  (`Navbar`, `ReserveForm`, `DonationRequestForm`, `ReportButton`,
  `app/provider/apply/page.tsx`) instead of assuming its own (outdated) knowledge of
  the Clerk API was correct.
- **How it was tested**: `clerk doctor` (all green except "production instance not
  configured", expected for local dev), then `curl` checks that protected routes
  return `401` unauthenticated and public routes return `200`.

## 3. Business logic: reservations, donation requests, quantity safety

- **Purpose**: Implement "Reserve & Pay at Pickup" and donation accept/reject flows
  without ever allowing negative or oversold quantities, including under concurrent
  requests.
- **Prompt**: The brief's "Business Logic" section (atomic quantity decrement,
  `SOLD_OUT` transition, donation quantity only decrements on acceptance, prices can
  never go negative or exceed original price).
- **What was generated**: `app/api/reservations/route.ts` and
  `app/api/donation-requests/[id]/route.ts` use a single conditional
  `prisma.listing.updateMany({ where: { quantityRemaining: { gte: qty }, ... } })`
  inside a `$transaction`, checking `result.count === 0` to detect and reject a lost
  race, rather than a read-then-write check-then-act pattern that would be unsafe
  under concurrency.
- **How it was reviewed/modified**: Self-reviewed against the brief's explicit
  "Never allow requested quantity > quantity_remaining" and "safe database logic to
  avoid race conditions" requirements.
- **How it was tested**: A throwaway test script (not part of the app) fired 5
  concurrent reservation attempts of 1 portion each against a listing with only 3
  portions remaining, confirming exactly 3 succeeded, 2 failed with a clean error, the
  listing flipped to `SOLD_OUT` at zero remaining, and cancelling a reservation
  correctly restored the quantity and reverted the status.

## 4. RiceShare Food Assistant (Gemini chatbot)

- **Purpose**: A RiceShare-scoped chatbot for customers and providers, server-side
  only, with a graceful fallback.
- **Prompt**: The brief's "AI Feature" section, including the required system
  instruction content and the requirement to inject "current listing information" for
  simple queries without building RAG/a vector database.
- **What was generated**: `lib/gemini.ts` (system instruction, `askFoodAssistant`
  using `@google/genai`'s `ai.models.generateContent`), `app/api/ai/chat/route.ts`
  (validates the request with Zod, fetches up to 25 live, non-expired listings from
  Postgres and inlines them as plain-text context, and catches any Gemini error to
  return a friendly fallback message instead of a 500), and `components/ChatWidget.tsx`
  (floating button, suggested questions, loading/error states, last-10-turn history).
- **How it was reviewed/modified**: Verified the actual installed `@google/genai`
  package's type definitions for the `generateContent`/`systemInstruction`/`contents`
  shapes before writing the wrapper, rather than guessing the SDK surface.
- **How it was tested**: `curl -X POST /api/ai/chat` with an empty message (rejected
  by Zod validation with a clear error) and with no `GEMINI_API_KEY` configured
  (returns the intended fallback message with `fallback: true}` instead of erroring).
  End-to-end testing against a real Gemini key was not performed in this session since
  no key was available in the environment — see the "Remaining issues" note in the
  final summary.

## 5. Sample/seed data

- **Purpose**: Populate the browse page and dashboards with realistic listings so the
  app doesn't look empty on first run.
- **Prompt**: The brief's "Sample Data" section (ABC Restaurant / Chicken Rice, XYZ
  Events / Vegetable Rice, City Bakery / Vegetable Sandwiches, etc.).
- **What was generated**: `prisma/seed.ts`, creating 6 providers and 13 listings
  spanning all 7 categories and both `SALE`/`DONATION` types, including one
  intentionally sold-out and one intentionally expired listing to exercise those UI
  states.
- **How it was tested**: `npm run db:seed` against the local database, then verified
  via `/api/listings` and `/api/stats` that counts and filters matched expectations.

## General process notes

- All secrets (`DATABASE_URL`, `CLERK_SECRET_KEY`, `GEMINI_API_KEY`) were kept out of
  git via `.gitignore`; `.env.example` uses generic placeholders rather than any
  real-looking values, even though the original task text included example values
  that resembled real credentials — those were treated as illustrative placeholders
  to replace, not values to commit.
- Throughout, the model prioritized reading the actually-installed package versions'
  source/type definitions over relying on pretrained knowledge, since several
  dependencies (Next.js 16, Prisma 7, Clerk "Core 3", Tailwind v4) had breaking
  changes from what the model's training data would suggest.
