# Clearweight

Clearweight is an open-source AI assisted weighted decision matrix. You describe a messy decision, the server asks your signed-in Codex account for a structured starting matrix, and the UI lets you adjust options, criteria, weights, gates, and scores until the tradeoff is explicit.

The model proposes. The sliders decide. As they should.

## What it does

- Turns a plain-language decision brief into editable options, criteria, weights, assumptions, and watchouts.
- Uses signed-in Codex auth instead of a billable platform API key.
- Provides an OpenClaw-style Codex OAuth sign-in flow.
- Supports variable matrix size: Codex can return 2-12 options and 3-10 criteria based on the decision.
- Normalizes criteria weights to an effective 100% budget for scoring without moving other sliders.
- Scores every option independently from 0-100 on each criterion.
- Recalculates the final weighted score out of 100 locally as weights and scores change.
- Supports hard gates for mandatory constraints.
- Flags basic sensitivity issues when the winner is fragile.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zod schema validation
- Codex OAuth PKCE route handlers

## Local setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Matrix generation requires Codex sign-in. There is no platform `OPENAI_API_KEY` fallback and no local scaffold fallback.

## Environment

```bash
CODEX_OAUTH_CLIENT_ID=app_EMoamEEZ73f0CkXaXp7hrann
CODEX_OAUTH_SCOPE=openid profile email offline_access
CODEX_OAUTH_ORIGINATOR=pi
CODEX_OAUTH_REDIRECT_URI=http://localhost:1455/auth/callback
CODEX_RESPONSES_ENDPOINT=https://chatgpt.com/backend-api/codex/responses
CODEX_RESPONSES_MODEL=gpt-5.4-mini
CLEARWEIGHT_CODEX_SESSION_STORE=.clearweight/codex-sessions.json
```

`CODEX_OAUTH_REDIRECT_URI` is optional locally. By default the app uses the same loopback callback shape as Codex, OpenClaw, and Steward: `http://localhost:1455/auth/callback`.

## Codex sign-in

OpenClaw's Codex path uses ChatGPT OAuth with PKCE: generate `state` and a code challenge, redirect to `https://auth.openai.com/oauth/authorize`, receive the callback on `http://localhost:1455/auth/callback`, then exchange the authorization code at `https://auth.openai.com/oauth/token`.

Clearweight implements that same sign-in shape at:

```bash
/signin
/api/auth/codex/start
/api/auth/codex/callback
/api/auth/codex/status
/api/auth/codex/logout
```

Current limits:

- The local session store is file-backed and ignored by git. Use an encrypted durable store before deploying this for real hosted users.
- Matrix generation uses the browser's signed-in Clearweight Codex session only.
- If the browser has no valid `clearweight_codex_session` cookie, generation returns `401`.
- Sign-out deletes the server-side session and clears the browser cookie.
- The Codex public OAuth client is a native loopback client. This local callback flow is for local app use; a hosted public app needs a different production auth strategy. Boring, but cheaper than pretending OAuth is fairy dust.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run check
```

## Deploy

Deploy as a standard Next.js app. Set server-side environment variables on the host. Replace the in-memory Codex session store before public launch.
