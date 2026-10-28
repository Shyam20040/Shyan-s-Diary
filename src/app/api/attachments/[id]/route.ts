import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

const bucketName = "Attachments";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const { data: attachment, error } = await supabase.from("attachments")
    .select("storage_path,filename").eq("id", id).maybeSingle();
  if (error) {
    console.error("Attachment lookup failed:", error.message);
    return NextResponse.json({ error: "Could not load attachment." }, { status: 500 });
  }
  if (!attachment) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });

  const { data, error: signedUrlError } = await supabase.storage.from(bucketName)
    .createSignedUrl(attachment.storage_path, 60, { download: attachment.filename });
  if (signedUrlError || !data?.signedUrl) {
    console.error("Attachment signed URL creation failed:", signedUrlError?.message ?? "No URL returned.");
    return NextResponse.json({ error: "Could not create a private download link." }, { status: 502 });
  }
  return NextResponse.json({ url: data.signedUrl });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }

  const { data: attachment, error: lookupError } = await supabase.from("attachments")
    .select("storage_path").eq("id", id).maybeSingle();
  if (lookupError) {
    console.error("Attachment lookup failed:", lookupError.message);
    return NextResponse.json({ error: "Could not load attachment." }, { status: 500 });
  }
  if (!attachment) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });

  const { error: storageError } = await supabase.storage.from(bucketName).remove([attachment.storage_path]);
  if (storageError) {
    console.error("Attachment storage deletion failed:", storageError.message);
    return NextResponse.json({ error: "Could not delete the stored file." }, { status: 502 });
  }
  const { error: metadataError } = await supabase.from("attachments").delete().eq("id", id);
  if (metadataError) {
    console.error("Attachment metadata deletion failed:", metadataError.message);
    return NextResponse.json({ error: "File deleted, but its database record could not be removed." }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
