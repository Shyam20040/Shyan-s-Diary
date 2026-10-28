import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const collectionSchema = z.enum(["goals", "projects", "blog"]);
const statusSchema = z.enum(["active", "completed", "paused", "archived"]);
const goalInput = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().max(4000).default(""),
  targetValue: z.number().positive().nullable().default(null),
  currentValue: z.number().min(0).default(0),
  unit: z.string().trim().max(40).nullable().default(null),
  status: statusSchema.default("active"),
  startsOn: z.string().date().nullable().default(null),
  targetDate: z.string().date().nullable().default(null),
});
const projectInput = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().max(4000).default(""),
  goalId: z.string().uuid().nullable().default(null),
  status: statusSchema.default("active"),
  startsOn: z.string().date().nullable().default(null),
  targetDate: z.string().date().nullable().default(null),
});
const blogInput = z.object({
  title: z.string().trim().min(1).max(180),
  body: z.string().max(50_000).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  status: z.enum(["draft", "scheduled", "published", "archived"]).default("draft"),
  scheduledAt: z.string().datetime().nullable().default(null),
}).refine((post) => post.status !== "scheduled" || post.scheduledAt !== null, {
  message: "Choose a publish date for a scheduled post.",
  path: ["scheduledAt"],
});

type Collection = z.infer<typeof collectionSchema>;

function mapGoal(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    targetValue: row.target_value,
    currentValue: row.current_value,
    unit: row.unit,
    status: row.status,
    startsOn: row.starts_on,
    targetDate: row.target_date,
    createdAt: row.created_at,
  };
}

function mapProject(row: Record<string, unknown>) {
  return {
    id: row.id,
    goalId: row.goal_id,
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    startsOn: row.starts_on,
    targetDate: row.target_date,
    createdAt: row.created_at,
  };
}

function mapPost(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? "",
    status: row.status,
    tags: row.tags ?? [],
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ collection: string }> },
) {
  const { collection: rawCollection } = await context.params;
  const parsedCollection = collectionSchema.safeParse(rawCollection);
  if (!parsedCollection.success) {
    return NextResponse.json({ error: "Unknown workspace collection." }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const collection: Collection = parsedCollection.data;
  const query = collection === "goals"
    ? supabase.from("goals").select("id,title,description,target_value,current_value,unit,status,starts_on,target_date,created_at").neq("status", "archived").order("created_at", { ascending: false }).limit(200)
    : collection === "projects"
      ? supabase.from("projects").select("id,goal_id,title,description,status,starts_on,target_date,created_at").neq("status", "archived").order("created_at", { ascending: false }).limit(200)
      : supabase.from("blog_posts").select("id,title,body,status,tags,scheduled_at,published_at,updated_at").neq("status", "archived").order("updated_at", { ascending: false }).limit(200);
  const { data, error } = await query;

  if (error) {
    console.error(`Workspace ${collection} query failed:`, error.message);
    return NextResponse.json({ error: `Could not load ${collection}.` }, { status: 500 });
  }

  const items = (data ?? []).map((row) =>
    collection === "goals"
      ? mapGoal(row)
      : collection === "projects"
        ? mapProject(row)
        : mapPost(row),
  );
  return NextResponse.json({ items });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ collection: string }> },
) {
  const { collection: rawCollection } = await context.params;
  const parsedCollection = collectionSchema.safeParse(rawCollection);
  if (!parsedCollection.success) {
    return NextResponse.json({ error: "Unknown workspace collection." }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const collection: Collection = parsedCollection.data;
  if (collection === "goals") {
    const parsed = goalInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid goal." }, { status: 400 });
    }
    const { data, error } = await supabase.from("goals").insert({
      title: parsed.data.title,
      description: parsed.data.description,
      target_value: parsed.data.targetValue,
      current_value: parsed.data.currentValue,
      unit: parsed.data.unit,
      status: parsed.data.status,
      starts_on: parsed.data.startsOn,
      target_date: parsed.data.targetDate,
    }).select("id,title,description,target_value,current_value,unit,status,starts_on,target_date,created_at").single();
    if (error) {
      console.error("Goal creation failed:", error.message);
      return NextResponse.json({ error: "Could not create goal." }, { status: 500 });
    }
    return NextResponse.json({ item: mapGoal(data) }, { status: 201 });
  }

  if (collection === "projects") {
    const parsed = projectInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid project." }, { status: 400 });
    }
    const { data, error } = await supabase.from("projects").insert({
      title: parsed.data.title,
      description: parsed.data.description,
      goal_id: parsed.data.goalId,
      status: parsed.data.status,
      starts_on: parsed.data.startsOn,
      target_date: parsed.data.targetDate,
    }).select("id,goal_id,title,description,status,starts_on,target_date,created_at").single();
    if (error) {
      console.error("Project creation failed:", error.message);
      return NextResponse.json({ error: "Could not create project. Check that the selected goal still exists." }, { status: 500 });
    }
    return NextResponse.json({ item: mapProject(data) }, { status: 201 });
  }

  const parsed = blogInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid blog post." }, { status: 400 });
  }
  const { data, error } = await supabase.from("blog_posts").insert({
    title: parsed.data.title,
    body: parsed.data.body,
    tags: parsed.data.tags,
    status: parsed.data.status,
    scheduled_at: parsed.data.scheduledAt,
    published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
  }).select("id,title,body,status,tags,scheduled_at,published_at,updated_at").single();
  if (error) {
    console.error("Blog post creation failed:", error.message);
    return NextResponse.json({ error: "Could not create blog post." }, { status: 500 });
  }
  return NextResponse.json({ item: mapPost(data) }, { status: 201 });
}
