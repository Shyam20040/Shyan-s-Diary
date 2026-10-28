import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const taskInput = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().max(4000).default(""),
  status: z.enum(["backlog", "planned", "in_progress", "blocked", "completed", "cancelled"]).default("planned"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  dueDate: z.string().date().nullable().default(null),
  estimateMinutes: z.number().int().min(0).max(100_000).default(0),
});

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 100, 200);
  const { data, error } = await supabase
    .from("tasks")
    .select("id,title,description,status,priority,due_date,estimate_minutes,created_at,completed_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Task query failed:", error.message);
    return NextResponse.json({ error: "Could not load tasks." }, { status: 500 });
  }

  return NextResponse.json({
    tasks: data.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date,
      estimateMinutes: task.estimate_minutes,
      createdAt: task.created_at,
      completedAt: task.completed_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = taskInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid task." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      priority: parsed.data.priority,
      due_date: parsed.data.dueDate,
      estimate_minutes: parsed.data.estimateMinutes,
    })
    .select("id,title,description,status,priority,due_date,estimate_minutes,created_at,completed_at")
    .single();

  if (error) {
    console.error("Task creation failed:", error.message);
    return NextResponse.json({ error: "Could not create task." }, { status: 500 });
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
  }, { status: 201 });
}
