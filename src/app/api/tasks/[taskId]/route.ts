import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const taskUpdate = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  description: z.string().max(4000).optional(),
  status: z.enum(["backlog", "planned", "in_progress", "blocked", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  dueDate: z.string().date().nullable().optional(),
  estimateMinutes: z.number().int().min(0).max(100_000).optional(),
});

type RouteContext = { params: Promise<{ taskId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = taskUpdate.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return NextResponse.json({ error: parsed.success ? "No task changes supplied." : parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { taskId } = await context.params;
  const update = {
    ...(parsed.data.title !== undefined && { title: parsed.data.title }),
    ...(parsed.data.description !== undefined && { description: parsed.data.description }),
    ...(parsed.data.status !== undefined && {
      status: parsed.data.status,
      completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null,
    }),
    ...(parsed.data.priority !== undefined && { priority: parsed.data.priority }),
    ...(parsed.data.dueDate !== undefined && { due_date: parsed.data.dueDate }),
    ...(parsed.data.estimateMinutes !== undefined && { estimate_minutes: parsed.data.estimateMinutes }),
  };
  const { data, error } = await supabase
    .from("tasks")
    .update(update)
    .eq("id", taskId)
    .is("deleted_at", null)
    .select("id,title,description,status,priority,due_date,estimate_minutes,created_at,completed_at")
    .maybeSingle();

  if (error) {
    console.error("Task update failed:", error.message);
    return NextResponse.json({ error: "Could not update task." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({
    task: {
      id: data.id,
      title: data.title,
      description: data.description ?? "",
      status: data.status,
      priority: data.priority,
      dueDate: data.due_date,
      estimateMinutes: data.estimate_minutes,
      createdAt: data.created_at,
      completedAt: data.completed_at,
    },
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const { taskId } = await context.params;
  const { data, error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", taskId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Task archive failed:", error.message);
    return NextResponse.json({ error: "Could not archive task." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
