"use client";

import { AlertTriangle, ChevronDown, ExternalLink, KeyRound, Loader2, LogOut, Moon, RotateCcw, Send, Sun, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clampScore,
  clampWeight,
  decisionMatrixSchema,
  effectiveWeightPercent,
  getScore,
  getScoreRationale,
  normalizeWeights,
  rankOptions,
  sanitizeMatrix,
  sensitivityWarnings,
  setOptionScore,
  type Criterion,
  type DecisionMatrix,
} from "@/lib/decision-matrix";

/* ── auth ── */
type AuthStatus = {
  signedIn: boolean;
  provider: "codex";
  profile?: {
    accountId: string | null;
    email: string | null;
    name: string | null;
    picture: string | null;
    planType: string | null;
  };
  expiresAt?: string;
  configuration?: {
    signInAvailable: boolean;
    problem: string | null;
    message: string | null;
  };
};

/* ── monochrome option palette ── */
const COLORS = [
  { bar: "from-neutral-300 to-neutral-500", dot: "bg-neutral-400", pill: "bg-neutral-500/12 text-neutral-300", pillLight: "bg-neutral-600/8 text-neutral-700" },
  { bar: "from-zinc-300 to-zinc-500",       dot: "bg-zinc-400",    pill: "bg-zinc-500/12 text-zinc-300",       pillLight: "bg-zinc-600/8 text-zinc-700" },
  { bar: "from-stone-300 to-stone-500",     dot: "bg-stone-400",   pill: "bg-stone-500/12 text-stone-300",     pillLight: "bg-stone-600/8 text-stone-700" },
  { bar: "from-slate-300 to-slate-500",     dot: "bg-slate-400",   pill: "bg-slate-500/12 text-slate-300",     pillLight: "bg-slate-600/8 text-slate-700" },
  { bar: "from-gray-300 to-gray-500",       dot: "bg-gray-400",    pill: "bg-gray-500/12 text-gray-300",       pillLight: "bg-gray-600/8 text-gray-700" },
  { bar: "from-neutral-400 to-neutral-600", dot: "bg-neutral-500", pill: "bg-neutral-600/12 text-neutral-400", pillLight: "bg-neutral-700/8 text-neutral-800" },
  { bar: "from-zinc-400 to-zinc-600",       dot: "bg-zinc-500",    pill: "bg-zinc-600/12 text-zinc-400",       pillLight: "bg-zinc-700/8 text-zinc-800" },
  { bar: "from-stone-400 to-stone-600",     dot: "bg-stone-500",   pill: "bg-stone-600/12 text-stone-400",     pillLight: "bg-stone-700/8 text-stone-800" },
];

type OptionColor = (typeof COLORS)[number];
function colorOf(i: number) { return COLORS[i % COLORS.length]; }

function scoreLabel(s: number) {
  if (s >= 85) return "Excellent";
  if (s >= 70) return "Strong";
  if (s >= 50) return "Fair";
  if (s >= 25) return "Weak";
  return "Poor";
}

type Phase = "input" | "loading" | "lifting" | "matrix";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("input");
  const [prompt, setPrompt] = useState("");
  const [matrix, setMatrix] = useState<DecisionMatrix | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [light, setLight] = useState(false);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  const [initialWeights, setInitialWeights] = useState<Map<string, number>>(new Map());
  const [needsAuth, setNeedsAuth] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const signedInName = auth?.signedIn
    ? (auth.profile?.name ?? auth.profile?.email ?? auth.profile?.accountId ?? "Connected")
    : null;
  const signInAvailable = auth?.configuration?.signInAvailable ?? true;
  const signInProblemMessage = auth?.configuration?.message ?? null;

  const ranked = useMemo(() => (matrix ? rankOptions(matrix) : []), [matrix]);
  const leader = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  const warnings = useMemo(() => (matrix ? sensitivityWarnings(matrix) : []), [matrix]);

  const colorMap = useMemo(() => {
    const map = new Map<string, number>();
    matrix?.options.forEach((o, i) => map.set(o.id, i));
    return map;
  }, [matrix]);

  useEffect(() => { if (phase === "input") inputRef.current?.focus(); }, [phase]);
  useEffect(() => { document.documentElement.classList.toggle("light", light); }, [light]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/codex/status", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<AuthStatus>) : null))
      .then((s) => { if (mounted && s) setAuth(s); })
      .catch(() => {})
      .finally(() => { if (mounted) setAuthLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/codex/logout", { method: "POST" });
    } finally {
      setAuth({ signedIn: false, provider: "codex" });
      setMatrix(null);
      setPrompt("");
      setError(null);
      setNeedsAuth(false);
      setExpandedCriteria(new Set());
      setInitialWeights(new Map());
      setPhase("input");
      setSigningOut(false);
    }
  }

  const generate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (trimmed.length < 8) { setError("Describe your decision in at least a sentence."); return; }
    if (!auth?.signedIn) {
      setNeedsAuth(true);
      setError(signInProblemMessage ?? "Sign in with your Codex account before generating a matrix.");
      setPhase("input");
      return;
    }
    setIsGenerating(true);
    setError(null);
    setNeedsAuth(false);
    setPhase("loading");
    try {
      const res = await fetch("/api/generate-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      if (res.status === 401) {
        setAuth({ signedIn: false, provider: "codex" });
        setNeedsAuth(true);
        setError("Your Codex session is not active in this browser. Sign in again.");
        setPhase("input");
        return;
      }
      const data = (await res.json()) as { matrix?: unknown; error?: string };
      if (!res.ok || !data.matrix) throw new Error(data.error ?? "Generation failed.");
      const next = sanitizeMatrix(decisionMatrixSchema.parse(data.matrix));
      setMatrix(next);
      setExpandedCriteria(new Set());
      // store initial weights for trail indicators
      const wm = new Map<string, number>();
      next.criteria.forEach((c) => wm.set(c.id, c.weight));
      setInitialWeights(wm);
      // animate: lift the input up, then show matrix
      setPhase("lifting");
      setTimeout(() => setPhase("matrix"), 450);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
      setPhase("input");
    } finally {
      setIsGenerating(false);
    }
  }, [auth?.signedIn, prompt, signInProblemMessage]);

  function updateWeight(id: string, w: number) {
    setMatrix((cur) => cur ? { ...cur, criteria: cur.criteria.map((c) => c.id === id ? { ...c, weight: clampWeight(w) } : c) } : cur);
  }
  function updateScore(optionId: string, criterionId: string, score: number) {
    setMatrix((cur) => cur ? { ...cur, options: cur.options.map((o) => o.id === optionId ? setOptionScore(o, criterionId, score) : o) } : cur);
  }
  function updateCriterion(id: string, patch: Partial<Criterion>) {
    setMatrix((cur) => cur ? { ...cur, criteria: cur.criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : cur);
  }
  function equalizeWeights() {
    setMatrix((cur) => cur ? { ...cur, criteria: normalizeWeights(cur.criteria.map((c) => ({ ...c, weight: 1 }))) } : cur);
  }
  function reset() { setPhase("input"); setMatrix(null); setPrompt(""); setError(null); }
  function onKey(e: React.KeyboardEvent) { if (e.key === "Enter" && !e.shiftKey && !isGenerating) { e.preventDefault(); generate(); } }
  function toggleCriterion(id: string) {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (authLoading) {
    return (
      <AuthGate
        light={light}
        loading
        message="Checking this browser's Codex session..."
        signInAvailable={signInAvailable}
        signInProblemMessage={signInProblemMessage}
        onToggleTheme={() => setLight((v) => !v)}
      />
    );
  }

  if (!auth?.signedIn) {
    return (
      <AuthGate
        light={light}
        message={needsAuth || error ? error ?? "Sign in with Codex to continue." : "Sign in with your Codex account to use Clearweight."}
        signInAvailable={signInAvailable}
        signInProblemMessage={signInProblemMessage}
        onToggleTheme={() => setLight((v) => !v)}
      />
    );
  }

  /* ════════════ INPUT / LOADING / LIFTING PHASE ════════════ */
  if (phase === "input" || phase === "loading" || phase === "lifting") {
    const isLifting = phase === "lifting";
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center px-5">
        {/* ambient */}
        <div className="ambient anim-breathe" style={{ width: 600, height: 600, top: "10%", left: "20%", background: "var(--glow-1)" }} />
        <div className="ambient anim-breathe" style={{ width: 500, height: 500, top: "50%", right: "10%", background: "var(--glow-2)", animationDelay: "-4s" }} />

        {/* top controls */}
        <div className="fixed right-6 top-6 z-20 flex items-center gap-2">
          <a
            href="https://github.com/psagar29/clearweight"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-all duration-200 hover:scale-110 active:scale-95"
            style={{ background: "var(--surface-hover)", color: "var(--muted)" }}
            aria-label="GitHub"
          >
            <GitHubIcon size={14} />
          </a>
          <AuthChip loading={authLoading} name={signedInName} onSignOut={signOut} busy={signingOut} />
          <ThemeToggle light={light} onToggle={() => setLight((v) => !v)} />
        </div>

        <div className={`relative z-10 w-full max-w-xl ${isLifting ? "anim-lift-up" : "anim-up"}`}>
          {/* logo */}
          <div className="mb-8 flex justify-center">
            <LogoMark size="xl" />
          </div>

          <h1 className="mb-2 text-center text-[36px] font-semibold tracking-tight sm:text-[44px]" style={{ color: "var(--fg)" }}>
            Clearweight
          </h1>
          <p className="mx-auto mb-10 max-w-sm text-center text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>
            Describe a decision and get a weighted matrix you can tune in real time.
          </p>

          {/* input */}
          <div className="glass glass-clean px-6 py-5" style={{ background: "var(--card-bg)", border: "1px solid var(--border-mid)", boxShadow: "var(--shadow-lg)" }}>
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                value={prompt}
                onChange={(e) => { setPrompt(e.target.value); if (error) setError(null); }}
                onKeyDown={onKey}
                disabled={phase === "loading"}
                placeholder="Should I take the remote job or the in-office role?"
                className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--faint)] disabled:opacity-50"
                style={{ color: "var(--fg)", caretColor: "var(--accent)" }}
              />
              <button
                type="button"
                onClick={generate}
                disabled={isGenerating}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>

          {/* loading skeleton */}
          {phase === "loading" && (
            <div className="mt-8 space-y-3 anim-fade">
              <div className="flex items-center justify-center gap-2.5 text-[13px]" style={{ color: "var(--muted)" }}>
                <Loader2 size={13} className="animate-spin" />
                Analyzing your decision...
              </div>
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-11 w-full" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* auth nudge — shown when generate returned 401 */}
          {needsAuth && phase === "input" && (
            <div className="mt-5 anim-fade">
              <div className="glass glass-clean px-5 py-4" style={{ background: "var(--card-bg)", border: "1px solid var(--border-mid)", boxShadow: "var(--shadow-md)" }}>
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                    style={{ background: "var(--surface-glass)", border: "1px solid var(--border-mid)" }}
                  >
                    <KeyRound size={14} style={{ color: "var(--accent)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
                      Sign in to generate
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
                      {signInProblemMessage ?? "Connect your Codex account to power AI matrix generation."}
                    </p>
                    {signInAvailable ? (
                      <a
                        href="/api/auth/codex/start?returnTo=/"
                        className="mt-3 inline-flex h-8 items-center gap-2 rounded-[10px] px-4 text-[12px] font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                        style={{ background: "var(--accent)", color: "var(--bg)" }}
                      >
                        <KeyRound size={12} />
                        Continue with Codex
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="mt-3 inline-flex h-8 cursor-not-allowed items-center gap-2 rounded-[10px] px-4 text-[12px] font-semibold opacity-60"
                        style={{ background: "var(--surface-hover)", color: "var(--muted)" }}
                      >
                        <KeyRound size={12} />
                        Codex sign-in unavailable
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* not signed in hint — subtle, below input */}
          {!authLoading && !auth?.signedIn && !needsAuth && phase === "input" && (
            <div className="mt-4 flex items-center justify-center gap-2 anim-fade">
              <span className="text-[11px]" style={{ color: "var(--faint)" }}>
                {signInAvailable ? (
                  <>
                    <a href="/signin" className="underline underline-offset-2 transition-colors hover:text-[var(--muted)]">Sign in with Codex</a> to generate matrices
                  </>
                ) : (
                  "Codex sign-in is not available on this deployment"
                )}
              </span>
            </div>
          )}

          {error && phase === "input" && (
            <p className="mt-5 text-center text-[13px] anim-fade" style={{ color: "#f87171" }}>{error}</p>
          )}
        </div>
      </main>
    );
  }

  /* ════════════ MATRIX PHASE ════════════ */
  const rawWeightTotal = matrix ? matrix.criteria.reduce((s, c) => s + c.weight, 0) : 0;

  return (
    <main className="relative min-h-screen px-4 pb-28 pt-4 sm:px-6">
      {/* ambient */}
      <div className="ambient anim-breathe" style={{ width: 500, height: 500, top: "3%", left: "5%", background: "var(--glow-1)" }} />
      <div className="ambient anim-breathe" style={{ width: 400, height: 400, bottom: "3%", right: "3%", background: "var(--glow-2)", animationDelay: "-4s" }} />

      {/* ── Top bar — cascades in from above ── */}
      <div className="relative z-10 mx-auto mb-8 max-w-4xl anim-cascade" style={{ animationDelay: "0ms" }}>
        <div className="topbar-glass flex items-center gap-2 px-3 py-2">
          <LogoMark size="sm" />
          <div className="mx-1 h-5 w-px" style={{ background: "var(--border)" }} />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask another decision..."
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--faint)]"
            style={{ color: "var(--fg)", caretColor: "var(--accent)" }}
          />
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={generate} disabled={isGenerating} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--bg)" }}>
              {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            </button>
            <button type="button" onClick={reset} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] transition-all duration-200 hover:scale-105 active:scale-95" style={{ background: "var(--surface-hover)", color: "var(--muted)" }}>
              <RotateCcw size={12} />
            </button>
            <div className="mx-0.5 h-5 w-px" style={{ background: "var(--border)" }} />
            <AuthChip loading={authLoading} name={signedInName} onSignOut={signOut} busy={signingOut} />
            <ThemeToggle light={light} onToggle={() => setLight((v) => !v)} />
          </div>
        </div>
      </div>

      {matrix && (
        <div className="relative z-10 mx-auto max-w-4xl space-y-6">

          {/* ── Title — cascade in ── */}
          <div className="anim-cascade text-center" style={{ animationDelay: "60ms" }}>
            <h2 className="text-lg font-semibold sm:text-xl" style={{ color: "var(--fg)" }}>{matrix.title}</h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>{matrix.shortContext}</p>
          </div>

          {/* ── Ranked results ── */}
          <div className="glass p-5 anim-cascade" style={{ animationDelay: "120ms" }}>
            <SectionLabel>Results</SectionLabel>

            {leader && (
              <div className="mb-5 rounded-[14px] px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="text-[13px] font-medium leading-relaxed" style={{ color: "var(--fg)" }}>
                  {leader.hardFailures.length
                    ? `No option clears every gate. ${leader.option.name} has the strongest weighted score.`
                    : `${leader.option.name} leads with ${leader.percent.toFixed(1)} points${runnerUp ? ` — ahead of ${runnerUp.option.name} by ${(leader.percent - runnerUp.percent).toFixed(1)}` : ""}.`}
                </p>
              </div>
            )}

            <div className="space-y-3.5">
              {ranked.map((item, rank) => {
                const c = colorOf(colorMap.get(item.option.id) ?? rank);
                return (
                  <div key={item.option.id} className="anim-cascade" style={{ animationDelay: `${180 + rank * 80}ms` }}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold"
                          style={{ background: rank === 0 ? "var(--accent)" : "var(--surface-hover)", color: rank === 0 ? "var(--bg)" : "var(--muted)" }}
                        >
                          {rank + 1}
                        </span>
                        <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                        {rank === 0 && <Trophy size={12} style={{ color: "var(--fg)" }} />}
                        <span className="text-[13px] font-medium" style={{ color: rank === 0 ? "var(--fg)" : "var(--fg-secondary)" }}>
                          {item.option.name}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color: "var(--muted)" }}>
                        {item.percent.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-[6px] overflow-hidden rounded-full" style={{ background: "var(--slider-track)" }}>
                      <div
                        className={`anim-bar h-full rounded-full bg-gradient-to-r ${c.bar}`}
                        style={{ width: `${Math.max(item.percent > 0 ? 2 : 0, item.percent)}%`, animationDelay: `${200 + rank * 120}ms` }}
                      />
                    </div>
                    {item.hardFailures.length > 0 && (
                      <p className="mt-1 text-[11px]" style={{ color: "#f87171" }}>Gate failed: {item.hardFailures.map((f) => f.name).join(", ")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Weight Controls ── */}
          <div className="anim-cascade" style={{ animationDelay: `${180 + ranked.length * 80 + 60}ms` }}>
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <SectionLabel>Weights</SectionLabel>
                <span className="text-[10px]" style={{ color: "var(--faint)" }}>Raw total {rawWeightTotal}; effective weights normalize to 100%</span>
              </div>
              <button type="button" onClick={equalizeWeights} className="rounded-[10px] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" style={{ border: "1px solid var(--border-mid)", color: "var(--muted)", background: "var(--surface)" }}>
                Equalize
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matrix.criteria.map((cr, i) => (
                <div key={cr.id} className="anim-cascade" style={{ animationDelay: `${180 + ranked.length * 80 + 120 + i * 60}ms` }}>
                  <WeightCard
                    criterion={cr}
                    effectiveWeight={effectiveWeightPercent(matrix.criteria, cr.id)}
                    initialWeight={initialWeights.get(cr.id) ?? cr.weight}
                    onChange={(w) => updateWeight(cr.id, w)}
                    onGateChange={(g) => updateCriterion(cr.id, { hardGate: g })}
                    onGateMinimumChange={(m) => updateCriterion(cr.id, { gateMinimum: clampScore(m) })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Score Matrix (accordion per criterion) ── */}
          <div className="anim-cascade" style={{ animationDelay: `${180 + ranked.length * 80 + 120 + matrix.criteria.length * 60 + 60}ms` }}>
            <div className="mb-3 flex items-center justify-between px-1">
              <SectionLabel>Detailed Scores</SectionLabel>
              <span className="text-[10px]" style={{ color: "var(--faint)" }}>Tap a criterion to expand</span>
            </div>
            <div className="space-y-2">
              {matrix.criteria.map((criterion, ci) => {
                const isOpen = expandedCriteria.has(criterion.id);
                return (
                  <div key={criterion.id} className="glass overflow-hidden anim-cascade" style={{ animationDelay: `${180 + ranked.length * 80 + 120 + matrix.criteria.length * 60 + 120 + ci * 60}ms` }}>
                    {/* header row */}
                    <button
                      type="button"
                      onClick={() => toggleCriterion(criterion.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200"
                      style={{ color: "var(--fg)" }}
                    >
                      <ChevronDown
                        size={13}
                        className="shrink-0 transition-transform duration-300"
                        style={{ color: "var(--faint)", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-medium">{criterion.name}</span>
                        <span className="ml-2 text-[10px] font-medium" style={{ color: "var(--faint)" }}>{criterion.kind}</span>
                      </div>
                      <span className="pill" style={{ background: "var(--surface)", color: "var(--accent-dim)" }}>
                        {effectiveWeightPercent(matrix.criteria, criterion.id)}%
                      </span>
                    </button>
                    {/* expanded content */}
                    <div
                      className="grid transition-all duration-400 ease-out"
                      style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4 pt-1">
                          <p className="mb-3 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>{criterion.description}</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {matrix.options.map((option, oi) => {
                              const score = getScore(option, criterion.id);
                              const rationale = getScoreRationale(option, criterion.id);
                              const c = colorOf(oi);
                              return (
                                <ScoreCard
                                  key={option.id}
                                  optionName={option.name}
                                  color={c}
                                  score={score}
                                  rationale={rationale}
                                  light={light}
                                  onChange={(s) => updateScore(option.id, criterion.id, s)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Sensitivity warnings ── */}
          {warnings.length > 0 && (
            <div className="glass p-5 anim-cascade" style={{ animationDelay: `${180 + ranked.length * 80 + 120 + matrix.criteria.length * 120 + 180}ms` }}>
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle size={12} style={{ color: "var(--muted)" }} />
                <SectionLabel>Sensitivity</SectionLabel>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {warnings.map((w) => (
                  <div key={`${w.label}-${w.detail}`} className="glass-inner px-3.5 py-2.5">
                    <div className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>{w.label}</div>
                    <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>{w.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Recommendation ── */}
          <div className="glass p-5 anim-cascade" style={{ animationDelay: `${180 + ranked.length * 80 + 120 + matrix.criteria.length * 120 + 240}ms` }}>
            <SectionLabel>Recommendation</SectionLabel>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>{matrix.recommendation}</p>
          </div>

          {/* ── Assumptions & Watch Outs ── */}
          <div className="grid gap-3 sm:grid-cols-2 anim-cascade" style={{ animationDelay: `${180 + ranked.length * 80 + 120 + matrix.criteria.length * 120 + 300}ms` }}>
            <div className="glass p-5">
              <SectionLabel>Assumptions</SectionLabel>
              <ul className="space-y-2">
                {matrix.assumptions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
                    <span className="mt-0.5 shrink-0 text-[10px]" style={{ color: "var(--faint)" }}>&#x2022;</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass p-5">
              <SectionLabel>Watch Outs</SectionLabel>
              <ul className="space-y-2">
                {matrix.watchouts.map((w, i) => (
                  <li key={i} className="flex gap-2 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
                    <span className="mt-0.5 shrink-0 text-[10px]" style={{ color: "var(--faint)" }}>!</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ═══════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="label-caps mb-3 block">{children}</span>;
}

function AuthGate({
  light,
  loading = false,
  message,
  signInAvailable,
  signInProblemMessage,
  onToggleTheme,
}: {
  light: boolean;
  loading?: boolean;
  message: string;
  signInAvailable: boolean;
  signInProblemMessage: string | null;
  onToggleTheme: () => void;
}) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-5">
      <div className="ambient anim-breathe" style={{ width: 700, height: 700, top: "5%", left: "15%", background: "var(--glow-1)" }} />
      <div className="ambient anim-breathe" style={{ width: 600, height: 600, bottom: "5%", right: "8%", background: "var(--glow-2)", animationDelay: "-4s" }} />

      {/* top-right controls */}
      <div className="fixed right-6 top-6 z-20 flex items-center gap-2">
        <a
          href="https://github.com/psagar29/clearweight"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-all duration-200 hover:scale-110 active:scale-95"
          style={{ background: "var(--surface-hover)", color: "var(--muted)" }}
          aria-label="GitHub"
        >
          <GitHubIcon size={14} />
        </a>
        <ThemeToggle light={light} onToggle={onToggleTheme} />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center anim-up">
        {/* large logo */}
        <div className="mb-8">
          <LogoMark size="xl" />
        </div>

        {/* title */}
        <h1 className="mb-2 text-center text-[40px] font-semibold tracking-tight sm:text-[48px]" style={{ color: "var(--fg)" }}>
          Clearweight
        </h1>
        <p className="mx-auto mb-10 max-w-[340px] text-center text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
          AI-powered weighted decision matrix.
          <br />
          Describe a decision. Tune the weights. Decide with clarity.
        </p>

        {/* sign-in card */}
        <div className="w-full max-w-sm">
          <div className="glass glass-clean px-7 py-7" style={{ background: "var(--card-bg)", border: "1px solid var(--border-mid)", boxShadow: "var(--shadow-lg)" }}>
            {loading ? (
              <div className="flex flex-col items-center py-4">
                <Loader2 size={22} className="animate-spin mb-4" style={{ color: "var(--accent)" }} />
                <p className="text-[14px] font-medium" style={{ color: "var(--fg)" }}>Checking session...</p>
                <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>{message}</p>
                <div className="mt-5 w-full space-y-2">
                  <div className="skeleton h-10 w-full" />
                </div>
              </div>
            ) : (
              <>
                <p className="mb-5 text-center text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>
                  {signInProblemMessage ?? message}
                </p>
                {signInAvailable ? (
                  <a
                    href="/api/auth/codex/start?returnTo=/"
                    className="flex h-12 w-full items-center justify-center gap-2.5 rounded-[14px] text-[14px] font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                    style={{ background: "var(--accent)", color: "var(--bg)", boxShadow: "var(--shadow-sm)" }}
                  >
                    <KeyRound size={16} />
                    Continue with Codex
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-[14px] text-[14px] font-semibold opacity-60"
                    style={{ background: "var(--surface-hover)", color: "var(--muted)" }}
                  >
                    <KeyRound size={16} />
                    Codex sign-in unavailable
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* feature pills */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 anim-cascade" style={{ animationDelay: "300ms" }}>
          {["AI-generated matrices", "Adjustable weights", "Sensitivity analysis", "Dark & light modes"].map((f) => (
            <span
              key={f}
              className="rounded-full px-3.5 py-1.5 text-[11px] font-medium"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* GitHub link */}
        <a
          href="https://github.com/psagar29/clearweight"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center gap-2 text-[12px] font-medium transition-all duration-200 hover:scale-[1.02] anim-cascade"
          style={{ color: "var(--faint)", animationDelay: "450ms" }}
        >
          <GitHubIcon size={13} />
          Open source on GitHub
          <ExternalLink size={10} />
        </a>
      </div>
    </main>
  );
}

/* ── Theme toggle ── */
function ThemeToggle({ light, onToggle }: { light: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] transition-all duration-300 hover:scale-110 active:scale-95"
      style={{ background: "var(--surface-hover)", color: "var(--muted)" }}
      aria-label="Toggle theme"
    >
      {light ? <Moon size={13} /> : <Sun size={13} />}
    </button>
  );
}

/* ── Auth chip ── */
function AuthChip({ loading, name, onSignOut, busy }: { loading: boolean; name: string | null; onSignOut: () => void; busy?: boolean }) {
  if (loading) {
    return (
      <div className="flex h-7 w-16 items-center justify-center rounded-[10px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="h-1.5 w-8 rounded-full skeleton" />
      </div>
    );
  }
  if (name) {
    return (
      <div className={`flex items-center gap-1 transition-opacity duration-300 ${busy ? "opacity-50 pointer-events-none" : ""}`}>
        <span className="flex items-center gap-1.5 rounded-[10px] px-2.5 py-1 text-[10px] font-medium" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="max-w-[100px] truncate">{name}</span>
        </span>
        <button type="button" onClick={onSignOut} disabled={busy} className="flex h-7 w-7 items-center justify-center rounded-[10px] transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50" style={{ background: "var(--surface-hover)", color: "var(--muted)" }} aria-label="Sign out">
          {busy ? <Loader2 size={11} className="animate-spin" /> : <LogOut size={11} />}
        </button>
      </div>
    );
  }
  return (
    <a href="/signin" className="flex items-center gap-1.5 rounded-[10px] px-2.5 py-1 text-[10px] font-medium transition-all duration-200 hover:scale-[1.02]" style={{ background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--muted)" }}>
      <KeyRound size={10} />
      Sign in
    </a>
  );
}

/* ── GitHub icon ── */
function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

/* ── Logo ── */
function LogoMark({ size = "sm" }: { size?: "sm" | "lg" | "xl" }) {
  const config = {
    sm:  { dim: "h-7 w-7",   radius: "rounded-[10px]", svgSize: 14, stroke: 2.2, detail: false, pulse: false },
    lg:  { dim: "h-16 w-16", radius: "rounded-[18px]", svgSize: 34, stroke: 1.4, detail: true,  pulse: true },
    xl:  { dim: "h-24 w-24", radius: "rounded-[24px]", svgSize: 52, stroke: 1.3, detail: true,  pulse: true },
  }[size];

  return (
    <div
      className={`flex ${config.dim} items-center justify-center ${config.radius} ${config.pulse ? "anim-pulse-ring" : ""}`}
      style={{ background: "var(--surface-glass)", border: "1px solid var(--border-mid)", boxShadow: config.pulse ? "var(--shadow-lg)" : "var(--shadow-sm)" }}
    >
      <svg width={config.svgSize} height={config.svgSize} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="8" r="4" stroke="var(--accent)" strokeWidth={config.stroke} />
        <line x1="20" y1="8" x2="28" y2="8" stroke="var(--accent)" strokeWidth={config.stroke * 1.1} strokeLinecap="round" />
        <line x1="24" y1="12" x2="24" y2="30" stroke="var(--accent)" strokeWidth={config.stroke} strokeLinecap="round" />
        <path d="M24 18 L8 16" stroke="var(--accent)" strokeWidth={config.stroke * 0.85} strokeLinecap="round" />
        <path d="M24 18 L40 16" stroke="var(--accent)" strokeWidth={config.stroke * 0.85} strokeLinecap="round" />
        {config.detail && (
          <>
            <line x1="8" y1="16" x2="5" y2="24" stroke="var(--accent)" strokeWidth={0.9} strokeLinecap="round" opacity="0.4" />
            <line x1="8" y1="16" x2="15" y2="24" stroke="var(--accent)" strokeWidth={0.9} strokeLinecap="round" opacity="0.4" />
            <line x1="40" y1="16" x2="33" y2="24" stroke="var(--accent)" strokeWidth={0.9} strokeLinecap="round" opacity="0.4" />
            <line x1="40" y1="16" x2="43" y2="24" stroke="var(--accent)" strokeWidth={0.9} strokeLinecap="round" opacity="0.4" />
          </>
        )}
        <rect x="4" y="24" width="12" height="9" rx={config.detail ? 2 : 2.5} stroke="var(--accent)" strokeWidth={config.stroke * 0.9} />
        <rect x="32" y="24" width="12" height="9" rx={config.detail ? 2 : 2.5} stroke="var(--accent)" strokeWidth={config.stroke * 0.9} />
        {config.detail && (
          <>
            <line x1="10" y1="24" x2="10" y2="33" stroke="var(--accent)" strokeWidth={0.5} opacity="0.25" />
            <line x1="4" y1="28.5" x2="16" y2="28.5" stroke="var(--accent)" strokeWidth={0.5} opacity="0.25" />
            <line x1="38" y1="24" x2="38" y2="33" stroke="var(--accent)" strokeWidth={0.5} opacity="0.25" />
            <line x1="32" y1="28.5" x2="44" y2="28.5" stroke="var(--accent)" strokeWidth={0.5} opacity="0.25" />
            <circle cx="7" cy="26.5" r="0.8" fill="var(--accent)" opacity="0.5" />
            <circle cx="13" cy="31" r="0.8" fill="var(--accent)" opacity="0.35" />
            <circle cx="41" cy="26.5" r="0.8" fill="var(--accent)" opacity="0.35" />
            <circle cx="35" cy="31" r="0.8" fill="var(--accent)" opacity="0.5" />
          </>
        )}
        <path d="M24 30 L18 44" stroke="var(--accent)" strokeWidth={config.stroke * 0.85} strokeLinecap="round" />
        <path d="M24 30 L30 44" stroke="var(--accent)" strokeWidth={config.stroke * 0.85} strokeLinecap="round" />
        <line x1="16" y1="44" x2="32" y2="44" stroke="var(--accent)" strokeWidth={config.stroke} strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ── Weight Card with origin trail ── */
function WeightCard({ criterion, effectiveWeight, initialWeight, onChange, onGateChange, onGateMinimumChange }: {
  criterion: Criterion; effectiveWeight: number; initialWeight: number; onChange: (w: number) => void; onGateChange: (g: boolean) => void; onGateMinimumChange: (m: number) => void;
}) {
  const current = criterion.weight;
  const changed = current !== initialWeight;
  const delta = current - initialWeight;
  // trail: fill between initial and current position
  const lo = Math.min(current, initialWeight);
  const hi = Math.max(current, initialWeight);

  return (
    <div className="glass-inner glass-lift px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium truncate" style={{ color: "var(--fg)" }}>{criterion.name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {changed && (
            <span className="text-[9px] font-semibold tabular-nums" style={{ color: delta > 0 ? "var(--fg-secondary)" : "var(--muted)" }}>
              {delta > 0 ? "+" : ""}{delta}
            </span>
          )}
          <span className="pill" style={{ background: "var(--accent-glow)", color: "var(--accent-dim)" }}>
            {effectiveWeight}%
          </span>
        </div>
      </div>
      {/* slider with trail */}
      <div className="weight-trail">
        <div className="weight-trail-track">
          {changed && (
            <div className="weight-trail-fill" style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
          )}
        </div>
        {changed && (
          <div className="weight-trail-mark" style={{ left: `${initialWeight}%` }} />
        )}
        <input type="range" min={0} max={100} value={current} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
          raw {current} &middot; {criterion.kind}
        </span>
        <label className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "var(--muted)" }}>
          <input type="checkbox" checked={criterion.hardGate} onChange={(e) => onGateChange(e.target.checked)} className="h-3 w-3 rounded accent-[var(--accent)]" />
          gate
        </label>
      </div>
      {criterion.hardGate && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="mb-1.5 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
            <span>min score</span>
            <span>{criterion.gateMinimum}%</span>
          </div>
          <input type="range" min={0} max={100} value={criterion.gateMinimum} onChange={(e) => onGateMinimumChange(Number(e.target.value))} />
        </div>
      )}
    </div>
  );
}

/* ── Score Card ── */
function ScoreCard({ optionName, color, score, rationale, light, onChange }: {
  optionName: string; color: OptionColor; score: number; rationale: string; light: boolean; onChange: (s: number) => void;
}) {
  return (
    <div className="glass-inner px-3.5 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 shrink-0 rounded-full ${color.dot}`} />
          <span className="text-[12px] font-medium truncate" style={{ color: "var(--fg)" }}>{optionName}</span>
          <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "var(--faint)" }}>{scoreLabel(score)}</span>
        </div>
        <span className={`pill shrink-0 ${light ? color.pillLight : color.pill}`}>{score}%</span>
      </div>
      <div className="mb-2 h-1 overflow-hidden rounded-full" style={{ background: "var(--slider-track)" }}>
        <div className={`h-full rounded-full ${color.dot} transition-all duration-300`} style={{ width: `${score}%` }} />
      </div>
      <input aria-label={`Score for ${optionName}`} type="range" min={0} max={100} value={score} onChange={(e) => onChange(Number(e.target.value))} />
      <div className="mt-1.5 grid grid-cols-3 gap-1">
        {[0, 50, 100].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="h-[22px] rounded-md text-[9px] font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: v === score ? "var(--surface-active)" : "transparent",
              border: "1px solid var(--border)",
              color: v === score ? "var(--fg)" : "var(--faint)",
            }}
          >
            {v === 50 ? "mid" : `${v}%`}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed" style={{ color: "var(--muted)" }}>{rationale}</p>
    </div>
  );
}
