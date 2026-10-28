import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createOwnerSessionToken,
  isValidOwnerPassword,
  OWNER_SESSION_COOKIE,
} from "@/lib/security/owner-session";

const loginSchema = z.object({
  password: z.string().min(1).max(512),
});

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the owner password." }, { status: 400 });
  }

  if (!process.env.APP_ACCESS_PASSWORD || !process.env.APP_SESSION_SECRET) {
    return NextResponse.json(
      { error: "Owner access is not configured on this server." },
      { status: 503 },
    );
  }

  if (!isValidOwnerPassword(parsed.data.password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(OWNER_SESSION_COOKIE, createOwnerSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
