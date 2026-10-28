import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const goalInput = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().max(4000),
  targetValue: z.number().positive().nullable(),
  currentValue: z.number().min(0),
  unit: z.string().trim().max(40).nullable(),
  status: z.enum(["active", "completed", "paused", "archived"]),
  startsOn: z.string().date().nullable(),
  targetDate: z.string().date().nullable(),
});
const projectInput = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().max(4000),
  goalId: z.string().uuid().nullable(),
  status: z.enum(["active", "completed", "paused", "archived"]),
  startsOn: z.string().date().nullable(),
  targetDate: z.string().date().nullable(),
});
const blogInput = z.object({
  title: z.string().trim().min(1).max(180),
  body: z.string().max(50_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  status: z.enum(["draft", "scheduled", "published", "archived"]),
  scheduledAt: z.string().datetime().nullable(),
}).refine((post) => post.status !== "scheduled" || post.scheduledAt !== null, {
  message: "Choose a publish date for a scheduled post.",
  path: ["scheduledAt"],
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ collection: string; id: string }> },
) {
  const { collection, id } = await context.params;
  if (!["goals", "projects", "blog"].includes(collection) || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Unknown workspace item." }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (collection === "goals") {
    const parsed = goalInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid goal." }, { status: 400 });
    }
    const { data, error } = await supabase.from("goals").update({
      title: parsed.data.title,
      description: parsed.data.description,
      target_value: parsed.data.targetValue,
      current_value: parsed.data.currentValue,
      unit: parsed.data.unit,
      status: parsed.data.status,
      starts_on: parsed.data.startsOn,
      target_date: parsed.data.targetDate,
    }).eq("id", id).select("id,title,description,target_value,current_value,unit,status,starts_on,target_date,created_at").maybeSingle();
    if (error) {
      console.error("Goal update failed:", error.message);
      return NextResponse.json({ error: "Could not update goal." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Goal not found." }, { status: 404 });
    return NextResponse.json({ item: {
      id: data.id, title: data.title, description: data.description ?? "", targetValue: data.target_value,
      currentValue: data.current_value, unit: data.unit, status: data.status, startsOn: data.starts_on,
      targetDate: data.target_date, createdAt: data.created_at,
    } });
  }

  if (collection === "projects") {
    const parsed = projectInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid project." }, { status: 400 });
    }
    const { data, error } = await supabase.from("projects").update({
      title: parsed.data.title,
      description: parsed.data.description,
      goal_id: parsed.data.goalId,
      status: parsed.data.status,
      starts_on: parsed.data.startsOn,
      target_date: parsed.data.targetDate,
    }).eq("id", id).select("id,goal_id,title,description,status,starts_on,target_date,created_at").maybeSingle();
    if (error) {
      console.error("Project update failed:", error.message);
      return NextResponse.json({ error: "Could not update project." }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ item: {
      id: data.id, goalId: data.goal_id, title: data.title, description: data.description ?? "",
      status: data.status, startsOn: data.starts_on, targetDate: data.target_date, createdAt: data.created_at,
    } });
  }

  const parsed = blogInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid blog post." }, { status: 400 });
  }
  const { data, error } = await supabase.from("blog_posts").update({
    title: parsed.data.title,
    body: parsed.data.body,
    tags: parsed.data.tags,
    status: parsed.data.status,
    scheduled_at: parsed.data.scheduledAt,
    published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
  }).eq("id", id).select("id,title,body,status,tags,scheduled_at,published_at,updated_at").maybeSingle();
  if (error) {
    console.error("Blog post update failed:", error.message);
    return NextResponse.json({ error: "Could not update blog post." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Blog post not found." }, { status: 404 });
  return NextResponse.json({ item: {
    id: data.id, title: data.title, body: data.body ?? "", status: data.status, tags: data.tags ?? [],
    scheduledAt: data.scheduled_at, publishedAt: data.published_at, updatedAt: data.updated_at,
  } });
}
