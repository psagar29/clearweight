import { NextRequest, NextResponse } from "next/server";

import {
  CODEX_STATE_COOKIE,
  cleanupCodexAuthStores,
  codexAuthorizeEndpoint,
  codexClientId,
  codexOriginator,
  codexRedirectUri,
  codexScope,
  createCodeChallenge,
  getReturnTo,
  pendingCodexOAuth,
  randomUrlToken,
  secureCookie,
} from "@/lib/codex-oauth";
import { ensureCodexLoopbackServer } from "@/lib/codex-loopback-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  cleanupCodexAuthStores();

  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  const returnTo = getReturnTo(requestUrl.searchParams.get("returnTo"));
  const redirectUri = codexRedirectUri();
  const state = randomUrlToken();
  const codeVerifier = randomUrlToken();
  const codeChallenge = createCodeChallenge(codeVerifier);

  try {
    await ensureCodexLoopbackServer();
  } catch {
    const errorUrl = new URL("/signin", request.url);
    errorUrl.searchParams.set("error", "callback_listener_unavailable");
    return NextResponse.redirect(errorUrl);
  }

  pendingCodexOAuth.set(state, {
    codeVerifier,
    redirectUri,
    appOrigin: origin,
    returnTo,
    createdAt: Date.now(),
  });

  const authUrl = new URL(codexAuthorizeEndpoint());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", codexClientId());
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", codexScope());
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("id_token_add_organizations", "true");
  authUrl.searchParams.set("codex_cli_simplified_flow", "true");
  authUrl.searchParams.set("prompt", "login");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("originator", codexOriginator());

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(CODEX_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: secureCookie(),
  });

  return response;
}
