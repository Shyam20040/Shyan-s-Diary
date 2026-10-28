# Daymark — Personal Life OS

A private, single-owner workspace for planning, focus sessions, daily reflection, and evidence-based reporting. The app is built with Next.js App Router, TypeScript, Supabase, and a server-only access boundary.

## What works in this first implementation

- Responsive dashboard with metrics calculated only from records saved in the workspace.
- Task creation, editing, completion, search, status filtering, and confirmation-based archiving.
- Timestamp-based focus timer that survives page refreshes in the same browser.
- Date-addressable daily journal and activity history.
- On-demand, locally generated PDF reports and JSON data export.
- Dark/light appearance preference.
- Supabase task, goal, project, and blog-draft storage through protected server routes.
- Private file uploads, signed downloads, and deletion for task, project, and blog attachments.
- Gemini AI Studio responses grounded in saved tasks, goals, projects, journal reflections, and focus sessions.
- RLS-enabled schema and private storage buckets.
- Production owner-access gate. Production deployments fail closed if access secrets are missing.

Focus sessions and journal entries are browser-local in this release; the AI endpoint uses database records only. Blog status is workspace metadata and does not publish to an external site or automatically publish scheduled posts. Realtime and cross-device timer/journal synchronization are not enabled. The server-side daily report endpoint, private PDF upload, idempotency claim, Gemini evidence analysis, and Vercel Cron schedule require the corresponding Supabase/Gemini/hosting secrets.

## Local development

Requirements: Node.js 20.9 or newer and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

In development, the owner gate is bypassed for localhost convenience. Keep the development server bound to localhost; do not expose it on a public network. Local records are stored in the browser's local storage and do not leave the device unless you configure Supabase.

## Supabase setup

1. Create a Supabase project.
2. Apply `supabase/migrations/20261028000000_initial_schema.sql` using the Supabase CLI (`supabase db push`) or the SQL editor.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or your hosting provider's secret manager.
4. The service-role key is read only by server code. Do not expose it through `NEXT_PUBLIC_*`.
5. RLS is enabled on private tables and no browser-role policies are created. Database access in this release is through the owner-gated server routes.

The migration creates the private `private-life-files` bucket for report PDFs. The Knowledge module expects a second **private** bucket named `Attachments`; create it in Supabase Storage if it does not already exist. Attachment uploads are limited to 25 MB and PDF, PNG, JPEG, WebP, plain-text, or Markdown files. Uploads are linked to a saved task, project, or blog post; downloads use short-lived signed URLs.

The Goals & projects, Blog studio, Knowledge, and AI studio screens require a working Supabase connection. AI Studio reads `GEMINI_API_KEY_AI_STUDIO` or falls back to `GEMINI_API_KEY_DEFAULT` and `GEMINI_API_KEY_DAILY_REPORT`; its model uses `GEMINI_MODEL_AI_STUDIO`, `GEMINI_MODEL_DEFAULT`, then `GEMINI_MODEL_DAILY_REPORT`, with `gemini-2.5-flash` as the default. Keep all keys server-only and restart the development server after editing `.env.local`.

## Production access

Set the following server-only variables before deployment:

- `APP_ACCESS_PASSWORD`: a long, unique owner password.
- `APP_SESSION_SECRET`: a cryptographically random secret with at least 32 bytes of entropy.

For example, generate a session secret with PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

The login cookie is HTTP-only, secure in production, same-site strict, and valid for seven days. The production proxy redirects all private pages and APIs to the access screen, and fails closed if either variable is missing. Use your hosting provider's rate limiting/WAF on `/api/access/login`.

## Gemini setup

AI Studio and daily report analysis use Gemini on the server. Feature-specific server keys fall back to `GEMINI_API_KEY_DEFAULT`; model variables are optional and should name models available to your Google AI account. Keep every key in the server secret store and never use a `NEXT_PUBLIC_*` key. AI Studio sends the question and a bounded selection of saved workspace records to Gemini, then stores the answer in `ai_insights`.

## Daily PDF scheduling

`vercel.json` schedules `GET /api/jobs/daily-report` for `30 16 * * *` UTC (10:00 PM Asia/Kolkata). The endpoint requires `Authorization: Bearer …` using either `CRON_SECRET` (Vercel's Cron authorization) or `SCHEDULED_JOB_SECRET`. Set one of those secrets in the hosting provider, configure Supabase, and deploy to a Vercel plan that supports Cron. The report claim is unique per reporting date, skips completed reports, and permits recovery after stale processing or failure. PDFs are uploaded to the private `private-life-files` bucket. A local development server cannot run this job while the computer is off.

Manual server report generation is available to an authenticated owner through `POST /api/jobs/daily-report` with `{"date":"YYYY-MM-DD"}`. It uses Asia/Kolkata day boundaries and returns a short-lived signed download URL. Never make this endpoint unauthenticated.

## Scripts

```powershell
npm run dev
npm run lint
npm run build
```

Local-mode data can be downloaded from **Settings → Export your data**. This export includes browser-local tasks, sessions, journal entries, and any active timer state. Keep backups private.
