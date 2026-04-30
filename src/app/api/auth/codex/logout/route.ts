import { NextRequest, NextResponse } from "next/server";

import {
  CODEX_SESSION_COOKIE,
  deleteCodexSession,
  secureCookie,
} from "@/lib/codex-oauth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(CODEX_SESSION_COOKIE)?.value;
  if (sessionId) {
    deleteCodexSession(sessionId);
  }

  const response = NextResponse.json({
    signedIn: false,
    provider: "codex",
  });
  response.cookies.set(CODEX_SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: secureCookie(),
  });

  return response;
}
