import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const OWNER_SESSION_COOKIE = "life_os_owner";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function createOwnerSessionToken() {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error("APP_SESSION_SECRET is not configured.");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", secret)
    .update(`life-management-os-owner-session:${issuedAt}`)
    .digest("base64url");
  return `${issuedAt}.${signature}`;
}

export function isValidOwnerSession(token: string | undefined) {
  if (!token || !process.env.APP_SESSION_SECRET) {
    return false;
  }

  const [issuedAtValue, signature] = token.split(".");
  const issuedAt = Number(issuedAtValue);
  const now = Math.floor(Date.now() / 1000);
  if (
    !Number.isInteger(issuedAt) ||
    !signature ||
    issuedAt > now + 60 ||
    now - issuedAt > SESSION_MAX_AGE_SECONDS
  ) {
    return false;
  }

  const expected = Buffer.from(
    createHmac("sha256", process.env.APP_SESSION_SECRET)
      .update(`life-management-os-owner-session:${issuedAt}`)
      .digest("base64url"),
  );
  const received = Buffer.from(signature);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export function isValidOwnerPassword(password: string) {
  const expectedPassword = process.env.APP_ACCESS_PASSWORD;
  if (!expectedPassword) {
    return false;
  }

  const expected = createHmac("sha256", "life-management-os-password")
    .update(expectedPassword)
    .digest();
  const received = createHmac("sha256", "life-management-os-password")
    .update(password)
    .digest();

  return timingSafeEqual(expected, received);
}
