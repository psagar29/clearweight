"use client";

import { LogOut, RefreshCcw, User } from "lucide-react";
import { useEffect, useState } from "react";

type CodexStatus = {
  signedIn: boolean;
  provider: "codex";
  profile?: {
    accountId: string | null;
    email: string | null;
    name: string | null;
    picture: string | null;
    planType: string | null;
  };
  scope?: string | null;
  expiresAt?: string;
};

async function loadStatus() {
  const response = await fetch("/api/auth/codex/status", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not read sign-in status.");
  return (await response.json()) as CodexStatus;
}

export function SignInStatus() {
  const [status, setStatus] = useState<CodexStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function refresh() {
    setIsBusy(true);
    setError(null);
    try {
      setStatus(await loadStatus());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read status.");
    } finally {
      setIsBusy(false);
    }
  }

  async function logout() {
    setIsBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/codex/logout", { method: "POST" });
      if (!r.ok) throw new Error("Could not sign out.");
      setStatus((await r.json()) as CodexStatus);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign out.");
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    loadStatus()
      .then((s) => { if (mounted) setStatus(s); })
      .catch((e: unknown) => {
        if (mounted) setError(e instanceof Error ? e.message : "Could not read status.");
      });
    return () => { mounted = false; };
  }, []);

  const displayName = status?.profile?.name ?? status?.profile?.email ?? status?.profile?.accountId;

  return (
    <div className="glass-inner px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {/* avatar / icon */}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: status?.signedIn ? "var(--accent)" : "var(--surface-hover)", color: status?.signedIn ? "var(--bg)" : "var(--faint)" }}
          >
            <User size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
                {status?.signedIn ? "Signed in" : "Not connected"}
              </span>
              {status?.signedIn && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </div>
            {status?.signedIn && displayName && (
              <p className="text-[11px] truncate max-w-[180px]" style={{ color: "var(--muted)" }}>{displayName}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isBusy}
          className="flex h-7 w-7 items-center justify-center rounded-[10px] transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
          style={{ background: "var(--surface-hover)", color: "var(--muted)" }}
          aria-label="Refresh status"
        >
          <RefreshCcw className={isBusy ? "animate-spin" : ""} size={12} />
        </button>
      </div>

      {status?.signedIn && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="space-y-1.5">
            {status.profile?.planType && (
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: "var(--faint)" }}>Plan</span>
                <span className="font-medium" style={{ color: "var(--fg-secondary)" }}>{status.profile.planType}</span>
              </div>
            )}
            {status.expiresAt && (
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: "var(--faint)" }}>Session expires</span>
                <span className="font-medium tabular-nums" style={{ color: "var(--fg-secondary)" }}>
                  {new Date(status.expiresAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={isBusy}
            className="mt-3 flex h-8 w-full items-center justify-center gap-2 rounded-[10px] text-[11px] font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            style={{ background: "var(--surface)", border: "1px solid var(--border-mid)", color: "var(--muted)" }}
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      )}

      {error && (
        <div
          className="mt-3 rounded-[10px] px-3.5 py-2 text-[11px] font-medium"
          style={{ background: "rgba(248, 113, 113, 0.06)", border: "1px solid rgba(248, 113, 113, 0.12)", color: "rgb(252, 165, 165)" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
