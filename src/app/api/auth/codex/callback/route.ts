import { NextRequest, NextResponse } from "next/server";

import {
  CODEX_PENDING_COOKIE,
  CODEX_STATE_COOKIE,
  buildAppRedirectUrl,
  clearCodexPendingCookieHeader,
  codexSessionCookieHeaders,
  cleanupCodexAuthStores,
  completeCodexOAuthCode,
  secureCookie,
} from "@/lib/codex-oauth";

export const runtime = "nodejs";

function redirectToSignin(request: NextRequest, error: string) {
  const url = new URL("/signin", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  cleanupCodexAuthStores();

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");
  const cookieState = request.cookies.get(CODEX_STATE_COOKIE)?.value;
  const pendingCookie = request.cookies.get(CODEX_PENDING_COOKIE)?.value;

  if (oauthError) {
    return redirectToSignin(request, "codex_denied");
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectToSignin(request, "state_mismatch");
  }

  try {
    const result = await completeCodexOAuthCode(state, code, pendingCookie);
    const redirectUrl = buildAppRedirectUrl(
      result.pending.appOrigin,
      result.pending.returnTo,
    );

    const response = NextResponse.redirect(redirectUrl);
    for (const cookie of codexSessionCookieHeaders(result.session)) {
      response.headers.append("Set-Cookie", cookie);
    }
    response.headers.append("Set-Cookie", clearCodexPendingCookieHeader());
    response.cookies.set(CODEX_STATE_COOKIE, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: secureCookie(),
    });

    return response;
  } catch {
    return redirectToSignin(request, "token_exchange_failed");
  }
}
