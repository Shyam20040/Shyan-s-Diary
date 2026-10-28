import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const bucketName = "Attachments";
const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/markdown",
]);
const uploadInput = z.object({
  relatedType: z.enum(["task", "project", "journal", "blog", "report"]),
  relatedId: z.string().uuid(),
  description: z.string().trim().max(500).default(""),
});

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const { data, error } = await supabase.from("attachments")
    .select("id,related_type,related_id,filename,mime_type,size_bytes,description,created_at")
    .order("created_at", { ascending: false }).limit(200);
  if (error) {
    console.error("Attachment query failed:", error.message);
    return NextResponse.json({ error: "Could not load attachments." }, { status: 500 });
  }

  return NextResponse.json({ items: (data ?? []).map((item) => ({
    id: item.id,
    relatedType: item.related_type,
    relatedId: item.related_id,
    filename: item.filename,
    mimeType: item.mime_type,
    sizeBytes: Number(item.size_bytes),
    description: item.description,
    createdAt: item.created_at,
  })) });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload form could not be read." }, { status: 400 });
  }

  const file = form.get("file");
  const parsed = uploadInput.safeParse({
    relatedType: form.get("relatedType"),
    relatedId: form.get("relatedId"),
    description: form.get("description") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Choose a related item." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a non-empty file to upload." }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Files must be 25 MB or smaller." }, { status: 413 });
  }
  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "Allowed files: PDF, PNG, JPEG, WebP, plain text, or Markdown." }, { status: 415 });
  }
  const safeName = file.name.normalize("NFKC").replace(/[^\w.-]+/g, "_").slice(-120) || "attachment";
  const id = randomUUID();
  const storagePath = `${parsed.data.relatedType}/${parsed.data.relatedId}/${id}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    console.error("Attachment storage upload failed:", uploadError.message);
    return NextResponse.json({ error: "Upload failed. Confirm the private Attachments bucket allows this file type and size." }, { status: 502 });
  }

  const { data, error } = await supabase.from("attachments").insert({
    id,
    related_type: parsed.data.relatedType,
    related_id: parsed.data.relatedId,
    filename: safeName,
    mime_type: file.type,
    size_bytes: file.size,
    storage_path: storagePath,
    description: parsed.data.description,
  }).select("id,related_type,related_id,filename,mime_type,size_bytes,description,created_at").single();

  if (error) {
    const { error: cleanupError } = await supabase.storage.from(bucketName).remove([storagePath]);
    console.error("Attachment metadata insert failed:", error.message);
    if (cleanupError) console.error("Attachment cleanup failed:", cleanupError.message);
    return NextResponse.json({ error: "File uploaded but its metadata could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ item: {
    id: data.id,
    relatedType: data.related_type,
    relatedId: data.related_id,
    filename: data.filename,
    mimeType: data.mime_type,
    sizeBytes: Number(data.size_bytes),
    description: data.description,
    createdAt: data.created_at,
  } }, { status: 201 });
}
