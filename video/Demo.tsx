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

/* ── palette ── */
const BG = "#050505";
const FG = "#e5e5e5";
const DIM = "#737373";
const ACCENT = "#a3a3a3";
const SURFACE = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";

/* ── shared styles ── */
const center: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
};

/* ── helpers ── */
const ease = (f: number, from: number, to: number, start: number, end: number) =>
  interpolate(f, [start, end], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

/* ── Logo SVG (inline, monochrome) ── */
const Logo: React.FC<{ size?: number; opacity?: number }> = ({
  size = 120,
  opacity = 1,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 512 512"
    fill="none"
    style={{ opacity }}
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
);

/* ── Scene 1: Logo reveal ── */
const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, from: 0.6, to: 1, config: { damping: 12 } });
  const logoOpacity = ease(frame, 0, 1, 0, 20);
  const titleY = ease(frame, 30, 0, 15, 40);
  const titleOpacity = ease(frame, 0, 1, 15, 40);
  const subOpacity = ease(frame, 0, 1, 30, 50);
  const tagOpacity = ease(frame, 0, 1, 45, 65);

  return (
    <AbsoluteFill style={{ ...center, background: BG }}>
      <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity }}>
        <Logo size={140} />
      </div>
      <div
        style={{
          marginTop: 28,
          fontSize: 56,
          fontWeight: 700,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: FG,
          letterSpacing: "-0.03em",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Clearweight
      </div>
      <div
        style={{
          marginTop: 12,
          fontSize: 22,
          color: DIM,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontWeight: 400,
          letterSpacing: "0.01em",
          opacity: subOpacity,
        }}
      >
        AI-powered weighted decision matrix
      </div>
      <div
        style={{
          marginTop: 20,
          fontSize: 14,
          color: ACCENT,
          fontFamily: "SF Mono, Menlo, monospace",
          opacity: tagOpacity,
          padding: "6px 16px",
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          background: SURFACE,
        }}
      >
        open source
      </div>
    </AbsoluteFill>
  );
};

/* ── Scene 2: Typing prompt ── */
const ScenePrompt: React.FC = () => {
  const frame = useCurrentFrame();
  const text = "Should I take the SF offer or stay remote in Austin?";
  const typed = text.slice(0, Math.floor(ease(frame, 0, text.length, 5, 65)));
  const cardOpacity = ease(frame, 0, 1, 0, 12);
  const cursorOpacity = Math.sin(frame * 0.3) > 0 ? 1 : 0;

  return (
    <AbsoluteFill style={{ ...center, background: BG }}>
      <div style={{ opacity: cardOpacity, width: 780 }}>
        <div
          style={{
            fontSize: 13,
            color: DIM,
            fontFamily: "system-ui, sans-serif",
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            marginBottom: 12,
          }}
        >
          Describe your decision
        </div>
        <div
          style={{
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 16,
            padding: "28px 32px",
            minHeight: 80,
          }}
        >
          <span
            style={{
              fontSize: 24,
              color: FG,
              fontFamily: "system-ui, sans-serif",
              fontWeight: 400,
              lineHeight: 1.5,
            }}
          >
            {typed}
            <span style={{ opacity: cursorOpacity, color: ACCENT }}>|</span>
          </span>
        </div>
        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              opacity: ease(frame, 0, 1, 55, 70),
              background: "rgba(255,255,255,0.08)",
              border: `1px solid rgba(255,255,255,0.12)`,
              borderRadius: 12,
              padding: "10px 28px",
              fontSize: 15,
              color: FG,
              fontFamily: "system-ui, sans-serif",
              fontWeight: 500,
            }}
          >
            Generate Matrix
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ── Scene 3: Matrix appearing ── */
const SceneMatrix: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const options = ["SF Offer", "Stay Remote"];
  const criteria = [
    { name: "Compensation", weight: 30, scores: [88, 62] },
    { name: "Work-Life Balance", weight: 25, scores: [45, 91] },
    { name: "Career Growth", weight: 25, scores: [82, 68] },
    { name: "Cost of Living", weight: 20, scores: [30, 85] },
  ];

  const headerOpacity = ease(frame, 0, 1, 0, 15);

  return (
    <AbsoluteFill style={{ ...center, background: BG, padding: 60 }}>
      {/* header */}
      <div
        style={{
          opacity: headerOpacity,
          fontSize: 13,
          color: DIM,
          fontFamily: "system-ui, sans-serif",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          marginBottom: 24,
          alignSelf: "flex-start",
        }}
      >
        Decision Matrix
      </div>

      {/* option headers */}
      <div
        style={{
          display: "flex",
          width: "100%",
          gap: 12,
          marginBottom: 12,
          opacity: ease(frame, 0, 1, 5, 20),
        }}
      >
        <div style={{ width: 200 }} />
        {options.map((opt, i) => (
          <div
            key={opt}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 18,
              fontWeight: 600,
              color: FG,
              fontFamily: "system-ui, sans-serif",
              opacity: ease(frame, 0, 1, 8 + i * 5, 22 + i * 5),
            }}
          >
            {opt}
          </div>
        ))}
      </div>

      {/* criteria rows */}
      {criteria.map((c, ci) => {
        const rowDelay = 12 + ci * 10;
        const rowOpacity = ease(frame, 0, 1, rowDelay, rowDelay + 12);
        const rowY = ease(frame, 20, 0, rowDelay, rowDelay + 12);

        return (
          <div
            key={c.name}
            style={{
              display: "flex",
              width: "100%",
              gap: 12,
              marginBottom: 10,
              opacity: rowOpacity,
              transform: `translateY(${rowY}px)`,
            }}
          >
            {/* criterion label + weight */}
            <div
              style={{
                width: 200,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  color: FG,
                  fontFamily: "system-ui, sans-serif",
                  fontWeight: 500,
                }}
              >
                {c.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: DIM,
                  fontFamily: "SF Mono, Menlo, monospace",
                  marginTop: 2,
                }}
              >
                {c.weight}%
              </div>
            </div>

            {/* score bars */}
            {c.scores.map((score, si) => {
              const barProgress = ease(
                frame,
                0,
                1,
                rowDelay + 8 + si * 4,
                rowDelay + 22 + si * 4
              );
              return (
                <div
                  key={si}
                  style={{
                    flex: 1,
                    background: SURFACE,
                    borderRadius: 12,
                    border: `1px solid ${BORDER}`,
                    padding: "14px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${score * barProgress}%`,
                        height: "100%",
                        background: `rgba(255,255,255,${0.15 + (score / 100) * 0.35})`,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      color: FG,
                      fontFamily: "SF Mono, Menlo, monospace",
                      fontWeight: 500,
                      minWidth: 28,
                      textAlign: "right",
                      opacity: barProgress,
                    }}
                  >
                    {Math.round(score * barProgress)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* final scores */}
      <div
        style={{
          display: "flex",
          width: "100%",
          gap: 12,
          marginTop: 16,
          opacity: ease(frame, 0, 1, 60, 75),
        }}
      >
        <div
          style={{
            width: 200,
            fontSize: 14,
            color: ACCENT,
            fontFamily: "system-ui, sans-serif",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
          }}
        >
          Weighted Score
        </div>
        {[63.6, 76.2].map((score, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 28,
              fontWeight: 700,
              color: FG,
              fontFamily: "SF Mono, Menlo, monospace",
              opacity: ease(frame, 0, 1, 65 + i * 5, 80 + i * 5),
            }}
          >
            {score.toFixed(1)}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ── Scene 4: Feature pills ── */
const SceneFeatures: React.FC = () => {
  const frame = useCurrentFrame();

  const features = [
    "AI-generated matrices",
    "Adjustable weights & scores",
    "Hard gates for constraints",
    "Sensitivity analysis",
    "Dark & light modes",
    "No API key needed",
  ];

  return (
    <AbsoluteFill style={{ ...center, background: BG }}>
      <div
        style={{
          fontSize: 13,
          color: DIM,
          fontFamily: "system-ui, sans-serif",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          marginBottom: 32,
          opacity: ease(frame, 0, 1, 0, 15),
        }}
      >
        Features
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "center",
          maxWidth: 700,
        }}
      >
        {features.map((f, i) => {
          const delay = 8 + i * 6;
          const opacity = ease(frame, 0, 1, delay, delay + 12);
          const y = ease(frame, 16, 0, delay, delay + 12);
          return (
            <div
              key={f}
              style={{
                opacity,
                transform: `translateY(${y}px)`,
                padding: "10px 22px",
                borderRadius: 100,
                border: `1px solid ${BORDER}`,
                background: SURFACE,
                fontSize: 16,
                color: FG,
                fontFamily: "system-ui, sans-serif",
                fontWeight: 400,
              }}
            >
              {f}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ── Scene 5: CTA / Closing ── */
const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = ease(frame, 0, 1, 0, 18);
  const titleOpacity = ease(frame, 0, 1, 10, 28);
  const urlOpacity = ease(frame, 0, 1, 22, 38);
  const ghOpacity = ease(frame, 0, 1, 32, 48);

  return (
    <AbsoluteFill style={{ ...center, background: BG }}>
      <div style={{ opacity: logoOpacity }}>
        <Logo size={100} />
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 44,
          fontWeight: 700,
          color: FG,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.03em",
          opacity: titleOpacity,
        }}
      >
        Try Clearweight
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 20,
          color: ACCENT,
          fontFamily: "SF Mono, Menlo, monospace",
          opacity: urlOpacity,
          padding: "8px 20px",
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          background: SURFACE,
        }}
      >
        clearweight.vercel.app
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 15,
          color: DIM,
          fontFamily: "system-ui, sans-serif",
          opacity: ghOpacity,
        }}
      >
        github.com/psagar29/clearweight
      </div>
    </AbsoluteFill>
  );
};

/* ── Main Composition ── */
export const ClearweightDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* Scene 1: Intro (0–89, 3s) */}
      <Sequence from={0} durationInFrames={90}>
        <SceneIntro />
      </Sequence>

      {/* Scene 2: Typing prompt (90–179, 3s) */}
      <Sequence from={90} durationInFrames={90}>
        <ScenePrompt />
      </Sequence>

      {/* Scene 3: Matrix (180–269, 3s) */}
      <Sequence from={180} durationInFrames={90}>
        <SceneMatrix />
      </Sequence>

      {/* Scene 4: Features (270–329, 2s) */}
      <Sequence from={270} durationInFrames={60}>
        <SceneFeatures />
      </Sequence>

      {/* Scene 5: Outro (330–359, 1s) */}
      <Sequence from={330} durationInFrames={30}>
        <SceneOutro />
      </Sequence>
    </AbsoluteFill>
  );
};
