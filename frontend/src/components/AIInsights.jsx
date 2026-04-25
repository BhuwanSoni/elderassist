import { useState, useEffect, useRef } from "react";

// ── Emotion config ─────────────────────────────────────────────────────────────
const EMOTION_CONFIG = {
  confused:   { emoji: "😕", color: "#f97316", bg: "rgba(249,115,22,0.10)",  glow: "rgba(249,115,22,0.20)",  label: "Confused"   },
  anxious:    { emoji: "😰", color: "#ef4444", bg: "rgba(239,68,68,0.10)",   glow: "rgba(239,68,68,0.20)",   label: "Anxious"    },
  distressed: { emoji: "😟", color: "#ef4444", bg: "rgba(239,68,68,0.10)",   glow: "rgba(239,68,68,0.20)",   label: "Distressed" },
  calm:       { emoji: "😌", color: "#22c55e", bg: "rgba(34,197,94,0.10)",   glow: "rgba(34,197,94,0.20)",   label: "Calm"       },
  happy:      { emoji: "😊", color: "#4ade80", bg: "rgba(74,222,128,0.10)",  glow: "rgba(74,222,128,0.20)",  label: "Happy"      },
  sad:        { emoji: "😢", color: "#818cf8", bg: "rgba(129,140,248,0.10)", glow: "rgba(129,140,248,0.20)", label: "Sad"        },
  neutral:    { emoji: "😐", color: "#94a3b8", bg: "rgba(148,163,184,0.07)", glow: "rgba(148,163,184,0.12)", label: "Neutral"    },
  fearful:    { emoji: "😨", color: "#ef4444", bg: "rgba(239,68,68,0.10)",   glow: "rgba(239,68,68,0.20)",   label: "Fearful"    },
  hopeful:    { emoji: "🙂", color: "#34d399", bg: "rgba(52,211,153,0.10)",  glow: "rgba(52,211,153,0.20)",  label: "Hopeful"    },
};

const RISK_CONFIG = {
  High:     { color: "#ef4444", bg: "rgba(239,68,68,0.10)",  dot: "#ef4444", label: "High Risk",     icon: "⚠" },
  Moderate: { color: "#f97316", bg: "rgba(249,115,22,0.10)", dot: "#f97316", label: "Moderate Risk", icon: "◈" },
  Low:      { color: "#22c55e", bg: "rgba(34,197,94,0.10)",  dot: "#22c55e", label: "Low Risk",      icon: "✓" },
};

const MODE_COLOR = { "LLM+RL": "#818cf8", "RL+RULE": "#34d399", "RULE": "#facc15", "Q-TABLE": "#fb923c" };

function deriveRisk(cogScore) {
  if (cogScore == null) return null;
  if (cogScore < 0.35) return "High";
  if (cogScore < 0.65) return "Moderate";
  return "Low";
}

function resolveEmotion(raw) {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return EMOTION_CONFIG[key] ?? {
    emoji: "🫥", color: "#94a3b8", bg: "rgba(148,163,184,0.07)", glow: "rgba(148,163,184,0.12)",
    label: raw.charAt(0).toUpperCase() + raw.slice(1),
  };
}

function useAnimNum(target, dur = 700) {
  const [v, setV] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const s = prev.current, e = target, t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setV(Math.round((s + (e - s) * ease) * 100) / 100);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    prev.current = target;
  }, [target, dur]);
  return v;
}

function PulsingDot({ color, size = 8 }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite", opacity: 0.5 }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
    </span>
  );
}

function ScoreArc({ value, color }) {
  const r = 30, cx = 36, cy = 36;
  const pct = Math.min(Math.max(value, 0), 1);
  const angle = pct * 270;
  const toRad = d => d * Math.PI / 180;
  const startAngle = 135;
  const endAngle = startAngle + angle;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const largeArc = angle > 180 ? 1 : 0;
  const trackX2 = cx + r * Math.cos(toRad(startAngle + 270));
  const trackY2 = cy + r * Math.sin(toRad(startAngle + 270));

  return (
    <svg viewBox="0 0 72 72" style={{ width: 72, height: 72, display: "block" }}>
      <path d={`M ${x1} ${y1} A ${r} ${r} 0 1 1 ${trackX2} ${trackY2}`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" strokeLinecap="round" />
      {pct > 0 && (
        <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
          fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${color}88)` }} />
      )}
      <text x={cx} y={cy - 3} textAnchor="middle"
        style={{ fontSize: 13, fontWeight: 800, fill: "white", fontFamily: "monospace" }}>
        {Math.round(pct * 100)}
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle"
        style={{ fontSize: 6, fill: "rgba(255,255,255,0.3)", fontFamily: "sans-serif", letterSpacing: "0.1em" }}>
        COG
      </text>
    </svg>
  );
}

function FlagPill({ label }) {
  const isGood = label.includes("completed") || label.includes("confirmed");
  const isBad  = label.includes("decay") || label.includes("emergency") || label.includes("missed");
  const color  = isGood ? "#34d399" : isBad ? "#f87171" : "rgba(255,255,255,0.3)";
  const bg     = isGood ? "rgba(52,211,153,0.07)" : isBad ? "rgba(248,113,113,0.07)" : "rgba(255,255,255,0.03)";
  const border = isGood ? "rgba(52,211,153,0.18)" : isBad ? "rgba(248,113,113,0.18)" : "rgba(255,255,255,0.06)";
  return (
    <span style={{ fontSize: 8, padding: "2px 7px", background: bg, border: `1px solid ${border}`, borderRadius: 99, color, letterSpacing: "0.06em", fontFamily: "monospace", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function ReasoningRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color, background: `${color}11`, padding: "2px 8px", borderRadius: 99, fontFamily: "monospace", border: `1px solid ${color}22`, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </span>
    </div>
  );
}

function Sep() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "1px 0" }} />;
}

export default function AIInsights({ cogScore, emotion, severity, reasoning }) {
  if (cogScore === null && !emotion && !reasoning) return null;

  const risk       = deriveRisk(cogScore);
  const riskCfg    = risk ? RISK_CONFIG[risk] : null;
  const emotionCfg = resolveEmotion(emotion);

  const mode          = reasoning?.mode          || null;
  const decisionLayer = reasoning?.decision_layer || null;
  const confidence    = reasoning?.confidence    || null;
  const memoryUsed    = reasoning?.memory_used   || null;
  const rlAction      = reasoning?.rl_action     || null;
  const flags         = (reasoning?.flags        || []).filter(Boolean);
  const modeColor     = MODE_COLOR[mode] || "#818cf8";

  const SEVER_COLOR = { severe: "#ef4444", moderate: "#f97316", mild: "#eab308", minimal: "#22c55e" };

  return (
    <div style={{
      background: "rgba(10,12,22,0.94)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      backdropFilter: "blur(24px)",
      overflow: "hidden",
      animation: "fadeIn 0.4s ease",
    }}>
      {/* Header */}
      <div style={{
        padding: "9px 15px", borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(129,140,248,0.04)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <PulsingDot color="#818cf8" size={7} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
            AI Insights
          </span>
        </div>
        {mode && (
          <span style={{ fontSize: 8, fontWeight: 700, color: modeColor, background: `${modeColor}12`, border: `1px solid ${modeColor}25`, padding: "2px 8px", borderRadius: 99, fontFamily: "monospace", letterSpacing: "0.06em" }}>
            {mode}
          </span>
        )}
      </div>

      <div style={{ padding: "13px 15px", display: "flex", flexDirection: "column", gap: 9 }}>

        {/* Score + Risk + Severity row */}
        {(cogScore != null || riskCfg) && (
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            {cogScore != null && (
              <div style={{ flex: "0 0 auto", padding: "8px", background: "rgba(129,140,248,0.05)", border: "1px solid rgba(129,140,248,0.12)", borderRadius: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <ScoreArc value={cogScore} color={riskCfg?.dot || "#818cf8"} />
              </div>
            )}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {riskCfg && (
                <div style={{ flex: 1, padding: "9px 11px", background: riskCfg.bg, border: `1px solid ${riskCfg.color}25`, borderRadius: 10, display: "flex", alignItems: "center", gap: 7 }}>
                  <PulsingDot color={riskCfg.dot} size={6} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em", marginBottom: 2 }}>RISK LEVEL</div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: riskCfg.color, lineHeight: 1 }}>{riskCfg.label}</div>
                  </div>
                  <span style={{ fontSize: 15 }}>{riskCfg.icon}</span>
                </div>
              )}
              {severity && (
                <div style={{ padding: "6px 11px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.055)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em" }}>SEVERITY</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", color: SEVER_COLOR[severity] || "#94a3b8", fontFamily: "monospace" }}>
                    {severity.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <Sep />

        {/* Emotion */}
        {emotionCfg && (
          <div style={{
            padding: "9px 11px", background: emotionCfg.bg,
            border: `1px solid ${emotionCfg.color}25`, borderRadius: 10,
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: `0 0 16px ${emotionCfg.glow}`,
          }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{emotionCfg.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: "0.12em", marginBottom: 3 }}>PATIENT EMOTION</div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: emotionCfg.color, lineHeight: 1 }}>{emotionCfg.label}</div>
            </div>
          </div>
        )}

        {/* Reasoning */}
        {(mode || decisionLayer || confidence || rlAction) && (
          <>
            <Sep />
            <div>
              <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.22)", letterSpacing: "0.15em", marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
                <span>🤖</span><span>AGENT REASONING</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {mode          && <ReasoningRow label="Mode"       value={mode}          color={modeColor} />}
                {decisionLayer && <ReasoningRow label="Layer"      value={decisionLayer} color="#34d399"   />}
                {rlAction      && <ReasoningRow label="RL Action"  value={rlAction}      color="#facc15"   />}
                {confidence && confidence !== "n/a" && (
                  <ReasoningRow label="Confidence" value={confidence}
                    color={["high","HIGH"].includes(confidence) ? "#4ade80" : confidence === "MEDIUM" ? "#eab308" : "#94a3b8"} />
                )}
                {memoryUsed && !["manual_input","mock"].includes(memoryUsed) && (
                  <ReasoningRow label="Memory" value={memoryUsed} color="#f87171" />
                )}
              </div>
            </div>
          </>
        )}

        {/* Flags */}
        {flags.length > 0 && (
          <>
            <Sep />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {flags.map(f => <FlagPill key={f} label={f} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}