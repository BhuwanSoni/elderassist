import { useEffect, useRef } from "react";

// ── Emotion config ────────────────────────────────────────────────────────────
const EMOTION_CONFIG = {
  confused:  { emoji: "😕", color: "#f97316", bg: "rgba(249,115,22,0.12)",  label: "Confused"   },
  anxious:   { emoji: "😰", color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Anxious"    },
  distressed:{ emoji: "😟", color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Distressed" },
  calm:      { emoji: "😌", color: "#22c55e", bg: "rgba(34,197,94,0.12)",   label: "Calm"       },
  happy:     { emoji: "😊", color: "#22c55e", bg: "rgba(34,197,94,0.12)",   label: "Happy"      },
  sad:       { emoji: "😢", color: "#818cf8", bg: "rgba(129,140,248,0.12)", label: "Sad"        },
  neutral:   { emoji: "😐", color: "#94a3b8", bg: "rgba(148,163,184,0.10)", label: "Neutral"    },
  fearful:   { emoji: "😨", color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Fearful"    },
  hopeful:   { emoji: "🙂", color: "#34d399", bg: "rgba(52,211,153,0.12)",  label: "Hopeful"    },
};

// ── Risk level config ─────────────────────────────────────────────────────────
const RISK_CONFIG = {
  High:     { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   dot: "#ef4444", label: "High",     icon: "🔴" },
  Moderate: { color: "#f97316", bg: "rgba(249,115,22,0.12)",  dot: "#f97316", label: "Moderate", icon: "🟠" },
  Low:      { color: "#22c55e", bg: "rgba(34,197,94,0.12)",   dot: "#22c55e", label: "Low",      icon: "🟢" },
};

// ── Derive risk from cognitive_score (0–1 float from backend) ────────────────
function deriveRisk(cogScore) {
  if (cogScore === null || cogScore === undefined) return null;
  if (cogScore < 0.35) return "High";
  if (cogScore < 0.65) return "Moderate";
  return "Low";
}

// ── Resolve emotion: backend string → config key ──────────────────────────────
function resolveEmotion(raw) {
  if (!raw) return null;
  const key = raw.toLowerCase().trim();
  return EMOTION_CONFIG[key] ?? {
    emoji: "🫥",
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.10)",
    label: raw.charAt(0).toUpperCase() + raw.slice(1),
  };
}

// ── Pulse dot (reused from App.jsx style) ────────────────────────────────────
function PulsingDot({ color }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 8, height: 8 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite", opacity: 0.6 }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
    </span>
  );
}

// ── Gauge bar ─────────────────────────────────────────────────────────────────
function MiniBar({ value, color }) {
  const pct = Math.min(Math.max(value, 0), 1) * 100;
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", marginTop: 6 }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        borderRadius: 99,
        transition: "width 0.7s cubic-bezier(0.34,1.56,0.64,1)",
        boxShadow: `0 0 8px ${color}55`,
      }} />
    </div>
  );
}

// ── Animated number hook (matches App.jsx) ────────────────────────────────────
import { useState, useEffect as ue } from "react";
function useAnimNum(target, dur = 600) {
  const [v, setV] = useState(target);
  const prev = useRef(target);
  ue(() => {
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

// ── Main component ────────────────────────────────────────────────────────────
export default function AIInsights({ cogScore, emotion, severity, reasoning }) {
  // Nothing to show until at least one step has run
  if (cogScore === null && !emotion) return null;

  const risk          = deriveRisk(cogScore);
  const riskCfg       = risk ? RISK_CONFIG[risk] : null;
  const emotionCfg    = resolveEmotion(emotion);
  const animScore     = useAnimNum(cogScore != null ? Math.round(cogScore * 100) : 0);

  // Reasoning fields (from backend `reasoning` dict on /step response)
  const mode          = reasoning?.mode          || null;
  const decisionLayer = reasoning?.decision_layer || null;
  const confidence    = reasoning?.confidence    || null;
  const memoryUsed    = reasoning?.memory_used   || null;
  const flags         = reasoning?.flags         || [];

  return (
    <div style={{
      background: "rgba(15,18,30,0.85)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      backdropFilter: "blur(20px)",
      padding: 20,
      animation: "fadeIn 0.4s ease",
    }}>
      {/* Header */}
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
        color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <PulsingDot color="#818cf8" />
        AI Insights
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

        {/* ── Cognitive Score ──────────────────────────────────────── */}
        {cogScore !== null && cogScore !== undefined && (
          <div style={{
            padding: "12px 14px",
            background: "rgba(129,140,248,0.06)",
            border: "1px solid rgba(129,140,248,0.15)",
            borderRadius: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>
                📊 COGNITIVE SCORE
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: "#818cf8" }}>
                {animScore}
              </span>
            </div>
            <MiniBar value={cogScore} color="#818cf8" />
          </div>
        )}

        {/* ── Emotion ──────────────────────────────────────────────── */}
        {emotionCfg && (
          <div style={{
            padding: "10px 14px",
            background: emotionCfg.bg,
            border: `1px solid ${emotionCfg.color}33`,
            borderRadius: 12,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{emotionCfg.emoji}</span>
            <div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", marginBottom: 2 }}>
                PATIENT EMOTION
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: emotionCfg.color }}>
                {emotionCfg.label}
              </div>
            </div>
          </div>
        )}

        {/* ── Risk Level ───────────────────────────────────────────── */}
        {riskCfg && (
          <div style={{
            padding: "10px 14px",
            background: riskCfg.bg,
            border: `1px solid ${riskCfg.color}33`,
            borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PulsingDot color={riskCfg.dot} />
              <div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", marginBottom: 2 }}>
                  RISK LEVEL
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: riskCfg.color }}>
                  {riskCfg.label}
                </div>
              </div>
            </div>
            <span style={{ fontSize: 18 }}>{riskCfg.icon}</span>
          </div>
        )}

        {/* ── Agent Reasoning (shown when backend is LIVE) ──────────── */}
        {(mode || decisionLayer || confidence || memoryUsed) && (
          <div style={{
            padding: "12px 14px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", marginBottom: 10 }}>
              🤖 AGENT REASONING
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {mode && (
                <ReasoningRow label="Mode" value={mode} color="#818cf8" />
              )}
              {decisionLayer && (
                <ReasoningRow label="Layer" value={decisionLayer} color="#34d399" />
              )}
              {confidence && confidence !== "n/a" && (
                <ReasoningRow label="Confidence" value={confidence} color="#facc15" />
              )}
              {memoryUsed && memoryUsed !== "manual_input" && (
                <ReasoningRow label="Memory" value={memoryUsed} color="#f87171" />
              )}
            </div>
            {flags.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                {flags.map(f => (
                  <span key={f} style={{
                    fontSize: 9, padding: "2px 7px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 99, color: "rgba(255,255,255,0.4)",
                    letterSpacing: "0.08em",
                  }}>{f}</span>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function ReasoningRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: "monospace",
        background: `${color}11`, padding: "1px 8px", borderRadius: 99 }}>
        {value}
      </span>
    </div>
  );
}