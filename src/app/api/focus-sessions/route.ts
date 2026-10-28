import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decodeFocusSessionNotes } from "@/lib/focus-timer";

const startSchema = z.object({
  taskId: z.string().uuid().nullable().default(null),
});

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });

  const { data, error } = await supabase.from("focus_sessions")
    .select("id,task_id,started_at,ended_at,duration_seconds,notes")
    .is("archived_at", null)
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Focus session query failed:", error.message);
    return NextResponse.json({ error: "Could not load focus sessions." }, { status: 500 });
  }

  const active = (data ?? []).find((session) => session.ended_at === null);
  const timerState = active ? decodeFocusSessionNotes(active.notes)?.daymarkTimer : null;
  return NextResponse.json({
    sessions: (data ?? []).filter((session) => session.ended_at && session.duration_seconds !== null).map((session) => ({
      id: session.id,
      taskId: session.task_id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      durationSeconds: session.duration_seconds ?? 0,
    })),
    activeTimer: active ? {
      taskId: active.task_id,
      startedAt: timerState?.originalStartedAt ?? active.started_at,
      elapsedSeconds: timerState?.elapsedSeconds ?? 0,
      runningSince: timerState?.runningSince ?? active.started_at,
      id: active.id,
    } : null,
  });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Select a valid task or start without one." }, { status: 400 });
  const { data: active, error: activeError } = await supabase.from("focus_sessions")
    .select("id").is("ended_at", null).is("archived_at", null).limit(1).maybeSingle();
  if (activeError) {
    console.error("Active focus session lookup failed:", activeError.message);
    return NextResponse.json({ error: "Could not check for an active focus session." }, { status: 500 });
  }
  if (active) return NextResponse.json({ error: "A focus session is already active. Resume or stop it first." }, { status: 409 });

  const startedAt = new Date().toISOString();
  const { data, error } = await supabase.from("focus_sessions").insert({
    task_id: parsed.data.taskId,
    started_at: startedAt,
    notes: JSON.stringify({
      daymarkTimer: { elapsedSeconds: 0, originalStartedAt: startedAt, runningSince: startedAt },
      note: "",
    }),
  }).select("id,task_id,started_at,notes").single();
  if (error) {
    console.error("Focus session creation failed:", error.message);
    return NextResponse.json({ error: "Could not start the focus session." }, { status: 500 });
  }
  return NextResponse.json({ activeTimer: {
    id: data.id,
    taskId: data.task_id,
    startedAt: startedAt,
    elapsedSeconds: 0,
    runningSince: startedAt,
  } }, { status: 201 });
}
