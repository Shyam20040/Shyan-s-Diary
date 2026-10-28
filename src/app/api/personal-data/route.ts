import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decodeFocusSessionNotes, encodeFocusSessionNotes } from "@/lib/focus-timer";

const taskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  description: z.string().max(4000).default(""),
  status: z.enum(["backlog", "planned", "in_progress", "blocked", "completed", "cancelled"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  dueDate: z.string().date().nullable().default(null),
  estimateMinutes: z.number().int().min(0).max(100_000),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().default(null),
  archivedAt: z.string().datetime().nullable().default(null),
});
const sessionSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid().nullable().default(null),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().int().min(0),
});
const activeTimerSchema = z.object({
  id: z.string().uuid().optional(),
  taskId: z.string().uuid().nullable().default(null),
  startedAt: z.string().datetime(),
  elapsedSeconds: z.number().int().min(0),
  runningSince: z.string().datetime().nullable().optional(),
}).nullable().optional();
const importSchema = z.object({
  tasks: z.array(taskSchema).max(2000).default([]),
  sessions: z.array(sessionSchema).max(5000).default([]),
  journal: z.record(z.string(), z.string().max(100_000)).default({}),
  activeTimer: activeTimerSchema,
});

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });

  const [sessionsResult, journalResult] = await Promise.all([
    supabase.from("focus_sessions")
      .select("id,task_id,started_at,ended_at,duration_seconds,notes")
      .is("archived_at", null).order("started_at", { ascending: false }).limit(200),
    supabase.from("journal_entries")
      .select("entry_date,content").limit(400),
  ]);
  if (sessionsResult.error || journalResult.error) {
    console.error("Personal data query failed:", sessionsResult.error?.message ?? journalResult.error?.message);
    return NextResponse.json({ error: "Could not load focus and journal records." }, { status: 500 });
  }
  const rows = sessionsResult.data ?? [];
  const active = rows.find((session) => session.ended_at === null);
  const timerState = active ? decodeFocusSessionNotes(active.notes)?.daymarkTimer : null;
  return NextResponse.json({
    sessions: rows.filter((session) => session.ended_at && session.duration_seconds !== null).map((session) => ({
      id: session.id,
      taskId: session.task_id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      durationSeconds: session.duration_seconds ?? 0,
    })),
    journal: Object.fromEntries((journalResult.data ?? []).map((entry) => [entry.entry_date, entry.content])),
    activeTimer: active ? {
      id: active.id,
      taskId: active.task_id,
      startedAt: timerState?.originalStartedAt ?? active.started_at,
      elapsedSeconds: timerState?.elapsedSeconds ?? 0,
      runningSince: timerState?.runningSince ?? active.started_at,
    } : null,
  });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid local workspace export." }, { status: 400 });

  const tasks = parsed.data.tasks.map((task) => ({
    id: task.id, title: task.title, description: task.description,
    status: task.status, priority: task.priority, due_date: task.dueDate,
    estimate_minutes: task.estimateMinutes, created_at: task.createdAt,
    completed_at: task.completedAt, deleted_at: task.archivedAt,
  }));
  if (tasks.length) {
    const { error } = await supabase.from("tasks").upsert(tasks, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      console.error("Local task import failed:", error.message);
      return NextResponse.json({ error: "Could not import local tasks." }, { status: 500 });
    }
  }

  const sessions = parsed.data.sessions.map((session) => ({
    id: session.id,
    task_id: session.taskId,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    duration_seconds: session.durationSeconds,
    notes: "",
  }));
  if (sessions.length) {
    const { error } = await supabase.from("focus_sessions").upsert(sessions, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      console.error("Local focus-session import failed:", error.message);
      return NextResponse.json({ error: "Tasks were imported, but focus sessions could not be imported. You can safely retry." }, { status: 500 });
    }
  }

  const entries = Object.entries(parsed.data.journal).map(([date, content]) => ({
    entry_date: date,
    content,
    mood: null,
    energy: null,
    tags: [],
  }));
  if (entries.length) {
    const journalSchema = z.array(z.object({ entry_date: z.string().date(), content: z.string() })).max(4000);
    if (!journalSchema.safeParse(entries).success) {
      return NextResponse.json({ error: "A journal entry has an invalid date." }, { status: 400 });
    }
    const { error } = await supabase.from("journal_entries")
      .upsert(entries, { onConflict: "entry_date", ignoreDuplicates: true });
    if (error) {
      console.error("Local journal import failed:", error.message);
      return NextResponse.json({ error: "Tasks and focus sessions were imported, but journal entries could not be imported. You can safely retry." }, { status: 500 });
    }
  }

  let activeTimerImported = false;
  const activeTimer = parsed.data.activeTimer;
  if (activeTimer) {
    const { data: active, error: activeError } = await supabase.from("focus_sessions")
      .select("id").is("ended_at", null).is("archived_at", null).limit(1).maybeSingle();
    if (activeError) {
      console.error("Active focus session lookup failed:", activeError.message);
      return NextResponse.json({ error: "Could not check for an active cloud timer." }, { status: 500 });
    }
    if (active) return NextResponse.json({ error: "An active cloud focus session already exists. Stop or pause it before importing the local timer." }, { status: 409 });

    const { error } = await supabase.from("focus_sessions").upsert({
      id: activeTimer.id ?? crypto.randomUUID(),
      task_id: activeTimer.taskId,
      started_at: activeTimer.startedAt,
      duration_seconds: activeTimer.elapsedSeconds,
      notes: encodeFocusSessionNotes({
        elapsedSeconds: activeTimer.elapsedSeconds,
        originalStartedAt: activeTimer.startedAt,
        runningSince: activeTimer.runningSince === null ? null : activeTimer.runningSince ?? activeTimer.startedAt,
      }),
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      console.error("Local active timer import failed:", error.message);
      return NextResponse.json({ error: "Tasks, sessions, and journal entries were imported, but the active timer could not be imported. You can safely retry." }, { status: 500 });
    }
    activeTimerImported = true;
  }

  return NextResponse.json({
    imported: {
      tasks: tasks.length,
      sessions: sessions.length,
      journalEntries: entries.length,
      activeTimer: activeTimerImported,
    },
  });
}
