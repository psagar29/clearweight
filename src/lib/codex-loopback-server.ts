import { createServer, type Server, type ServerResponse } from "node:http";

import {
  CODEX_PENDING_COOKIE,
  buildAppRedirectUrl,
  clearCodexPendingCookieHeader,
  codexSessionCookieHeaders,
  completeCodexOAuthCode,
} from "@/lib/codex-oauth";

declare global {
  var clearweightCodexLoopbackServer: Server | undefined;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function callbackHtml(success: boolean, message: string, redirectUrl?: string) {
  const title = success ? "Authentication successful" : "Authentication failed";
  const accent = success ? "#2e5c45" : "#a53c29";
  const safeRedirect = redirectUrl ? escapeHtml(redirectUrl) : null;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${safeRedirect ? `<meta http-equiv="refresh" content="1;url=${safeRedirect}" />` : ""}
  <title>${title}</title>
  <style>
    body { margin: 0; background: #f4f1ea; color: #25231f; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 560px; margin: 80px auto; padding: 28px; border: 1px solid #ddd6c9; border-radius: 8px; background: #fffdf8; box-shadow: 0 10px 30px rgba(37,35,31,0.08); }
    .eyebrow { margin-bottom: 12px; color: ${accent}; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    h1 { margin: 0 0 10px; font-size: 24px; }
    p { margin: 0; color: #5d574d; line-height: 1.6; }
    a { color: #2e5c45; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Clearweight</div>
    <h1>${title}</h1>
    <p>${escapeHtml(message)}</p>
    ${safeRedirect ? `<p style="margin-top: 14px;"><a href="${safeRedirect}">Return to Clearweight</a></p>` : ""}
  </main>
</body>
</html>`;
}

function sendHtml(
  response: ServerResponse,
  status: number,
  body: string,
  setCookie?: string | string[],
) {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Connection", "close");
  if (setCookie) {
    response.setHeader("Set-Cookie", setCookie);
  }
  response.end(body);
}

function cookieFromHeader(header: string | undefined, name: string) {
  if (!header) return null;
  const cookies = header.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

export async function ensureCodexLoopbackServer() {
  if (globalThis.clearweightCodexLoopbackServer?.listening) {
    return;
  }

  const server = createServer(async (request, response) => {
    const host = request.headers.host ?? "localhost:1455";
    const url = new URL(request.url ?? "/", `http://${host}`);

    if (request.method !== "GET" || url.pathname !== "/auth/callback") {
      sendHtml(
        response,
        404,
        callbackHtml(false, "This local Codex callback endpoint only handles /auth/callback."),
      );
      return;
    }

    const oauthError = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (oauthError) {
      sendHtml(
        response,
        400,
        callbackHtml(false, `Codex sign-in returned ${oauthError}.`),
      );
      return;
    }

    if (!code || !state) {
      sendHtml(
        response,
        400,
        callbackHtml(false, "Codex callback was missing code or state."),
      );
      return;
    }

    try {
      const result = await completeCodexOAuthCode(
        state,
        code,
        cookieFromHeader(request.headers.cookie, CODEX_PENDING_COOKIE),
      );
      const redirectUrl = buildAppRedirectUrl(
        result.pending.appOrigin,
        result.pending.returnTo,
      );
      sendHtml(
        response,
        200,
        callbackHtml(
          true,
          "Authentication completed. Returning to Clearweight.",
          redirectUrl.toString(),
        ),
        [
          ...codexSessionCookieHeaders(result.session),
          clearCodexPendingCookieHeader(),
        ],
      );
    } catch (error) {
      sendHtml(
        response,
        400,
        callbackHtml(
          false,
          error instanceof Error ? error.message : "Codex sign-in failed.",
        ),
      );
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(1455, "localhost", () => {
      server.off("error", reject);
      globalThis.clearweightCodexLoopbackServer = server;
      resolve();
    });
  });
}
