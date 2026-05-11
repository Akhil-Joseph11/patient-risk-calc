import type { NextResponse } from "next/server";

/** HttpOnly cookie holding an anonymous workspace id for guest mode (no Clerk). */
export const GUEST_SESSION_COOKIE = "prc_guest_sid";
const MAX_AGE_SEC = 60 * 60 * 24 * 180; // 180 days

export function readGuestSessionId(req: Request): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(`${GUEST_SESSION_COOKIE}=`)) {
      const v = decodeURIComponent(p.slice(GUEST_SESSION_COOKIE.length + 1));
      return v || null;
    }
  }
  return null;
}

export function ensureGuestCookieOnResponse(res: NextResponse, sessionId: string): void {
  res.cookies.set(GUEST_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  });
}

export function newGuestSessionId(): string {
  return crypto.randomUUID();
}
