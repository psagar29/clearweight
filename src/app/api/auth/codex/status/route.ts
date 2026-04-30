import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  clearCodexSessionCookieHeaders,
  codexSessionCookieHeaders,
  cleanupCodexAuthStores,
  resolveCodexSession,
} from "@/lib/codex-oauth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  cleanupCodexAuthStores();

  const session = await resolveCodexSession(request.cookies);

  if (!session) {
    const response = NextResponse.json({
      signedIn: false,
      provider: "codex",
    });
    for (const cookie of clearCodexSessionCookieHeaders()) {
      response.headers.append("Set-Cookie", cookie);
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
  for (const cookie of codexSessionCookieHeaders(session)) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}
