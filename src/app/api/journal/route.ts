import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const saveSchema = z.object({
  date: z.string().date(),
  body: z.string().max(100_000),
  mood: z.string().trim().max(40).nullable().default(null),
  energy: z.number().int().min(1).max(5).nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
});

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const { data, error } = await supabase.from("journal_entries")
    .select("id,entry_date,content,mood,energy,tags,updated_at")
    .order("entry_date", { ascending: false }).limit(400);
  if (error) {
    console.error("Journal query failed:", error.message);
    return NextResponse.json({ error: "Could not load journal entries." }, { status: 500 });
  }
  return NextResponse.json({
    entries: (data ?? []).map((entry) => ({
      id: entry.id,
      date: entry.entry_date,
      body: entry.content,
      mood: entry.mood,
      energy: entry.energy,
      tags: entry.tags,
      updatedAt: entry.updated_at,
    })),
  });
}

export async function PUT(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid journal entry." }, { status: 400 });
  const { data, error } = await supabase.from("journal_entries").upsert({
    entry_date: parsed.data.date,
    content: parsed.data.body,
    mood: parsed.data.mood,
    energy: parsed.data.energy,
    tags: parsed.data.tags,
  }, { onConflict: "entry_date" })
    .select("id,entry_date,content,mood,energy,tags,updated_at").single();
  if (error) {
    console.error("Journal save failed:", error.message);
    return NextResponse.json({ error: "Could not save your journal entry." }, { status: 500 });
  }
  return NextResponse.json({ entry: {
    id: data.id,
    date: data.entry_date,
    body: data.content,
    mood: data.mood,
    energy: data.energy,
    tags: data.tags,
    updatedAt: data.updated_at,
  } });
}
