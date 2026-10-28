import type { Config } from "@netlify/functions";

export const config: Config = {
  schedule: "30 16 * * *",
};

export default async function handler() {
  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  const secret = process.env.SCHEDULED_JOB_SECRET;
  if (!siteUrl || !secret) {
    console.error("Daily report schedule requires the Netlify site URL and SCHEDULED_JOB_SECRET.");
    return new Response("Scheduled report is not configured.", { status: 503 });
  }

  const response = await fetch(new URL("/api/jobs/daily-report", siteUrl), {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(55_000),
  });
  if (!response.ok) {
    console.error("Daily report endpoint returned HTTP", response.status);
    return new Response("Daily report generation failed.", { status: 502 });
  }
  return new Response("Daily report generated.", { status: 200 });
}
