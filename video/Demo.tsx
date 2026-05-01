import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
  useVideoConfig,
  Sequence,
  Easing,
} from "remotion";

/* ─── palette ─── */
const BG = "#0a0a0a";
const FG = "#f5f5f5";
const FG2 = "#d4d4d4";
const MUTED = "#a3a3a3";
const DIM = "#737373";
const SURFACE = "rgba(255,255,255,0.06)";
const SURFACE_B = "rgba(255,255,255,0.09)";
const BORDER = "rgba(255,255,255,0.10)";
const BORDER_B = "rgba(255,255,255,0.16)";
const ACCENT = "#e5e5e5";
const GREEN = "#34d399";
const AMBER = "#fbbf24";
const RED = "#f87171";

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO = "'SF Mono', 'Fira Code', Menlo, monospace";

/* ─── helpers ─── */
const ease = (
  f: number,
  from: number,
  to: number,
  start: number,
  end: number,
) =>
  interpolate(f, [start, end], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

const fadeOut = (f: number, start: number, dur: number) =>
  interpolate(f, [start, start + dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const center: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
};

/* ─── ambient glow ─── */
const Glow: React.FC<{
  x: string;
  y: string;
  size: number;
  color: string;
  opacity?: number;
}> = ({ x, y, size, color, opacity = 0.12 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: size,
      height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      opacity,
      filter: "blur(60px)",
      transform: "translate(-50%, -50%)",
    }}
  />
);

/* ─── Logo SVG ─── */
const Logo: React.FC<{ size?: number; opacity?: number }> = ({
  size = 120,
  opacity = 1,
}) => (
  <div
    style={{
      width: size + 24,
      height: size + 24,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: size * 0.22,
      background: SURFACE_B,
      border: `1px solid ${BORDER_B}`,
      boxShadow: `0 0 80px rgba(255,255,255,0.04), 0 4px 32px rgba(0,0,0,0.5)`,
      opacity,
    }}
  >
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
    >
      <rect width="512" height="512" rx="112" fill="#0a0a0a" />
      <circle cx="256" cy="85" r="42" stroke="#d4d4d4" strokeWidth="16" />
      <line x1="214" y1="85" x2="298" y2="85" stroke="#d4d4d4" strokeWidth="19" strokeLinecap="round" />
      <line x1="256" y1="127" x2="256" y2="320" stroke="#d4d4d4" strokeWidth="16" strokeLinecap="round" />
      <path d="M256 192 L85 170" stroke="#d4d4d4" strokeWidth="14" strokeLinecap="round" />
      <path d="M256 192 L427 170" stroke="#d4d4d4" strokeWidth="14" strokeLinecap="round" />
      <line x1="85" y1="170" x2="53" y2="256" stroke="#d4d4d4" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
      <line x1="85" y1="170" x2="160" y2="256" stroke="#d4d4d4" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
      <rect x="43" y="256" width="128" height="96" rx="21" stroke="#d4d4d4" strokeWidth="12" />
      <line x1="107" y1="256" x2="107" y2="352" stroke="#d4d4d4" strokeWidth="7" opacity="0.35" />
      <line x1="43" y1="304" x2="171" y2="304" stroke="#d4d4d4" strokeWidth="7" opacity="0.35" />
      <line x1="427" y1="170" x2="352" y2="256" stroke="#d4d4d4" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
      <line x1="427" y1="170" x2="459" y2="256" stroke="#d4d4d4" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
      <rect x="341" y="256" width="128" height="96" rx="21" stroke="#d4d4d4" strokeWidth="12" />
      <line x1="405" y1="256" x2="405" y2="352" stroke="#d4d4d4" strokeWidth="7" opacity="0.35" />
      <line x1="341" y1="304" x2="469" y2="304" stroke="#d4d4d4" strokeWidth="7" opacity="0.35" />
      <circle cx="75" cy="280" r="10" fill="#d4d4d4" opacity="0.6" />
      <circle cx="139" cy="330" r="10" fill="#d4d4d4" opacity="0.4" />
      <circle cx="437" cy="280" r="10" fill="#d4d4d4" opacity="0.4" />
      <circle cx="373" cy="330" r="10" fill="#d4d4d4" opacity="0.6" />
      <path d="M256 320 L192 470" stroke="#d4d4d4" strokeWidth="14" strokeLinecap="round" />
      <path d="M256 320 L320 470" stroke="#d4d4d4" strokeWidth="14" strokeLinecap="round" />
      <line x1="171" y1="470" x2="341" y2="470" stroke="#d4d4d4" strokeWidth="16" strokeLinecap="round" />
    </svg>
  </div>
);

/* ─── glass card ─── */
const Glass: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  bright?: boolean;
}> = ({ children, style, bright }) => (
  <div
    style={{
      background: bright ? SURFACE_B : SURFACE,
      border: `1px solid ${bright ? BORDER_B : BORDER}`,
      borderRadius: 20,
      boxShadow: "0 4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
      backdropFilter: "blur(40px)",
      ...style,
    }}
  >
    {children}
  </div>
);

/* ════════════════════════════════════════════
   SCENE 1: HERO — Logo + Title + Tagline
   Frames 0–149 (5 seconds)
   ════════════════════════════════════════════ */
const SceneHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, from: 0.5, to: 1, config: { damping: 14, stiffness: 80 } });
  const logoOpacity = ease(frame, 0, 1, 0, 25);
  const titleY = ease(frame, 40, 0, 20, 50);
  const titleOpacity = ease(frame, 0, 1, 20, 50);
  const tagY = ease(frame, 30, 0, 40, 65);
  const tagOpacity = ease(frame, 0, 1, 40, 65);
  const pillsOpacity = ease(frame, 0, 1, 60, 82);
  const pillsY = ease(frame, 20, 0, 60, 82);
  const sceneOut = fadeOut(frame, 125, 25);

  return (
    <AbsoluteFill style={{ ...center, background: BG, opacity: sceneOut }}>
      <Glow x="30%" y="35%" size={700} color="rgba(255,255,255,0.08)" opacity={0.15} />
      <Glow x="70%" y="65%" size={500} color="rgba(255,255,255,0.05)" opacity={0.1} />

      <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity }}>
        <Logo size={130} />
      </div>

      <div
        style={{
          marginTop: 36,
          fontSize: 64,
          fontWeight: 700,
          fontFamily: FONT,
          color: FG,
          letterSpacing: "-0.04em",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Clearweight
      </div>

      <div
        style={{
          marginTop: 14,
          fontSize: 24,
          fontFamily: FONT,
          fontWeight: 400,
          color: MUTED,
          letterSpacing: "-0.01em",
          opacity: tagOpacity,
          transform: `translateY(${tagY}px)`,
        }}
      >
        AI-powered weighted decision matrix
      </div>

      <div
        style={{
          marginTop: 32,
          display: "flex",
          gap: 10,
          opacity: pillsOpacity,
          transform: `translateY(${pillsY}px)`,
        }}
      >
        {["Open Source", "No Server Storage", "MIT Licensed"].map((t) => (
          <span
            key={t}
            style={{
              padding: "8px 20px",
              borderRadius: 100,
              border: `1px solid ${BORDER}`,
              background: SURFACE,
              fontSize: 14,
              fontFamily: FONT,
              fontWeight: 500,
              color: FG2,
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════
   SCENE 2: TYPING — Prompt input
   Frames 150–299 (5 seconds)
   ════════════════════════════════════════════ */
const SceneTyping: React.FC = () => {
  const frame = useCurrentFrame();
  const text = "Should I take the SF offer or stay remote in Austin?";

  const sceneIn = ease(frame, 0, 1, 0, 18);
  const charCount = Math.floor(ease(frame, 0, text.length, 12, 95));
  const typed = text.slice(0, charCount);
  const cursorVisible = Math.sin(frame * 0.35) > 0;
  const btnOpacity = ease(frame, 0, 1, 85, 105);
  const btnScale = spring({ frame: Math.max(0, frame - 85), fps: 30, from: 0.8, to: 1, config: { damping: 12 } });
  const sceneOut = fadeOut(frame, 130, 20);

  return (
    <AbsoluteFill style={{ ...center, background: BG, opacity: sceneIn * sceneOut }}>
      <Glow x="50%" y="40%" size={800} color="rgba(255,255,255,0.06)" opacity={0.12} />

      {/* label */}
      <div
        style={{
          fontSize: 13,
          fontFamily: FONT,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color: DIM,
          marginBottom: 16,
          opacity: ease(frame, 0, 1, 0, 15),
        }}
      >
        Describe your decision
      </div>

      {/* input card */}
      <Glass
        bright
        style={{
          width: 800,
          padding: "32px 36px",
          transform: `translateY(${ease(frame, 20, 0, 0, 18)}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              flex: 1,
              fontSize: 22,
              fontFamily: FONT,
              fontWeight: 400,
              color: FG,
              lineHeight: 1.5,
              minHeight: 33,
            }}
          >
            {typed}
            <span style={{ opacity: cursorVisible ? 1 : 0, color: ACCENT }}>
              |
            </span>
          </span>
        </div>
      </Glass>

      {/* generate button */}
      <div
        style={{
          marginTop: 20,
          opacity: btnOpacity,
          transform: `scale(${btnScale})`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: ACCENT,
            color: BG,
            borderRadius: 14,
            padding: "12px 32px",
            fontSize: 15,
            fontFamily: FONT,
            fontWeight: 600,
            boxShadow: "0 4px 24px rgba(255,255,255,0.08)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          Generate Matrix
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════
   SCENE 3: MATRIX — Results + score bars
   Frames 300–509 (7 seconds)
   ════════════════════════════════════════════ */
const SceneMatrix: React.FC = () => {
  const frame = useCurrentFrame();

  const options = ["SF Offer", "Stay Remote"];
  const criteria = [
    { name: "Compensation", weight: 30, scores: [88, 62] },
    { name: "Work-Life Balance", weight: 25, scores: [45, 91] },
    { name: "Career Growth", weight: 25, scores: [82, 68] },
    { name: "Cost of Living", weight: 20, scores: [30, 85] },
  ];
  const finals = [63.6, 76.2];

  const sceneIn = ease(frame, 0, 1, 0, 20);
  const sceneOut = fadeOut(frame, 185, 25);

  /* leader card */
  const leaderIn = ease(frame, 0, 1, 10, 30);
  const leaderY = ease(frame, 20, 0, 10, 30);

  /* score bar animation helper */
  const barProgress = (rowIdx: number, colIdx: number) => {
    const delay = 35 + rowIdx * 18 + colIdx * 6;
    return ease(frame, 0, 1, delay, delay + 30);
  };

  /* finals */
  const finalsIn = ease(frame, 0, 1, 120, 145);

  /* winner highlight */
  const winnerGlow = ease(frame, 0, 0.25, 145, 170);

  return (
    <AbsoluteFill style={{ ...center, background: BG, opacity: sceneIn * sceneOut, padding: 60 }}>
      <Glow x="25%" y="30%" size={600} color="rgba(52,211,153,0.06)" opacity={0.1} />
      <Glow x="75%" y="70%" size={500} color="rgba(255,255,255,0.04)" opacity={0.08} />

      <div style={{ width: "100%", maxWidth: 960 }}>
        {/* header */}
        <div
          style={{
            fontSize: 13,
            fontFamily: FONT,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            color: DIM,
            marginBottom: 20,
            opacity: ease(frame, 0, 1, 0, 15),
          }}
        >
          Decision Matrix
        </div>

        {/* leader summary */}
        <Glass
          style={{
            padding: "16px 24px",
            marginBottom: 24,
            opacity: leaderIn,
            transform: `translateY(${leaderY}px)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={GREEN} stroke="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <span style={{ fontSize: 15, fontFamily: FONT, fontWeight: 500, color: FG }}>
              Stay Remote leads with 76.2 points — ahead of SF Offer by 12.6
            </span>
          </div>
        </Glass>

        {/* column headers */}
        <div style={{ display: "flex", marginBottom: 10, opacity: ease(frame, 0, 1, 15, 30) }}>
          <div style={{ width: 200 }} />
          {options.map((opt, i) => (
            <div
              key={opt}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 16,
                fontFamily: FONT,
                fontWeight: 600,
                color: FG2,
                opacity: ease(frame, 0, 1, 18 + i * 5, 32 + i * 5),
              }}
            >
              {opt}
            </div>
          ))}
        </div>

        {/* criteria rows */}
        {criteria.map((c, ci) => {
          const rowDelay = 25 + ci * 15;
          const rowIn = ease(frame, 0, 1, rowDelay, rowDelay + 18);
          const rowY = ease(frame, 24, 0, rowDelay, rowDelay + 18);

          return (
            <div
              key={c.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
                opacity: rowIn,
                transform: `translateY(${rowY}px)`,
              }}
            >
              {/* label */}
              <div style={{ width: 200 }}>
                <div style={{ fontSize: 15, fontFamily: FONT, fontWeight: 500, color: FG2 }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 11, fontFamily: MONO, color: DIM, marginTop: 2 }}>
                  {c.weight}%
                </div>
              </div>

              {/* score cards */}
              {c.scores.map((score, si) => {
                const progress = barProgress(ci, si);
                const displayScore = Math.round(score * progress);
                const barColor =
                  score >= 80 ? GREEN :
                  score >= 60 ? FG2 :
                  score >= 40 ? AMBER :
                  RED;

                return (
                  <div key={si} style={{ flex: 1 }}>
                    <Glass
                      style={{
                        padding: "14px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          background: "rgba(255,255,255,0.06)",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${score * progress}%`,
                            height: "100%",
                            background: barColor,
                            borderRadius: 4,
                            opacity: 0.7,
                            transition: "none",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 14,
                          fontFamily: MONO,
                          fontWeight: 600,
                          color: FG,
                          minWidth: 30,
                          textAlign: "right",
                          opacity: progress,
                        }}
                      >
                        {displayScore}
                      </span>
                    </Glass>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* divider */}
        <div
          style={{
            height: 1,
            background: BORDER_B,
            marginTop: 16,
            marginBottom: 16,
            opacity: finalsIn,
          }}
        />

        {/* final scores */}
        <div style={{ display: "flex", alignItems: "center", opacity: finalsIn }}>
          <div style={{ width: 200 }}>
            <span
              style={{
                fontSize: 13,
                fontFamily: FONT,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: MUTED,
              }}
            >
              Weighted Score
            </span>
          </div>
          {finals.map((score, i) => {
            const isWinner = i === 1;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 36,
                    fontFamily: MONO,
                    fontWeight: 700,
                    color: isWinner ? FG : FG2,
                    textShadow: isWinner ? `0 0 40px rgba(52,211,153,${winnerGlow})` : "none",
                  }}
                >
                  {score.toFixed(1)}
                </span>
                {isWinner && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      fontFamily: FONT,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase" as const,
                      color: GREEN,
                      opacity: ease(frame, 0, 1, 150, 170),
                    }}
                  >
                    Winner
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════
   SCENE 4: FEATURES — Showcase cards
   Frames 510–619 (3.7 seconds)
   ════════════════════════════════════════════ */
const SceneFeatures: React.FC = () => {
  const frame = useCurrentFrame();

  const features = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={FG2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
      title: "AI-Generated Matrices",
      desc: "2–12 options, 3–10 criteria",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={FG2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      ),
      title: "Adjustable Weights",
      desc: "Drag sliders with origin trails",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={FG2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      title: "Hard Gates",
      desc: "Mandatory pass/fail constraints",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={FG2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      title: "Sensitivity Analysis",
      desc: "Flags fragile winners",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={FG2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ),
      title: "Dark & Light Modes",
      desc: "Premium glassmorphism UI",
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={FG2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      ),
      title: "No Server Storage",
      desc: "Your key stays in your browser",
    },
  ];

  const sceneIn = ease(frame, 0, 1, 0, 15);
  const titleIn = ease(frame, 0, 1, 0, 20);
  const sceneOut = fadeOut(frame, 90, 20);

  return (
    <AbsoluteFill style={{ ...center, background: BG, opacity: sceneIn * sceneOut }}>
      <Glow x="50%" y="50%" size={900} color="rgba(255,255,255,0.04)" opacity={0.1} />

      <div
        style={{
          fontSize: 13,
          fontFamily: FONT,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase" as const,
          color: DIM,
          marginBottom: 32,
          opacity: titleIn,
        }}
      >
        Features
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
          maxWidth: 900,
        }}
      >
        {features.map((f, i) => {
          const delay = 10 + i * 8;
          const cardIn = ease(frame, 0, 1, delay, delay + 16);
          const cardY = ease(frame, 24, 0, delay, delay + 16);

          return (
            <div
              key={f.title}
              style={{
                opacity: cardIn,
                transform: `translateY(${cardY}px)`,
              }}
            >
              <Glass
                style={{
                  padding: "22px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {f.icon}
                <div style={{ fontSize: 15, fontFamily: FONT, fontWeight: 600, color: FG }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 12, fontFamily: FONT, fontWeight: 400, color: MUTED }}>
                  {f.desc}
                </div>
              </Glass>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════
   SCENE 5: OUTRO — CTA
   Frames 620–719 (3.3 seconds)
   ════════════════════════════════════════════ */
const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, from: 0.6, to: 1, config: { damping: 14 } });
  const logoOpacity = ease(frame, 0, 1, 0, 20);
  const titleIn = ease(frame, 0, 1, 12, 32);
  const titleY = ease(frame, 30, 0, 12, 32);
  const urlIn = ease(frame, 0, 1, 28, 48);
  const urlY = ease(frame, 20, 0, 28, 48);
  const ghIn = ease(frame, 0, 1, 40, 58);
  const starIn = ease(frame, 0, 1, 55, 72);

  return (
    <AbsoluteFill style={{ ...center, background: BG }}>
      <Glow x="50%" y="40%" size={800} color="rgba(255,255,255,0.06)" opacity={0.12} />
      <Glow x="40%" y="60%" size={500} color="rgba(52,211,153,0.04)" opacity={0.08} />

      <div style={{ opacity: logoOpacity, transform: `scale(${logoScale})` }}>
        <Logo size={110} />
      </div>

      <div
        style={{
          marginTop: 32,
          fontSize: 52,
          fontFamily: FONT,
          fontWeight: 700,
          color: FG,
          letterSpacing: "-0.04em",
          opacity: titleIn,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Try Clearweight
      </div>

      <div
        style={{
          marginTop: 20,
          opacity: urlIn,
          transform: `translateY(${urlY}px)`,
        }}
      >
        <Glass
          bright
          style={{
            padding: "12px 28px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 20, fontFamily: MONO, fontWeight: 500, color: FG }}>
            clearweight.vercel.app
          </span>
        </Glass>
      </div>

      <div
        style={{
          marginTop: 18,
          display: "flex",
          alignItems: "center",
          gap: 8,
          opacity: ghIn,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={MUTED}>
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <span style={{ fontSize: 16, fontFamily: FONT, fontWeight: 500, color: MUTED }}>
          github.com/psagar29/clearweight
        </span>
      </div>

      <div
        style={{
          marginTop: 28,
          opacity: starIn,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={AMBER} stroke="none">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
        <span style={{ fontSize: 14, fontFamily: FONT, fontWeight: 500, color: FG2 }}>
          Star it if it helps you decide
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ════════════════════════════════════════════
   MAIN COMPOSITION — 720 frames / 24 seconds
   ════════════════════════════════════════════ */
export const ClearweightDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Sequence from={0} durationInFrames={150}>
        <SceneHero />
      </Sequence>
      <Sequence from={150} durationInFrames={150}>
        <SceneTyping />
      </Sequence>
      <Sequence from={300} durationInFrames={210}>
        <SceneMatrix />
      </Sequence>
      <Sequence from={510} durationInFrames={110}>
        <SceneFeatures />
      </Sequence>
      <Sequence from={620} durationInFrames={100}>
        <SceneOutro />
      </Sequence>
    </AbsoluteFill>
  );
};
