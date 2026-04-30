import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export const CODEX_SESSION_COOKIE = "clearweight_codex_session";
export const CODEX_STATE_COOKIE = "clearweight_codex_state";

export const DEFAULT_CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const DEFAULT_CODEX_REDIRECT_URI =
  "http://localhost:1455/auth/callback";
export const DEFAULT_CODEX_SCOPE = "openid profile email offline_access";

const DEFAULT_ISSUER = "https://auth.openai.com";
const PENDING_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_REFRESH_GRACE_MS = 24 * 60 * 60 * 1000;
const REFRESH_WINDOW_MS = 2 * 60 * 1000;

export type CodexProfile = {
  accountId: string | null;
  email: string | null;
  name: string | null;
  picture: string | null;
  planType: string | null;
  organizationIds: string[];
};

export type PendingCodexOAuth = {
  codeVerifier: string;
  redirectUri: string;
  appOrigin: string;
  returnTo: string;
  createdAt: number;
};

export type CodexSession = {
  createdAt: number;
  expiresAt: number;
  profile: CodexProfile;
  scope: string | null;
  tokenType: string | null;
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
};

export type CodexTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

declare global {
  var clearweightCodexPending: Map<string, PendingCodexOAuth> | undefined;
  var clearweightCodexSessions: Map<string, CodexSession> | undefined;
  var clearweightCodexSessionsHydrated: boolean | undefined;
}

export const pendingCodexOAuth =
  globalThis.clearweightCodexPending ?? new Map<string, PendingCodexOAuth>();
export const codexSessions =
  globalThis.clearweightCodexSessions ?? new Map<string, CodexSession>();

globalThis.clearweightCodexPending = pendingCodexOAuth;
globalThis.clearweightCodexSessions = codexSessions;

function configuredEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function sessionStorePath() {
  return (
    configuredEnv("CLEARWEIGHT_CODEX_SESSION_STORE") ??
    path.join(".clearweight", "codex-sessions.json")
  );
}

function sessionIsStale(session: CodexSession, now = Date.now()) {
  const staleAfter =
    session.expiresAt + (session.refreshToken ? SESSION_REFRESH_GRACE_MS : 0);
  return staleAfter <= now;
}

function readSessionStore() {
  const storePath = sessionStorePath();
  if (!existsSync(storePath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(storePath, "utf8")) as {
      sessions?: Record<string, CodexSession>;
    };
    return parsed.sessions && typeof parsed.sessions === "object"
      ? parsed.sessions
      : null;
  } catch {
    return null;
  }
}

function persistCodexSessions() {
  const storePath = sessionStorePath();
  const sessions = Object.fromEntries(
    [...codexSessions.entries()].filter(([, session]) => !sessionIsStale(session)),
  );

  mkdirSync(path.dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify({ sessions }, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    chmodSync(storePath, 0o600);
  } catch {
    // Best effort on platforms/filesystems that ignore POSIX modes.
  }
}

function hydrateCodexSessions() {
  if (globalThis.clearweightCodexSessionsHydrated) return;
  globalThis.clearweightCodexSessionsHydrated = true;

  const stored = readSessionStore();
  if (!stored) return;

  for (const [sessionId, session] of Object.entries(stored)) {
    if (!sessionIsStale(session)) {
      codexSessions.set(sessionId, session);
    }
  }
}

function setCodexSession(sessionId: string, session: CodexSession) {
  hydrateCodexSessions();
  codexSessions.set(sessionId, session);
  persistCodexSessions();
}

export function deleteCodexSession(sessionId: string) {
  hydrateCodexSessions();
  codexSessions.delete(sessionId);
  persistCodexSessions();
}

export function codexIssuer() {
  return configuredEnv("CODEX_OAUTH_ISSUER") ?? DEFAULT_ISSUER;
}

export function codexAuthorizeEndpoint() {
  return `${codexIssuer()}/oauth/authorize`;
}

export function codexTokenEndpoint() {
  return `${codexIssuer()}/oauth/token`;
}

export function codexClientId() {
  return configuredEnv("CODEX_OAUTH_CLIENT_ID") ?? DEFAULT_CODEX_CLIENT_ID;
}

export function codexScope() {
  return configuredEnv("CODEX_OAUTH_SCOPE") ?? DEFAULT_CODEX_SCOPE;
}

export function codexOriginator() {
  return configuredEnv("CODEX_OAUTH_ORIGINATOR") ?? "pi";
}

export function codexRedirectUri() {
  return configuredEnv("CODEX_OAUTH_REDIRECT_URI") ?? DEFAULT_CODEX_REDIRECT_URI;
}

export function randomUrlToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function createCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function secureCookie() {
  return process.env.NODE_ENV === "production";
}

export function cleanupCodexAuthStores(now = Date.now()) {
  hydrateCodexSessions();
  let didDeleteSession = false;

  for (const [state, pending] of pendingCodexOAuth) {
    if (now - pending.createdAt > PENDING_TTL_MS) {
      pendingCodexOAuth.delete(state);
    }
  }

  for (const [sessionId, session] of codexSessions) {
    if (sessionIsStale(session, now)) {
      codexSessions.delete(sessionId);
      didDeleteSession = true;
    }
  }

  if (didDeleteSession) {
    persistCodexSessions();
  }
}

export function getReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/signin";
  }

  return value;
}

export function safeRedirect(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/signin";
  }

  return path;
}

export function buildAppRedirectUrl(appOrigin: string, returnTo: string) {
  const url = new URL(safeRedirect(returnTo), appOrigin);
  url.searchParams.set("connected", "codex");
  return url;
}

export function decodeJwtPayload(token: string | null | undefined) {
  if (!token) return null;

  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as
      | Record<string, unknown>
      | null;
  } catch {
    return null;
  }
}

function claimString(claims: Record<string, unknown> | null, key: string) {
  const value = claims?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function claimObject(claims: Record<string, unknown> | null, key: string) {
  const value = claims?.[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function claimStringList(claims: Record<string, unknown> | null, key: string) {
  const value = claims?.[key];
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === "string");
}

function jwtExpiration(token: string | null | undefined) {
  const claims = decodeJwtPayload(token);
  return typeof claims?.exp === "number" ? claims.exp * 1000 : null;
}

function codexAccountId(claims: Record<string, unknown> | null) {
  const authClaim = claimObject(claims, "https://api.openai.com/auth");

  return (
    claimString(authClaim, "chatgpt_account_id") ??
    claimString(authClaim, "account_id") ??
    claimString(claims, "chatgpt_account_id") ??
    claimString(claims, "account_id") ??
    claimString(claims, "sub")
  );
}

export function buildCodexProfile(tokens: CodexTokenResponse): CodexProfile {
  const idClaims = decodeJwtPayload(tokens.id_token);
  const accessClaims = decodeJwtPayload(tokens.access_token);

  return {
    accountId: codexAccountId(accessClaims) ?? codexAccountId(idClaims),
    email:
      claimString(accessClaims, "https://api.openai.com/profile.email") ??
      claimString(idClaims, "email"),
    name:
      claimString(accessClaims, "https://api.openai.com/profile.name") ??
      claimString(idClaims, "name"),
    picture:
      claimString(accessClaims, "https://api.openai.com/profile.picture") ??
      claimString(idClaims, "picture"),
    planType:
      claimString(accessClaims, "chatgpt_plan_type") ??
      claimString(idClaims, "chatgpt_plan_type"),
    organizationIds: [
      ...claimStringList(accessClaims, "https://api.openai.com/organizations"),
      ...claimStringList(idClaims, "https://api.openai.com/organizations"),
    ],
  };
}

function mergeRefreshTokens(
  current: CodexSession,
  tokens: CodexTokenResponse,
): CodexTokenResponse {
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? current.refreshToken ?? undefined,
    id_token: tokens.id_token ?? current.idToken ?? undefined,
    expires_in: tokens.expires_in,
    scope: tokens.scope ?? current.scope ?? undefined,
    token_type: tokens.token_type ?? current.tokenType ?? undefined,
  };
}

export function buildSession(tokens: CodexTokenResponse): CodexSession {
  if (!tokens.access_token) {
    throw new Error("Codex token response did not include an access token.");
  }

  const now = Date.now();
  const exp = jwtExpiration(tokens.access_token);
  const expiresIn =
    typeof tokens.expires_in === "number" && tokens.expires_in > 0
      ? now + tokens.expires_in * 1000
      : null;

  return {
    createdAt: now,
    expiresAt: exp ?? expiresIn ?? now + SESSION_TTL_MS,
    profile: buildCodexProfile(tokens),
    scope: tokens.scope ?? null,
    tokenType: tokens.token_type ?? null,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    idToken: tokens.id_token ?? null,
  };
}

export async function exchangeCodeForCodexTokens(
  code: string,
  pending: PendingCodexOAuth,
) {
  const response = await fetch(codexTokenEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: pending.redirectUri,
      client_id: codexClientId(),
      code_verifier: pending.codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Codex token exchange failed with ${response.status}.`);
  }

  return (await response.json()) as CodexTokenResponse;
}

export async function completeCodexOAuthCode(state: string, code: string) {
  cleanupCodexAuthStores();

  const pending = pendingCodexOAuth.get(state);
  if (!pending) {
    throw new Error("Codex sign-in expired. Start again.");
  }

  const tokens = await exchangeCodeForCodexTokens(code, pending);
  const session = buildSession(tokens);
  const sessionId = randomUrlToken();
  setCodexSession(sessionId, session);
  pendingCodexOAuth.delete(state);

  return {
    pending,
    session,
    sessionId,
  };
}

export async function refreshCodexSession(current: CodexSession) {
  if (!current.refreshToken) {
    throw new Error("Codex session does not have a refresh token.");
  }

  const response = await fetch(codexTokenEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
      client_id: codexClientId(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Codex token refresh failed with ${response.status}.`);
  }

  const tokens = (await response.json()) as CodexTokenResponse;
  if (!tokens.access_token) {
    throw new Error("Codex refresh response did not include an access token.");
  }

  return buildSession(mergeRefreshTokens(current, tokens));
}

export async function resolveCodexSession(sessionId: string | undefined) {
  if (!sessionId) return null;

  cleanupCodexAuthStores();
  const current = codexSessions.get(sessionId);
  if (!current) return null;

  if (current.expiresAt - Date.now() > REFRESH_WINDOW_MS) {
    return current;
  }

  try {
    const refreshed = await refreshCodexSession(current);
    setCodexSession(sessionId, refreshed);
    return refreshed;
  } catch {
    deleteCodexSession(sessionId);
    return null;
  }
}

export function codexSessionCookieHeader(
  sessionId: string,
  session: Pick<CodexSession, "expiresAt" | "refreshToken">,
) {
  const expiresAt =
    session.expiresAt + (session.refreshToken ? SESSION_REFRESH_GRACE_MS : 0);
  const maxAge = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000));
  const secure = secureCookie() ? "; Secure" : "";
  return `${CODEX_SESSION_COOKIE}=${encodeURIComponent(
    sessionId,
  )}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearCodexSessionCookieHeader() {
  const secure = secureCookie() ? "; Secure" : "";
  return `${CODEX_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}
