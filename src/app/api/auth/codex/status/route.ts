import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  CODEX_SESSION_COOKIE,
  codexSessionCookieHeader,
  cleanupCodexAuthStores,
  resolveCodexSession,
  secureCookie,
} from "@/lib/codex-oauth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  cleanupCodexAuthStores();

  const sessionId = request.cookies.get(CODEX_SESSION_COOKIE)?.value;
  const session = await resolveCodexSession(sessionId);

  if (!session || !sessionId) {
    const response = NextResponse.json({
      signedIn: false,
      provider: "codex",
    });
    if (sessionId) {
      response.cookies.set(CODEX_SESSION_COOKIE, "", {
        httpOnly: true,
        maxAge: 0,
        path: "/",
        sameSite: "lax",
        secure: secureCookie(),
      });
    }
    return response;
  }

  const response = NextResponse.json({
    signedIn: true,
    provider: "codex",
    profile: session.profile,
    scope: session.scope,
    expiresAt: new Date(session.expiresAt).toISOString(),
    source: "browser-cookie",
  });
  response.headers.append(
    "Set-Cookie",
    codexSessionCookieHeader(sessionId, session),
  );

  return response;
}
