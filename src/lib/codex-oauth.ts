import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const CODEX_SESSION_COOKIE = "clearweight_codex_session";
export const CODEX_STATE_COOKIE = "clearweight_codex_state";
export const CODEX_PENDING_COOKIE = "clearweight_codex_pending";

export const DEFAULT_CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const DEFAULT_CODEX_REDIRECT_URI =
  "http://localhost:1455/auth/callback";
export const DEFAULT_CODEX_SCOPE = "openid profile email offline_access";

const DEFAULT_ISSUER = "https://auth.openai.com";
const PENDING_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_REFRESH_GRACE_MS = 24 * 60 * 60 * 1000;
const REFRESH_WINDOW_MS = 2 * 60 * 1000;
const SESSION_COOKIE_CHUNK_SIZE = 3600;
const MAX_SESSION_COOKIE_CHUNKS = 8;

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
}

export const pendingCodexOAuth =
  globalThis.clearweightCodexPending ?? new Map<string, PendingCodexOAuth>();

globalThis.clearweightCodexPending = pendingCodexOAuth;

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type SealedPendingCodexOAuth = {
  state: string;
  pending: PendingCodexOAuth;
};

function configuredEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function sessionIsStale(session: CodexSession, now = Date.now()) {
  const staleAfter =
    session.expiresAt + (session.refreshToken ? SESSION_REFRESH_GRACE_MS : 0);
  return staleAfter <= now;
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

function cookieSecret() {
  const secret =
    configuredEnv("CLEARWEIGHT_COOKIE_SECRET") ??
    configuredEnv("AUTH_SECRET") ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "clearweight-dev-cookie-secret");

  if (!secret) {
    throw new Error("CLEARWEIGHT_COOKIE_SECRET is required in production.");
  }

  return secret;
}

function cookieKey() {
  return createHash("sha256").update(cookieSecret()).digest();
}

function sealJson(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cookieKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function unsealJson<T>(sealed: string): T | null {
  const [version, ivValue, tagValue, ciphertextValue] = sealed.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) return null;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      cookieKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}

function serializeCookie(name: string, value: string, maxAge: number) {
  const secure = secureCookie() ? "; Secure" : "";
  return `${name}=${encodeURIComponent(
    value,
  )}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

function clearCookieHeader(name: string) {
  return serializeCookie(name, "", 0);
}

function clearChunkedCookieHeaders(name: string) {
  return [
    clearCookieHeader(name),
    ...Array.from({ length: MAX_SESSION_COOKIE_CHUNKS }, (_, index) =>
      clearCookieHeader(`${name}.${index}`),
    ),
  ];
}

function chunkedCookieHeaders(name: string, value: string, maxAge: number) {
  if (value.length <= SESSION_COOKIE_CHUNK_SIZE) {
    return [
      serializeCookie(name, value, maxAge),
      ...Array.from({ length: MAX_SESSION_COOKIE_CHUNKS }, (_, index) =>
        clearCookieHeader(`${name}.${index}`),
      ),
    ];
  }

  const chunks = value.match(new RegExp(`.{1,${SESSION_COOKIE_CHUNK_SIZE}}`, "g")) ?? [];
  if (chunks.length > MAX_SESSION_COOKIE_CHUNKS) {
    throw new Error("Codex session is too large to store in cookies.");
  }

  return [
    clearCookieHeader(name),
    ...chunks.map((chunk, index) =>
      serializeCookie(`${name}.${index}`, chunk, maxAge),
    ),
    ...Array.from(
      { length: MAX_SESSION_COOKIE_CHUNKS - chunks.length },
      (_, index) => clearCookieHeader(`${name}.${chunks.length + index}`),
    ),
  ];
}

function readChunkedCookie(cookies: CookieReader, name: string) {
  const direct = cookies.get(name)?.value;
  if (direct) return direct;

  const firstChunk = cookies.get(`${name}.0`)?.value;
  if (!firstChunk) return null;

  let value = firstChunk;
  for (let index = 1; index < MAX_SESSION_COOKIE_CHUNKS; index += 1) {
    const chunk = cookies.get(`${name}.${index}`)?.value;
    if (!chunk) break;
    value += chunk;
  }
  return value;
}

export function cleanupCodexAuthStores(now = Date.now()) {
  for (const [state, pending] of pendingCodexOAuth) {
    if (now - pending.createdAt > PENDING_TTL_MS) {
      pendingCodexOAuth.delete(state);
    }
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

function pendingFromCookie(
  sealedPending: string | null | undefined,
  state: string,
) {
  if (!sealedPending) return null;

  const parsed = unsealJson<SealedPendingCodexOAuth>(sealedPending);
  if (!parsed || parsed.state !== state) return null;
  if (Date.now() - parsed.pending.createdAt > PENDING_TTL_MS) return null;

  return parsed.pending;
}

export function codexPendingCookieHeader(
  state: string,
  pending: PendingCodexOAuth,
) {
  return serializeCookie(
    CODEX_PENDING_COOKIE,
    sealJson({ state, pending }),
    Math.floor(PENDING_TTL_MS / 1000),
  );
}

export function clearCodexPendingCookieHeader() {
  return clearCookieHeader(CODEX_PENDING_COOKIE);
}

export async function completeCodexOAuthCode(
  state: string,
  code: string,
  sealedPending?: string | null,
) {
  cleanupCodexAuthStores();

  const pending =
    pendingCodexOAuth.get(state) ?? pendingFromCookie(sealedPending, state);
  if (!pending) {
    throw new Error("Codex sign-in expired. Start again.");
  }

  const tokens = await exchangeCodeForCodexTokens(code, pending);
  const session = buildSession(tokens);
  pendingCodexOAuth.delete(state);

  return {
    pending,
    session,
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

function validCodexSession(value: unknown): CodexSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as CodexSession;
  if (
    typeof session.createdAt !== "number" ||
    typeof session.expiresAt !== "number" ||
    typeof session.accessToken !== "string" ||
    !session.profile ||
    typeof session.profile !== "object"
  ) {
    return null;
  }

  return session;
}

export async function resolveCodexSession(cookies: CookieReader) {
  cleanupCodexAuthStores();
  const sealedSession = readChunkedCookie(cookies, CODEX_SESSION_COOKIE);
  if (!sealedSession) return null;

  const current = validCodexSession(unsealJson<CodexSession>(sealedSession));
  if (!current) return null;
  if (sessionIsStale(current)) return null;

  if (current.expiresAt - Date.now() > REFRESH_WINDOW_MS) {
    return current;
  }

  try {
    return await refreshCodexSession(current);
  } catch {
    return null;
  }
}

export function codexSessionCookieHeaders(session: CodexSession) {
  const expiresAt =
    session.expiresAt + (session.refreshToken ? SESSION_REFRESH_GRACE_MS : 0);
  const maxAge = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000));

  return chunkedCookieHeaders(CODEX_SESSION_COOKIE, sealJson(session), maxAge);
}

export function clearCodexSessionCookieHeaders() {
  return clearChunkedCookieHeaders(CODEX_SESSION_COOKIE);
}
