import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decodeFocusSessionNotes, encodeFocusSessionNotes } from "@/lib/focus-timer";

const actionSchema = z.object({ action: z.enum(["pause", "resume", "stop"]) });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Focus session not found." }, { status: 404 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid session action." }, { status: 400 });
  const { data: active, error: lookupError } = await supabase.from("focus_sessions")
    .select("id,task_id,started_at,ended_at,duration_seconds,notes")
    .eq("id", id).is("archived_at", null).maybeSingle();
  if (lookupError) {
    console.error("Focus session lookup failed:", lookupError.message);
    return NextResponse.json({ error: "Could not load the focus session." }, { status: 500 });
  }
  if (!active || active.ended_at !== null) {
    return NextResponse.json({ error: "Active focus session not found." }, { status: 404 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const storedState = decodeFocusSessionNotes(active.notes)?.daymarkTimer;
  const state = storedState ?? {
    elapsedSeconds: active.duration_seconds ?? 0,
    originalStartedAt: active.started_at,
    runningSince: active.started_at,
  };
  const elapsed = state.elapsedSeconds + (state.runningSince
    ? Math.max(0, Math.floor((now.getTime() - new Date(state.runningSince).getTime()) / 1000))
    : 0);

  if (parsed.data.action === "pause") {
    if (state.runningSince === null) return NextResponse.json({ ok: true, elapsedSeconds: state.elapsedSeconds });
    const updatedState = { ...state, elapsedSeconds: elapsed, runningSince: null };
    const { error } = await supabase.from("focus_sessions").update({
      duration_seconds: elapsed,
      notes: encodeFocusSessionNotes(updatedState),
    }).eq("id", id);
    if (error) {
      console.error("Focus session pause failed:", error.message);
      return NextResponse.json({ error: "Could not pause the focus session." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, elapsedSeconds: elapsed });
  }

  if (parsed.data.action === "resume") {
    if (state.runningSince !== null) return NextResponse.json({ ok: true, runningSince: state.runningSince });
    const updatedState = { ...state, runningSince: nowIso };
    const { error } = await supabase.from("focus_sessions").update({
      notes: encodeFocusSessionNotes(updatedState),
    }).eq("id", id);
    if (error) {
      console.error("Focus session resume failed:", error.message);
      return NextResponse.json({ error: "Could not resume the focus session." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, runningSince: nowIso });
  }

  const { data, error } = await supabase.from("focus_sessions").update({
    ended_at: nowIso,
    duration_seconds: elapsed,
    notes: decodeFocusSessionNotes(active.notes)?.note ?? "",
  }).eq("id", id)
    .select("id,task_id,started_at,ended_at,duration_seconds").single();
  if (error) {
    console.error("Focus session stop failed:", error.message);
    return NextResponse.json({ error: "Could not stop the focus session." }, { status: 500 });
  }
  return NextResponse.json({ session: elapsed < 1 ? null : {
    id: data.id,
    taskId: data.task_id,
    startedAt: state.originalStartedAt,
    endedAt: data.ended_at,
    durationSeconds: data.duration_seconds ?? 0,
  } });
}
