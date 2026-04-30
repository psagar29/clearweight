import { ArrowLeft, CheckCircle2, KeyRound, Shield, Zap } from "lucide-react";
import Link from "next/link";

import { SignInStatus } from "./sign-in-status";

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const errorMessages: Record<string, string> = {
  codex_denied: "Sign-in was cancelled. Try again when ready.",
  callback_listener_unavailable:
    "Could not start the local callback listener. Make sure port 1455 is free.",
  signin_expired: "Sign-in session expired. Please try again.",
  state_mismatch: "Security state mismatch. Please restart sign-in.",
  token_exchange_failed: "Token exchange failed. Try again in a moment.",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const steps = [
  { icon: KeyRound, label: "Authenticate", desc: "Sign in with your ChatGPT or Codex account" },
  { icon: Shield, label: "Authorize", desc: "Grant Clearweight access to generate matrices" },
  { icon: Zap, label: "Generate", desc: "Start creating AI-powered decision matrices" },
];

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const error = firstValue(params.error);
  const connected = firstValue(params.connected);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-16">
      {/* ambient */}
      <div className="ambient anim-breathe" style={{ width: 600, height: 600, top: "10%", left: "15%", background: "var(--glow-1)" }} />
      <div className="ambient anim-breathe" style={{ width: 500, height: 500, bottom: "10%", right: "10%", background: "var(--glow-2)", animationDelay: "-4s" }} />

      <div className="relative z-10 w-full max-w-sm space-y-5">
        {/* back button */}
        <Link
          href="/"
          className="anim-fade inline-flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-[12px] font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--muted)" }}
        >
          <ArrowLeft size={13} />
          Back
        </Link>

        {/* main card */}
        <div className="glass glass-clean px-6 py-7 anim-up" style={{ background: "var(--card-bg)", border: "1px solid var(--border-mid)", boxShadow: "var(--shadow-lg)" }}>
          {/* icon */}
          <div
            className="mb-5 flex h-12 w-12 items-center justify-center rounded-[14px] anim-pulse-ring"
            style={{ background: "var(--surface-glass)", border: "1px solid var(--border-mid)", boxShadow: "var(--shadow-sm)" }}
          >
            <KeyRound size={20} style={{ color: "var(--accent)" }} />
          </div>

          <h1 className="text-xl font-semibold" style={{ color: "var(--fg)" }}>
            Sign in to Clearweight
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
            Connect your Codex account to unlock AI-powered decision matrix generation.
          </p>

          {/* success banner */}
          {connected === "codex" && (
            <div
              className="mt-5 flex items-center gap-2.5 rounded-[12px] px-4 py-3 text-[13px] font-medium anim-fade"
              style={{ background: "rgba(52, 211, 153, 0.06)", border: "1px solid rgba(52, 211, 153, 0.12)", color: "rgb(110, 231, 183)" }}
            >
              <CheckCircle2 size={15} />
              Connected successfully. You can now generate matrices.
            </div>
          )}

          {/* error banner */}
          {error && (
            <div
              className="mt-5 rounded-[12px] px-4 py-3 text-[13px] font-medium anim-fade"
              style={{ background: "rgba(248, 113, 113, 0.06)", border: "1px solid rgba(248, 113, 113, 0.12)", color: "rgb(252, 165, 165)" }}
            >
              {errorMessages[error] ?? "Sign-in failed. Please try again."}
            </div>
          )}

          {/* CTA button */}
          <a
            href="/api/auth/codex/start?returnTo=/"
            className="mt-6 flex h-11 w-full items-center justify-center gap-2.5 rounded-[12px] text-[13px] font-semibold transition-all duration-200 hover:scale-[1.01] hover:brightness-110 active:scale-[0.99]"
            style={{ background: "var(--accent)", color: "var(--bg)", boxShadow: "var(--shadow-sm)" }}
          >
            <KeyRound size={15} />
            Continue with Codex
          </a>

          {/* divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>How it works</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          {/* steps */}
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-start gap-3 anim-cascade" style={{ animationDelay: `${200 + i * 100}ms` }}>
                <div
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <step.icon size={13} style={{ color: "var(--accent-dim)" }} />
                </div>
                <div>
                  <div className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>{step.label}</div>
                  <div className="text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* session status card */}
        <div className="anim-cascade" style={{ animationDelay: "500ms" }}>
          <SignInStatus />
        </div>

        {/* footer note */}
        <div
          className="glass-inner px-5 py-3.5 text-[11px] leading-relaxed anim-cascade"
          style={{ color: "var(--muted)", animationDelay: "600ms" }}
        >
          Clearweight uses OAuth PKCE to securely authenticate with Codex. Your credentials are never stored — only a short-lived session token is kept.
        </div>
      </div>
    </main>
  );
}
