<div align="center">

<img src="public/logo.svg" alt="Clearweight" width="140" />

# Clearweight

**The model proposes. The sliders decide.**

An open-source, AI-powered weighted decision matrix that turns messy tradeoffs into structured, adjustable scores.

[![Live Demo](https://img.shields.io/badge/live-clearweight.vercel.app-000?style=flat-square&logo=vercel)](https://clearweight.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-333?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)

<br />

<img src="public/demo.gif" alt="Clearweight demo" width="720" />

</div>

---

## Why Clearweight?

Big decisions feel heavy because they live in your head as a fog of tradeoffs. Clearweight lifts that weight.

Describe your decision in plain language. AI breaks it down into options, criteria, weights, assumptions, and watchouts. Then **you** take the wheel: drag sliders, toggle gates, and watch the scores recalculate until the tradeoff is explicit and the answer is yours.

No spreadsheet gymnastics. No API keys to manage. Just clarity.

---

## How it works

```
You describe a decision
        |
   AI generates a structured matrix
        |
   You adjust weights, scores, and gates
        |
   Real-time weighted scores reveal the answer
```

1. **Describe** your decision in a sentence or two
2. **Review** the AI-generated matrix with options, criteria, weights, and scores
3. **Adjust** anything: drag weight sliders, change scores, toggle hard gates
4. **Decide** with confidence, backed by transparent math

---

## Features

| | |
|---|---|
| **AI-generated matrices** | 2-12 options, 3-10 criteria, tailored to your decision |
| **Adjustable weights** | Drag sliders with visual trails showing your changes |
| **Hard gates** | Mark criteria as mandatory pass/fail constraints |
| **Sensitivity analysis** | Flags when the winner is fragile |
| **Dark & light modes** | Premium glassmorphism UI with smooth transitions |
| **No API key required** | Local development uses Codex OAuth sign-in, not a billable platform key |
| **Fully open source** | MIT licensed, deploy anywhere |

---

## Stack

- **Next.js 16** App Router
- **React 19** with TypeScript
- **Tailwind CSS v4** with glassmorphism design system
- **Zod** schema validation
- **Codex OAuth PKCE** authentication for local development

---

## Quick start

```bash
git clone https://github.com/psagar29/clearweight.git
cd clearweight
npm install
cp .env.local.example .env.local   # add your secrets
npm run dev
```

Open [localhost:3000](http://localhost:3000). Matrix generation requires Codex sign-in.

### Environment variables

```bash
CODEX_OAUTH_CLIENT_ID=app_EMoamEEZ73f0CkXaXp7hrann
CODEX_OAUTH_SCOPE=openid profile email offline_access
CODEX_OAUTH_ORIGINATOR=pi
CODEX_OAUTH_REDIRECT_URI=http://localhost:1455/auth/callback
CODEX_RESPONSES_ENDPOINT=https://chatgpt.com/backend-api/codex/responses
CODEX_RESPONSES_MODEL=gpt-5.4-mini
CLEARWEIGHT_COOKIE_SECRET=replace-with-a-long-random-secret
```

---

## Auth flow

Clearweight uses the same Codex OAuth PKCE flow as OpenClaw and Steward:

```
/signin                     → sign-in page
/api/auth/codex/start       → generate PKCE challenge, redirect to auth.openai.com
/api/auth/codex/callback    → exchange code for tokens, set encrypted cookie
/api/auth/codex/status      → check session validity
/api/auth/codex/logout      → clear session
```

No platform API key. No local scaffold fallback. Your Codex session is the key.

Important hosted-auth constraint: the default Codex client ID
`app_EMoamEEZ73f0CkXaXp7hrann` is the public desktop/CLI client and is only
usable with the local loopback callback (`http://localhost:1455/auth/callback`).
It is not allowed to redirect to `https://clearweight.vercel.app/...`; OpenAI
returns a generic `unknown_error` for that invalid combination. A hosted release
needs a Codex/OpenAI OAuth client that is explicitly allowed to redirect to the
hosted domain.

---

## Scripts

```bash
npm run dev          # start dev server
npm run build        # production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run check        # lint + typecheck
```

---

## Deploy

Deploy as a standard Next.js app on Vercel, Railway, or any Node host. Set
`CLEARWEIGHT_COOKIE_SECRET`. For hosted Codex sign-in, also set a
`CODEX_OAUTH_CLIENT_ID` whose allowed redirect URI includes your hosted callback,
then set `CODEX_OAUTH_REDIRECT_URI` to that callback URL.

The live deployment is at **[clearweight.vercel.app](https://clearweight.vercel.app)**.

---

## License

[MIT](LICENSE)

---

<div align="center">

Built with care by [Pranav Sagar](https://github.com/psagar29)

</div>
