import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  clearCodexSessionCookieHeaders,
  codexOAuthConfigurationProblem,
  codexOAuthProblemMessage,
  codexSessionCookieHeaders,
  cleanupCodexAuthStores,
  resolveCodexSession,
} from "@/lib/codex-oauth";
import {
  matrixGenerationStatusFor,
  requestAppOrigin,
} from "@/lib/generation-provider";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  cleanupCodexAuthStores();

  const appOrigin = requestAppOrigin(request);
  const problem = codexOAuthConfigurationProblem(appOrigin);
  const configuration = {
    signInAvailable: !problem,
    problem,
    message: codexOAuthProblemMessage(problem),
  };
  const generation = matrixGenerationStatusFor(
    appOrigin,
    configuration.signInAvailable,
  );
  const session = await resolveCodexSession(request.cookies);

  if (!session) {
    const response = NextResponse.json({
      signedIn: false,
      provider: "codex",
      configuration,
      generation,
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
    configuration,
    generation,
  });
  for (const cookie of codexSessionCookieHeaders(session)) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}
