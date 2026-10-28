import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { z } from "zod";

import {
  analyzeDailyReport,
  type DailyReportEvidence,
  type DailyReportAnalysis,
} from "@/lib/ai/daily-report";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const manualRequest = z.object({
  date: z.string().date(),
  regenerate: z.boolean().default(false),
});

function reportDateInKolkata(date: Date) {
  const values = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Kolkata",
    year: "numeric",
  }).formatToParts(date);
  const parts = Object.fromEntries(values.map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validJobSecret(request: NextRequest) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const configured = [process.env.SCHEDULED_JOB_SECRET, process.env.CRON_SECRET]
    .filter((secret): secret is string => Boolean(secret));
  if (!supplied || configured.length === 0) return false;

  return configured.some((secret) => {
    const expected = createHash("sha256").update(secret).digest();
    const actual = createHash("sha256").update(supplied).digest();
    return timingSafeEqual(expected, actual);
  });
}

function localDayBounds(date: string, cutoff: Date) {
  const startsAt = new Date(`${date}T00:00:00+05:30`);
  const endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
  return {
    startsAt: startsAt.toISOString(),
    endsAt: (cutoff.getTime() < endsAt.getTime() ? cutoff : endsAt).toISOString(),
  };
}

function readableStatus(status: string) {
  return status.replaceAll("_", " ");
}

function renderReportPdf(
  evidence: DailyReportEvidence,
  analysis: DailyReportAnalysis | null,
  aiIssue: string | null,
  generatedAt: Date,
) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 17;
  const width = 176;
  let y = 22;

  pdf.setFillColor(32, 44, 76);
  pdf.rect(0, 0, 210, 47, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.text("DAYMARK  /  PRIVATE DAILY REPORT", left, 16);
  pdf.setFontSize(21);
  pdf.text(new Date(`${evidence.reportDate}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
    year: "numeric",
  }), left, 31);
  pdf.setFontSize(9);
  pdf.setTextColor(218, 225, 242);
  pdf.text(`Generated ${generatedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`, left, 40);

  const addPageIfNeeded = (height: number) => {
    if (y + height > pageHeight - 18) {
      pdf.addPage();
      y = 20;
    }
  };
  const addSection = (title: string) => {
    addPageIfNeeded(13);
    y += 6;
    pdf.setTextColor(74, 94, 146);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(title.toUpperCase(), left, y);
    y += 7;
  };
  const addText = (text: string, bold = false) => {
    const lines = pdf.splitTextToSize(text, width) as string[];
    const lineHeight = 5.2;
    for (const line of lines) {
      addPageIfNeeded(lineHeight);
      pdf.setTextColor(45, 54, 75);
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(9.5);
      pdf.text(line, left, y);
      y += lineHeight;
    }
    y += 1.5;
  };

  y = 57;
  addSection("Executive summary");
  addText(analysis?.executiveSummary ?? "This report summarizes the task, focus, and journal records saved for the selected day.");

  addSection("Planned vs actual");
  addText(`Tasks planned: ${evidence.metrics.planned}`);
  addText(`Tasks completed: ${evidence.metrics.completed}`);
  addText(`Completion rate: ${evidence.metrics.completionRate === null ? "Not available — no tasks were planned." : `${evidence.metrics.completionRate}% (completed tasks ÷ tasks due today)`}`);
  const incomplete = evidence.tasks.filter((task) => !["completed", "cancelled"].includes(task.status));
  addText("Task records:");
  if (evidence.tasks.length === 0) addText("No task records were found for this day.");
  for (const task of evidence.tasks) {
    addText(`${task.status === "completed" ? "[x]" : "[ ]"} ${task.title} — ${readableStatus(task.status)}, ${task.priority} priority${task.dueDate ? `, due ${task.dueDate}` : ""}`);
  }
  if (incomplete.length) addText(`Still open: ${incomplete.map((task) => task.title).join("; ")}`);

  addSection("Time and focus");
  addText(`Focus time recorded: ${Math.floor(evidence.metrics.focusSeconds / 3600)}h ${Math.floor((evidence.metrics.focusSeconds % 3600) / 60)}m`);
  addText(`Estimated time for planned tasks: ${evidence.metrics.estimatedMinutes} minutes`);
  addText(`Tracked time: ${evidence.metrics.trackedMinutes} minutes`);
  if (!evidence.sessions.length) addText("No focus sessions were recorded; this is missing timer data, not evidence of inactivity.");
  for (const session of evidence.sessions) {
    addText(`${session.taskTitle} · ${Math.floor(session.durationSeconds / 60)}m · ${session.sessionType}`);
  }

  addSection("Historical context");
  if (evidence.metrics.priorReportCount === 0) {
    addText("No previous completed daily reports are available for comparison.");
  } else {
    addText(`Compared with ${evidence.metrics.priorReportCount} completed report(s) from the previous 30 days.`);
    addText(`Previous-period average completion: ${evidence.metrics.priorAverageCompletionRate === null ? "not available" : `${evidence.metrics.priorAverageCompletionRate}%`}`);
    addText(`Previous-period average focus: ${evidence.metrics.priorAverageFocusSeconds === null ? "not available" : `${Math.floor(evidence.metrics.priorAverageFocusSeconds / 3600)}h ${Math.floor((evidence.metrics.priorAverageFocusSeconds % 3600) / 60)}m`}`);
  }

  addSection("Journal and reflection");
  addText(evidence.journal.trim() || "No journal entry was saved for this day.");

  addSection("Observations and recommendations");
  if (analysis) {
    for (const observation of analysis.observations) addText(`• ${observation}`);
    for (const recommendation of analysis.recommendations) addText(`• ${recommendation}`);
    if (analysis.tomorrowPriorities.length) {
      addSection("Suggested priorities for tomorrow");
      for (const priority of analysis.tomorrowPriorities) addText(`• ${priority}`);
    }
  } else {
    addText(aiIssue ?? "AI analysis was not available. Quantitative metrics above are calculated from stored records.");
  }

  addSection("Data completeness");
  addText(`Journal entry: ${evidence.journal.trim() ? "saved" : "not recorded"}. Focus sessions: ${evidence.sessions.length ? "recorded" : "not recorded"}. Missing records are not treated as confirmed inactivity.`);

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(140, 147, 161);
    pdf.text("PRIVATE · ASIA/KOLKATA", left, pageHeight - 9);
    pdf.text(`${page} / ${pages}`, 193, pageHeight - 9, { align: "right" });
  }
  return Buffer.from(pdf.output("arraybuffer"));
}

async function generateForDate(date: string, regenerate: boolean) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable server reports." },
      { status: 503 },
    );
  }

  const { data: claimRows, error: claimError } = await supabase.rpc("claim_daily_report", {
    p_force: regenerate,
    p_report_date: date,
  });
  if (claimError) {
    console.error("Could not claim daily report:", claimError.message);
    return NextResponse.json({ error: "Could not claim the report job." }, { status: 500 });
  }
  const claim = claimRows?.[0];
  if (!claim) {
    return NextResponse.json({ error: "The report job did not return a claim." }, { status: 500 });
  }

  if (!claim.claimed) {
    if (claim.report_status === "processing") {
      return NextResponse.json({ status: "processing", reportDate: date }, { status: 202 });
    }
    const { data: existing } = await supabase
      .from("daily_reports")
      .select("storage_path")
      .eq("report_date", date)
      .single();
    if (!existing?.storage_path) {
      return NextResponse.json({ error: "A completed report has no stored file." }, { status: 500 });
    }
    const signed = await supabase.storage
      .from("private-life-files")
      .createSignedUrl(existing.storage_path, 60);
    if (signed.error) {
      console.error("Could not sign existing daily report:", signed.error.message);
      return NextResponse.json({ error: "Could not prepare the report download." }, { status: 500 });
    }
    return NextResponse.json({ status: "completed", reportDate: date, downloadUrl: signed.data.signedUrl });
  }

  const startedAt = new Date();
  const runKey = `daily-report:${date}`;
  let jobRunId: string | null = null;
  try {
    const { data: jobRun, error: jobRunError } = await supabase
      .from("scheduled_job_runs")
      .upsert({
        job_name: "daily-report",
        run_key: runKey,
        status: "processing",
        attempts: claim.attempt,
        started_at: startedAt.toISOString(),
        finished_at: null,
        error_message: null,
      }, { onConflict: "run_key" })
      .select("id")
      .single();
    if (jobRunError) throw new Error(`Could not record report job: ${jobRunError.message}`);
    jobRunId = jobRun.id;

    const now = new Date();
    const bounds = localDayBounds(date, now);
    const previousStartDate = new Date(new Date(`${date}T00:00:00+05:30`).getTime() - 30 * 24 * 60 * 60 * 1000);
    const previousStart = reportDateInKolkata(previousStartDate);
    const [plannedResult, completedResult, sessionsResult, journalResult, historyResult] = await Promise.all([
      supabase.from("tasks")
        .select("id,title,status,priority,due_date,estimate_minutes,completed_at")
        .is("deleted_at", null)
        .eq("due_date", date)
        .limit(500),
      supabase.from("tasks")
        .select("id,title,status,priority,due_date,estimate_minutes,completed_at")
        .is("deleted_at", null)
        .gte("completed_at", bounds.startsAt)
        .lt("completed_at", bounds.endsAt)
        .limit(500),
      supabase.from("time_sessions")
        .select("id,task_id,started_at,ended_at,paused_seconds,duration_seconds,status,session_type")
        .gte("started_at", bounds.startsAt)
        .lt("started_at", bounds.endsAt)
        .order("started_at", { ascending: true })
        .limit(500),
      supabase.from("daily_logs")
        .select("private_notes,accomplished,went_well,challenges,lessons,next_day_priorities")
        .eq("log_date", date)
        .maybeSingle(),
      supabase.from("daily_reports")
        .select("report_date,metrics")
        .eq("status", "completed")
        .gte("report_date", previousStart)
        .lt("report_date", date)
        .order("report_date", { ascending: false })
        .limit(30),
    ]);

    for (const result of [plannedResult, completedResult, sessionsResult, journalResult, historyResult]) {
      if (result.error) throw new Error(`Could not load report evidence: ${result.error.message}`);
    }

    const taskMap = new Map<string, NonNullable<typeof plannedResult.data>[number]>();
    for (const task of [...(plannedResult.data ?? []), ...(completedResult.data ?? [])]) {
      taskMap.set(task.id, task);
    }
    const tasks = [...taskMap.values()];
    const sessions = sessionsResult.data ?? [];
    const sessionEvidence = sessions.map((session) => {
      const task = tasks.find((item) => item.id === session.task_id);
      const calculatedDuration = session.duration_seconds ??
        (session.status === "running" || session.status === "paused"
          ? Math.max(0, Math.floor((now.getTime() - new Date(session.started_at).getTime()) / 1000) - session.paused_seconds)
          : 0);
      return {
        taskTitle: task?.title ?? "Unassigned focus",
        durationSeconds: calculatedDuration,
        sessionType: session.session_type,
      };
    });
    const planned = (plannedResult.data ?? []).length;
    const completed = (plannedResult.data ?? []).filter((task) => task.status === "completed").length;
    const focusSeconds = sessionEvidence.reduce((total, session) => total + session.durationSeconds, 0);
    const trackedMinutes = Math.round(focusSeconds / 60);
    const priorReports = historyResult.data ?? [];
    const priorCompletionRates = priorReports
      .map((report) => (report.metrics as { completionRate?: number | null } | null)?.completionRate)
      .filter((rate): rate is number => typeof rate === "number");
    const priorFocusSeconds = priorReports
      .map((report) => (report.metrics as { focusSeconds?: number } | null)?.focusSeconds)
      .filter((seconds): seconds is number => typeof seconds === "number");
    const log = journalResult.data;
    const journal = [
      log?.accomplished,
      log?.went_well,
      log?.challenges,
      log?.lessons,
      log?.next_day_priorities,
      log?.private_notes,
    ].filter((value): value is string => Boolean(value?.trim())).join("\n\n").slice(0, 6000);
    const metrics = {
      planned,
      completed,
      completionRate: planned ? Math.round((completed / planned) * 100) : null,
      focusSeconds,
      estimatedMinutes: (plannedResult.data ?? []).reduce((total, task) => total + task.estimate_minutes, 0),
      trackedMinutes,
      priorReportCount: priorReports.length,
      priorAverageCompletionRate: priorCompletionRates.length
        ? Math.round(priorCompletionRates.reduce((sum, rate) => sum + rate, 0) / priorCompletionRates.length)
        : null,
      priorAverageFocusSeconds: priorFocusSeconds.length
        ? Math.round(priorFocusSeconds.reduce((sum, value) => sum + value, 0) / priorFocusSeconds.length)
        : null,
    };
    const evidence: DailyReportEvidence = {
      reportDate: date,
      metrics,
      tasks: tasks.slice(0, 100).map((task) => ({
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.due_date,
        estimateMinutes: task.estimate_minutes,
      })),
      sessions: sessionEvidence.slice(0, 100),
      journal,
    };

    let analysis: DailyReportAnalysis | null = null;
    let aiIssue: string | null = null;
    let aiModel: string | null = null;
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    try {
      const aiResult = await analyzeDailyReport(evidence);
      analysis = aiResult.analysis;
      aiIssue = aiResult.issue;
      aiModel = aiResult.model;
      inputTokens = aiResult.inputTokens;
      outputTokens = aiResult.outputTokens;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI analysis error.";
      console.error("Daily report AI analysis failed:", message);
      aiIssue = "AI analysis was unavailable. The report includes deterministic activity metrics only.";
    }

    if (aiModel) {
      const { error: insightError } = await supabase.from("ai_insights").insert({
        feature: "daily-report",
        period_start: date,
        period_end: date,
        result: analysis,
        model: aiModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        status: "completed",
      });
      if (insightError) console.error("Could not record daily-report AI metadata:", insightError.message);
    }

    const generatedAt = new Date();
    const pdf = renderReportPdf(evidence, analysis, aiIssue, generatedAt);
    const storagePath = `reports/${date}/daily-report.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("private-life-files")
      .upload(storagePath, pdf, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(`Could not upload report PDF: ${uploadError.message}`);

    const { error: reportUpdateError } = await supabase
      .from("daily_reports")
      .update({
        status: "completed",
        storage_path: storagePath,
        metrics,
        analysis,
        ai_issue: aiIssue,
        generated_at: generatedAt.toISOString(),
        source_updated_at: generatedAt.toISOString(),
        error_message: null,
      })
      .eq("report_date", date);
    if (reportUpdateError) throw new Error(`Could not finalize report metadata: ${reportUpdateError.message}`);

    const { error: jobUpdateError } = await supabase
      .from("scheduled_job_runs")
      .update({ status: "completed", finished_at: generatedAt.toISOString() })
      .eq("id", jobRunId);
    if (jobUpdateError) console.error("Could not finalize report job metadata:", jobUpdateError.message);

    const signed = await supabase.storage
      .from("private-life-files")
      .createSignedUrl(storagePath, 60);
    if (signed.error) throw new Error(`Could not create report download URL: ${signed.error.message}`);
    return NextResponse.json({
      status: "completed",
      reportDate: date,
      downloadUrl: signed.data.signedUrl,
      aiIssue,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown report-generation error.";
    console.error("Daily report generation failed:", message);
    const safeMessage = "Daily report generation failed; check server logs before retrying.";
    const finishedAt = new Date().toISOString();
    await supabase.from("daily_reports")
      .update({ status: "failed", error_message: safeMessage })
      .eq("report_date", date);
    if (jobRunId) {
      await supabase.from("scheduled_job_runs")
        .update({ status: "failed", finished_at: finishedAt, error_message: safeMessage })
        .eq("id", jobRunId);
    }
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!process.env.SCHEDULED_JOB_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Scheduled report authentication is not configured." }, { status: 503 });
  }
  if (!validJobSecret(request)) {
    return NextResponse.json({ error: "Unauthorized scheduled job request." }, { status: 401 });
  }
  return generateForDate(reportDateInKolkata(new Date()), false);
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = manualRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a valid report date." }, { status: 400 });
  }
  return generateForDate(parsed.data.date, parsed.data.regenerate);
}
