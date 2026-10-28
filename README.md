# Daymark — Personal Life OS

A personal workspace for planning, focus sessions, daily reflection, and evidence-based reporting. The app is built with Next.js App Router, TypeScript, and Supabase.

**This app has no login or access control. Anyone with the deployed URL can access the workspace and its data. It is intentionally designed for personal use.**

## What works

- Dashboard metrics, task management, goals, projects, blog drafts, Knowledge attachments, AI Studio, and reports.
- Cloud-backed tasks, goals, projects, blog drafts, journal entries, and timestamped focus sessions.
- Focus and journal state load from the database, so the timer remains consistent across devices.
- Confirmed import of existing browser-local tasks, focus sessions, and journal entries. Import does not delete local data.
- Private file uploads, signed downloads, and deletion for task, project, and blog attachments.
- Gemini AI Studio responses grounded in saved workspace records.
- Dark/light appearance preference.

Blog status is workspace metadata and does not publish to an external site or automatically publish scheduled posts. AI, reports, and scheduled jobs require the corresponding Gemini, Supabase, and Netlify environment variables.

## Local development

Requirements: Node.js 20.9 or newer and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev -- --hostname 127.0.0.1 --port 3035
```

Open `http://127.0.0.1:3035`. Configure the Supabase variables below before using cloud features.

## Supabase setup

1. Create a Supabase project.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the required Gemini keys in `.env.local` and in Netlify site environment variables. Keep the service-role key and Gemini keys server-only; never use `NEXT_PUBLIC_*` for them.
3. Link this repository to the intended Supabase project and apply every migration with `npx supabase@latest db push --linked`. Do not use `db reset` against production.
4. Create two private Storage buckets named `private-life-files` and `Attachments`.
5. Deploy the site on Netlify. No Supabase Auth setup or sign-in is required.

Row-level security is enabled on database tables without client policies. Database access goes through server routes using the server-only service-role key. Keep the deployed URL private if you do not want others to access this personal workspace.

Attachment uploads are limited to 25 MB and PDF, PNG, JPEG, WebP, plain-text, or Markdown files. Uploads are linked to a saved task, project, or blog post; downloads use short-lived signed URLs.

## Gemini setup

AI Studio and daily report analysis use Gemini on the server. Feature-specific server keys fall back to `GEMINI_API_KEY_DEFAULT`; model variables are optional and should name models available to your Google AI account. Keep every key in the server secret store and never use a `NEXT_PUBLIC_*` key. AI Studio sends the question and a bounded selection of saved workspace records to Gemini, then stores the answer in `ai_insights`.

## Daily PDF scheduling

`netlify/functions/daily-report.mts` schedules `GET /api/jobs/daily-report` for `30 16 * * *` UTC (10:00 PM Asia/Kolkata). Set `SCHEDULED_JOB_SECRET` in Netlify site environment variables. The scheduled endpoint requires this secret, uses the server-only service role, is idempotent by reporting date, skips completed reports, and permits recovery after stale processing or failure. PDFs are uploaded to the private `private-life-files` bucket. Netlify scheduled functions run after deployment.

Manual server report generation is available through `POST /api/jobs/daily-report` with `{"date":"YYYY-MM-DD"}`.

## Scripts

```powershell
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

Data can be downloaded from **Settings → Export your data**. Keep backups private.
