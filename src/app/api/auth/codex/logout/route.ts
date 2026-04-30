import { NextResponse } from "next/server";

import {
  clearCodexPendingCookieHeader,
  clearCodexSessionCookieHeaders,
} from "@/lib/codex-oauth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({
    signedIn: false,
    provider: "codex",
  });
  for (const cookie of clearCodexSessionCookieHeaders()) {
    response.headers.append("Set-Cookie", cookie);
  }
  response.headers.append("Set-Cookie", clearCodexPendingCookieHeader());

  return response;
}
