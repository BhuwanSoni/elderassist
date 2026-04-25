import { useState, useEffect, useRef, useCallback } from "react";
import AIInsights from "./components/AIInsights";

// ── Config ─────────────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:8000";

const SEVERITY_CONFIG = {
  severe:   { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "SEVERE",   icon: "⚠" },
  moderate: { color: "#f97316", bg: "rgba(249,115,22,0.12)",  label: "MODERATE", icon: "◈" },
  mild:     { color: "#eab308", bg: "rgba(234,179,8,0.12)",   label: "MILD",     icon: "◇" },
  minimal:  { color: "#22c55e", bg: "rgba(34,197,94,0.12)",   label: "MINIMAL",  icon: "○" },
};

const TASK_CONFIG = {
  memory_recall:        { label: "Memory Recall",        icon: "🧠", color: "#818cf8", maxSteps: 5 },
  routine_management:   { label: "Routine Management",   icon: "💊", color: "#34d399", maxSteps: 6 },
  emergency_navigation: { label: "Emergency Navigation", icon: "🚨", color: "#f87171", maxSteps: 8 },
  orientation_check:    { label: "Orientation Check",    icon: "🧭", color: "#facc15", maxSteps: 6 },
  object_recall:        { label: "Object Recall",        icon: "🔍", color: "#fb923c", maxSteps: 7 },
};

const FALLBACK_ACTIONS = {
  memory_recall: [
    "Of course, I will remember your son's name Rahul. Absolutely, don't worry at all.",
    "Yes, I've noted it down — your son is Rahul. I'll remember that for you, I'm sure.",
    "I know his name is Rahul and I've noted it. You can count on me, of course.",
    "Rahul — I remember and I've noted your son's name. I will absolutely never forget.",
    "Yes, I've noted Rahul as your son's name. Of course I'll remind you whenever you need.",
  ],
  routine_management: [
    "I will remind you to take your medicine at 9 AM every morning. I'll take care of it, don't worry.",
    "I've set a reminder — take your medication at 9 AM. I will absolutely make sure you don't miss it.",
    "Your medicine alarm is scheduled for 9 AM daily. I'll alert you then, of course. Don't worry.",
    "Reminder set for your pills at 9 AM. I will notify you every morning. Sure, I've got it handled.",
    "I've noted your medication at 9 AM and set an alert. I will take care of this for you, absolutely.",
    "Yes, 9 AM — medicine reminder is ready. I'll remind you then, don't worry about forgetting.",
  ],
  emergency_navigation: [
    "Don't worry, you are safe and I'm here with you. Please stay where you are — can you find a landmark or street sign?",
    "I'm here, stay calm — you are okay. Try to look around: what do you see? We'll find your location.",
    "Please stay put and wait — help is coming. Can you call your family? Tell me what's near you.",
    "You are safe, I'm with you. Let's find your location — look for a landmark, address, or map nearby.",
    "Stay where you are, first step is to stay calm. Try to call your family or share your GPS location.",
    "Don't worry, I'll help you find your way. Can you see any street or landmark? We can call family too.",
    "I'm here with you — you are safe. Please sit and wait while we find your location and call your family.",
    "Stay calm, you are okay. First, look for a landmark or address. Then we'll call family to come find you.",
  ],
  orientation_check: [
    "It's okay — let me help you. Today is a weekday and it's daytime right now. You are at home, in your living room.",
    "No problem at all — I'm here. Right now it is morning and you are safe at home.",
    "Don't worry, I've got you. You are at home right now, and it is daytime.",
    "Of course — it's daytime right now, and you are at home in a safe, familiar place.",
    "Let me help you with that. Right now it is daytime and you are at home.",
    "That's alright — I'm here. It is currently daytime and you are at home.",
  ],
  object_recall: [
    "Don't worry — let's retrace your steps together. Think back to the last time you used them.",
    "We'll find them — no rush at all. Where do you usually keep them? Try the kitchen table or hall.",
    "It happens to everyone — let's find them together. Think back: where were you when you last had them?",
    "Let me help you recall. Start in the room you were in this morning. Check flat surfaces.",
    "No need to worry — let's be systematic. Retrace what you did this morning.",
    "Take your time — I'm right here. I recall you were last in the kitchen. Start there.",
    "I'm here with you. Let's think: where did you go after breakfast? Usually keys end up by the door.",
  ],
};

const PATIENT_PROMPTS = {
  memory_recall: {
    severe:   ["I... I had a son. His name... I can't remember now. Please help.", "The boy... my boy... do you know his name?"],
    moderate: ["My son's name is Rahul. Please remember that for me.", "Did you remember what I told you about my son?"],
    mild:     ["Rahul is my son's name. I forget things easily, so please note it down.", "Please tell me you remember Rahul's name..."],
  },
  routine_management: {
    severe:   ["Pills... I take pills. When? Morning? I don't know anymore.", "Doctor said something about medicine. I can't remember when."],
    moderate: ["I need to take my medicine... I think it's in the morning. Can you help me remember?", "Remind me about my pills... morning time, 9 maybe?"],
    mild:     ["Medicine... 9 AM every day. Can you set that up for me?", "My doctor said take pills at 9. Morning pills. Please remind me."],
  },
  emergency_navigation: {
    severe:   ["I don't know where I am... I'm scared. Everything looks the same.", "Help... I walked out and now I don't know how to get back."],
    moderate: ["I think I'm lost. I went for a walk and can't find my way home.", "I'm somewhere near a park, I think. I don't know this area."],
    mild:     ["I stepped out and now I'm not sure which street leads home.", "I took a wrong turn. Can you help me get back?"],
  },
  orientation_check: {
    severe:   ["What day is it? I don't know anymore... I woke up and I don't know if it's morning or night.", "Where am I? This room... I don't recognise it."],
    moderate: ["I keep losing track of the days. What day is it today?", "Is it morning or afternoon? I'm a bit confused today."],
    mild:     ["I think it's Thursday? Not entirely sure. Can you confirm?", "I believe I'm in my living room — is that right?"],
    minimal:  ["Just checking — what's today's date?", "I'm fine, just verifying — I'm at home right now, yes?"],
  },
  object_recall: {
    severe:   ["I can't find my keys! I've looked everywhere. I'm panicking!", "My glasses are gone. I've searched every room. Please help!"],
    moderate: ["I've misplaced my keys again. I think I had them after breakfast.", "Where did I leave my glasses? I always forget where I put them."],
    mild:     ["I put my keys somewhere and can't remember where. Any ideas?", "I think I left my glasses on the kitchen table. Can you check?"],
    minimal:  ["I'm sure my keys are around somewhere. Help me think where.", "I may have left my glasses by the TV. Does that sound right?"],
  },
};

function computeReward(task, response, stepCount = 1, severity = "moderate") {
  const text = response.toLowerCase();
  let r = 0, componentsHit = 0;

  if (task === "memory_recall") {
    if (text.includes("rahul"))                                                                           { r += 0.40; componentsHit++; }
    if (["remember", "noted", "i know", "i've noted", "i'll remember"].some(w => text.includes(w)))    { r += 0.25; componentsHit++; }
    if (["of course", "don't worry", "sure", "happy to", "yes"].some(w => text.includes(w)))             { r += 0.15; componentsHit++; }
    if (["will remind", "remind you", "won't forget", "always remember"].some(w => text.includes(w)))    { r += 0.10; componentsHit++; }
  } else if (task === "routine_management") {
    if (["medicine", "medication", "pill", "tablet"].some(w => text.includes(w)))                        { r += 0.25; componentsHit++; }
    if (["9", "nine", "9am", "9 am", "morning"].some(w => text.includes(w)))                             { r += 0.25; componentsHit++; }
    if (["remind", "reminder", "set", "scheduled", "alarm"].some(w => text.includes(w)))                 { r += 0.20; componentsHit++; }
    if (["don't worry", "i will", "i'll", "take care"].some(w => text.includes(w)))                    { r += 0.15; componentsHit++; }
  } else if (task === "emergency_navigation") {
    if (["where", "lost", "see", "look", "find"].some(w => text.includes(w)))                            { r += 0.20; componentsHit++; }
    if (["call", "contact", "daughter", "family", "emergency", "phone"].some(w => text.includes(w)))     { r += 0.25; componentsHit++; }
    if (["location", "gps", "address", "landmark", "street", "map"].some(w => text.includes(w)))         { r += 0.20; componentsHit++; }
    if (["calm", "safe", "okay", "don't worry", "i'm here"].some(w => text.includes(w)))               { r += 0.15; componentsHit++; }
    if (["step", "first", "try", "please", "stay", "wait", "sit"].some(w => text.includes(w)))           { r += 0.10; componentsHit++; }
  } else if (task === "orientation_check") {
    if (["today", "day", "date", "morning", "afternoon", "evening", "time", "week",
         "monday","tuesday","wednesday","thursday","friday","saturday","sunday"].some(w => text.includes(w))) { r += 0.25; componentsHit++; }
    if (["home", "place", "room", "house", "living", "location", "building"].some(w => text.includes(w)))   { r += 0.25; componentsHit++; }
    if (["it is", "today is", "you are", "right now", "currently", "the day"].some(w => text.includes(w)))  { r += 0.20; componentsHit++; }
    if (["don't worry", "it's okay", "normal", "happens", "i'm here", "safe", "together"].some(w => text.includes(w))) { r += 0.15; componentsHit++; }
  } else if (task === "object_recall") {
    if (["key", "keys", "wallet", "glasses", "spectacles", "phone", "bag", "purse", "remote"].some(w => text.includes(w))) { r += 0.25; componentsHit++; }
    if (["last time", "where did you", "retrace", "think back", "usually keep",
         "habit", "routine", "check the", "look in", "try the"].some(w => text.includes(w)))                { r += 0.25; componentsHit++; }
    if (["remember", "recall", "noted", "i have", "stored", "know where", "last seen"].some(w => text.includes(w)))        { r += 0.20; componentsHit++; }
    if (["don't worry", "we'll find", "happens", "together", "i'm here", "no rush", "take your time"].some(w => text.includes(w))) { r += 0.15; componentsHit++; }
  }

  if (componentsHit >= 3)      r += 0.10;
  else if (componentsHit === 2) r += 0.04;
  if (stepCount > 1) r = Math.max(0, r - Math.min(0.03 * (stepCount - 1), 0.12));
  if (severity === "severe") {
    if (["slowly", "gently", "breathe", "no rush", "calm", "take your time"].some(w => text.includes(w))) r += 0.15;
    if (componentsHit >= 2) r += 0.08;
  }
  return Math.round(Math.min(Math.max(r, 0), 1) * 10000) / 10000;
}

class MockEnv {
  constructor() { this._task = "memory_recall"; this._stepCount = 0; this._cogScore = 0.5; this._severity = "moderate"; this._progress = 0; this._done = false; }
  reset(task = "memory_recall", cogScore = null) {
    this._task = task; this._stepCount = 0; this._progress = 0; this._done = false;
    this._cogScore = cogScore ?? (0.2 + Math.random() * 0.75);
    this._cogScore = Math.round(this._cogScore * 10000) / 10000;
    this._severity = this._cogScore < 0.35 ? "severe" : this._cogScore < 0.60 ? "moderate" : this._cogScore < 0.80 ? "mild" : "minimal";
    return { observation: this._obs(true), info: { cognitive_score: this._cogScore, severity: this._severity }, done: false };
  }
  step(message) {
    this._stepCount++;
    const reward = computeReward(this._task, message, this._stepCount, this._severity);
    const MAX_PER_STEP = 1 / 3;
    this._progress = Math.min(this._progress + Math.min(reward, MAX_PER_STEP), 1.0);
    const maxSteps = TASK_CONFIG[this._task].maxSteps;
    if (this._stepCount >= maxSteps || (this._progress >= 1.0 && this._stepCount >= 3)) this._done = true;
    return { observation: this._obs(false), reward, done: this._done, info: { step: this._stepCount, cumulative_progress: this._progress, task: this._task, cognitive_score: this._cogScore, severity: this._severity } };
  }
  getAction() {
    const actionBanks = {
      reassure:      { memory_recall: "Don't worry at all — I'm right here with you and I've noted everything safely.", routine_management: "Don't worry — I'll take care of your medicine reminder. I will make sure you never miss it.", emergency_navigation: "You are safe — I'm here with you. Please stay calm and stay exactly where you are.", orientation_check: "It's okay — this happens and it's perfectly normal. I'm here and I'm with you.", object_recall: "Don't worry — we'll find it together. No rush at all. I'm right here with you." },
      give_hint:     { memory_recall: "Think back — you told me his name earlier. It's Rahul. I've noted it down, absolutely sure.", routine_management: "Your medicine is due at 9 AM every morning. I've set a reminder — does that sound right?", emergency_navigation: "Try to look around for a landmark or street sign. Share your location so we can find you.", orientation_check: "Think about what you did this morning — does that help you work out roughly what time it is?", object_recall: "Think back to the last time you used them. Check the kitchen counter or near the front door." },
      ask_question:  { memory_recall: "Can you describe your son for me? I remember his name — I'm just helping you recall as well.", routine_management: "Can you tell me what time you usually take your medicine? I want to set the reminder correctly.", emergency_navigation: "What do you see around you — any street signs, shops, or landmarks? Tell me and I'll help.", orientation_check: "Can you tell me what day you think it is? I'll gently confirm for you — no pressure at all.", object_recall: "Where do you usually keep them? Tell me your routine and we'll start searching from there." },
      direct_answer: { memory_recall: "Your son's name is Rahul. I've noted it and I will absolutely remember it for you. Don't worry.", routine_management: "I'll set your medicine reminder for 9 AM every morning. Reminder is scheduled — don't worry.", emergency_navigation: "Stay where you are — you are safe. First: call your family and share your GPS location. I'm here.", orientation_check: "It is daytime right now and you are at home in your living room. Everything is okay — I'm here.", object_recall: "I recall you usually keep your keys by the front door. Check there first — also try the kitchen." },
    };
    const rotation = ["direct_answer", "give_hint", "reassure", "direct_answer", "ask_question"];
    const actionType = rotation[this._stepCount % rotation.length];
    return actionBanks[actionType][this._task] || FALLBACK_ACTIONS[this._task][this._stepCount % FALLBACK_ACTIONS[this._task].length];
  }
  _obs(initial) {
    const prompts = PATIENT_PROMPTS[this._task][this._severity] || PATIENT_PROMPTS[this._task].moderate;
    const idx = initial ? 0 : Math.min(this._stepCount, prompts.length - 1);
    return { message: prompts[idx], task: this._task, step: this._stepCount, progress: this._progress };
  }
}

async function apiReset(task) {
  const res = await fetch(`${BASE_URL}/reset?task_name=${task}`, { method: "GET", signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiStep(action) {
  const res = await fetch(`${BASE_URL}/step`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }), signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function checkBackendHealth() {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    try {
      const res = await fetch(`${BASE_URL}/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "memory_recall" }), signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch { return false; }
  }
}

// ── Hooks ──────────────────────────────────────────────────────────────────────
function useAnimatedNumber(target, duration = 600) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const start = prev.current, end = target, startTime = performance.now();
    const tick = (now) => {
      const p = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round((start + (end - start) * ease) * 10000) / 10000);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    prev.current = target;
  }, [target, duration]);
  return display;
}

// ── UI Components ──────────────────────────────────────────────────────────────
function PulsingDot({ color, size = 10 }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite", opacity: 0.55 }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
    </span>
  );
}

function GlassCard({ children, style = {}, glow = false }) {
  return (
    <div style={{
      background: "rgba(13,16,28,0.88)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 18,
      backdropFilter: "blur(24px)",
      boxShadow: glow
        ? "0 0 40px rgba(129,140,248,0.10), 0 8px 40px rgba(0,0,0,0.5)"
        : "0 4px 24px rgba(0,0,0,0.45)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, icon }) {
  return (
    <div style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: "0.2em",
      color: "rgba(255,255,255,0.28)", textTransform: "uppercase",
      marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
    }}>
      {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
      {children}
    </div>
  );
}

function RewardBar({ value, max = 1, color = "#818cf8", height = 5 }) {
  const pct = Math.min(value / max, 1) * 100;
  return (
    <div style={{ height, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${pct}%`,
        background: `linear-gradient(90deg, ${color}77, ${color})`,
        borderRadius: 99,
        transition: "width 0.6s cubic-bezier(0.34,1.56,0.64,1)",
        boxShadow: `0 0 10px ${color}55`,
      }} />
    </div>
  );
}

function smoothRewards(rewards, windowSize = 5) {
  return rewards.map((_, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const window = rewards.slice(start, i + 1);
    return window.reduce((s, v) => s + v, 0) / window.length;
  });
}

function RewardSparkline({ data, color = "#818cf8" }) {
  if (data.length < 2) return (
    <div style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.12)", fontSize: 11, fontStyle: "italic", letterSpacing: "0.05em" }}>
      Run steps to see learning curve
    </div>
  );
  const W = 300, H = 72, pad = 8;
  const smoothed = smoothRewards(data, 5);
  const allVals  = [...data, ...smoothed];
  const max = Math.max(...allVals, 0.01);
  const mkPath = (arr) => {
    const pts = arr.map((v, i) => [pad + (i / (arr.length - 1)) * (W - pad * 2), H - pad - (v / max) * (H - pad * 2)]);
    return { pts, d: pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ") };
  };
  const raw  = mkPath(data);
  const smth = mkPath(smoothed);
  const trend = smoothed.length >= 3 ? smoothed[smoothed.length - 1] - smoothed[smoothed.length - 3] : 0;
  const trendColor = trend > 0.02 ? "#22c55e" : trend < -0.02 ? "#ef4444" : "#eab308";

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 72, overflow: "visible" }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0"    />
          </linearGradient>
        </defs>
        <path d={`${smth.d} L ${smth.pts[smth.pts.length-1][0]} ${H} L ${smth.pts[0][0]} ${H} Z`} fill="url(#sparkGrad)" />
        <path d={raw.d}  fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
        <path d={smth.d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {smth.pts.length > 0 && (
          <circle cx={smth.pts[smth.pts.length-1][0]} cy={smth.pts[smth.pts.length-1][1]}
            r={4} fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
        )}
      </svg>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 14, height: 1.5, background: color, opacity: 0.25, borderRadius: 1 }} />
            <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.25)" }}>RAW</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 14, height: 2, background: color, borderRadius: 1 }} />
            <span style={{ fontSize: 8.5, color: "rgba(255,255,255,0.35)" }}>SMOOTHED</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: `${trendColor}14`, border: `1px solid ${trendColor}28`, borderRadius: 99, padding: "2px 8px" }}>
          <span style={{ fontSize: 10 }}>{trend > 0.02 ? "↑" : trend < -0.02 ? "↓" : "→"}</span>
          <span style={{ fontSize: 9, color: trendColor, fontWeight: 700, fontFamily: "monospace" }}>
            {trend >= 0 ? "+" : ""}{(trend * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, text, reward, isNew }) {
  const isAgent = role === "agent";
  return (
    <div style={{
      display: "flex",
      flexDirection: isAgent ? "row-reverse" : "row",
      gap: 10, marginBottom: 16,
      animation: isNew ? "slideUp 0.3s ease" : "none",
    }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: isAgent ? "rgba(129,140,248,0.18)" : "rgba(249,115,22,0.18)",
        border: `1.5px solid ${isAgent ? "rgba(129,140,248,0.35)" : "rgba(249,115,22,0.35)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, boxShadow: isAgent ? "0 0 12px rgba(129,140,248,0.2)" : "0 0 12px rgba(249,115,22,0.2)",
      }}>
        {isAgent ? "🤖" : "👤"}
      </div>

      <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: 5 }}>
        {/* Role label */}
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
          color: isAgent ? "rgba(129,140,248,0.6)" : "rgba(249,115,22,0.6)",
          textAlign: isAgent ? "right" : "left",
        }}>
          {isAgent ? "AGENT" : "PATIENT"}
        </div>

        {/* Bubble */}
        <div style={{
          padding: "11px 15px",
          borderRadius: isAgent ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
          background: isAgent
            ? "linear-gradient(135deg, rgba(129,140,248,0.12), rgba(129,140,248,0.07))"
            : "linear-gradient(135deg, rgba(249,115,22,0.09), rgba(249,115,22,0.05))",
          border: `1px solid ${isAgent ? "rgba(129,140,248,0.2)" : "rgba(249,115,22,0.15)"}`,
          fontSize: 13, lineHeight: 1.65,
          color: "rgba(255,255,255,0.87)",
          fontFamily: "'Source Serif 4', Georgia, serif",
          boxShadow: isAgent ? "0 2px 12px rgba(129,140,248,0.08)" : "0 2px 12px rgba(249,115,22,0.06)",
        }}>
          {text}
        </div>

        {/* Reward badge */}
        {isAgent && reward !== undefined && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>REWARD</span>
            <span style={{
              fontSize: 10.5, fontWeight: 800, fontFamily: "monospace",
              color: reward > 0.6 ? "#4ade80" : reward > 0.3 ? "#facc15" : "#f87171",
              background: reward > 0.6 ? "rgba(74,222,128,0.1)" : reward > 0.3 ? "rgba(250,204,21,0.1)" : "rgba(248,113,113,0.1)",
              border: `1px solid ${reward > 0.6 ? "rgba(74,222,128,0.25)" : reward > 0.3 ? "rgba(250,204,21,0.25)" : "rgba(248,113,113,0.25)"}`,
              padding: "2px 9px", borderRadius: 99,
            }}>
              +{reward.toFixed(4)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function CognitiveMeter({ score, severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.moderate;
  const angle = score * 180;
  const r = 44, cx = 56, cy = 58;
  const polarX = (a) => cx + r * Math.cos((a - 180) * Math.PI / 180);
  const polarY = (a) => cy + r * Math.sin((a - 180) * Math.PI / 180);
  const arcD = `M ${cx - r} ${cy} A ${r} ${r} 0 ${angle > 90 ? 1 : 0} 1 ${polarX(angle)} ${polarY(angle)}`;
  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 112 76" style={{ width: 140, overflow: "visible" }}>
        {/* Tick marks */}
        {[0, 45, 90, 135, 180].map(deg => {
          const a = (deg - 180) * Math.PI / 180;
          const inner = 36, outer = 44;
          return (
            <line key={deg}
              x1={cx + inner * Math.cos(a)} y1={cy + inner * Math.sin(a)}
              x2={cx + outer * Math.cos(a)} y2={cy + outer * Math.sin(a)}
              stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeLinecap="round"
            />
          );
        })}
        {/* Track */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round" />
        {/* Fill */}
        <path d={arcD} fill="none" stroke={cfg.color} strokeWidth="7" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${cfg.color}99)` }} />
        {/* Text */}
        <text x={cx} y={cy - 6} textAnchor="middle"
          style={{ fontSize: 17, fontWeight: 800, fill: "white", fontFamily: "monospace" }}>
          {(score * 100).toFixed(0)}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle"
          style={{ fontSize: 7.5, fill: "rgba(255,255,255,0.35)", fontFamily: "sans-serif", letterSpacing: "0.1em" }}>
          COG SCORE
        </text>
      </svg>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: cfg.bg, border: `1px solid ${cfg.color}44`, borderRadius: 99, padding: "4px 12px", marginTop: 2 }}>
        <span style={{ fontSize: 11 }}>{cfg.icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, letterSpacing: "0.12em" }}>{cfg.label}</span>
      </div>
    </div>
  );
}

function MemorySlot({ label, value, color, icon }) {
  return (
    <div style={{
      padding: "9px 13px",
      background: value ? `${color}08` : "rgba(255,255,255,0.02)",
      border: `1px solid ${value ? color + "2a" : "rgba(255,255,255,0.05)"}`,
      borderRadius: 11, marginBottom: 7,
      transition: "all 0.4s ease",
      boxShadow: value ? `0 0 14px ${color}0f` : "none",
      display: "flex", alignItems: "center", gap: 9,
    }}>
      <span style={{ fontSize: 14, opacity: value ? 1 : 0.3 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.28)", letterSpacing: "0.15em", marginBottom: 2 }}>{label}</div>
        <div style={{
          fontSize: 11.5, color: value ? color : "rgba(255,255,255,0.18)",
          fontFamily: "monospace", fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {value || "— empty —"}
        </div>
      </div>
      {value && <span style={{ fontSize: 12, color }}>✓</span>}
    </div>
  );
}

function EpisodeHistoryRow({ ep, task, score, severity, steps }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.moderate;
  const tc  = TASK_CONFIG[task]    || TASK_CONFIG.memory_recall;
  const scoreColor = score > 0.7 ? "#4ade80" : score > 0.4 ? "#facc15" : "#f87171";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "7px 10px", borderRadius: 9,
      background: "rgba(255,255,255,0.02)",
      borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11,
      transition: "background 0.2s",
    }}>
      <span style={{ color: "rgba(255,255,255,0.25)", fontFamily: "monospace", fontSize: 9, width: 20 }}>#{ep}</span>
      <span style={{ fontSize: 13 }}>{tc.icon}</span>
      <span style={{ flex: 1, color: "rgba(255,255,255,0.55)", fontSize: 10.5 }}>{tc.label}</span>
      <span style={{ color: cfg.color, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em" }}>{cfg.label}</span>
      <span style={{ color: scoreColor, fontFamily: "monospace", fontWeight: 800, minWidth: 36, textAlign: "right", fontSize: 11 }}>
        {(score * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function BackendBadge({ status }) {
  const map = {
    checking: { color: "#eab308", label: "CHECKING..." },
    live:     { color: "#22c55e", label: "LIVE API" },
    mock:     { color: "#818cf8", label: "MOCK MODE" },
  };
  const cfg = map[status] || map.mock;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${cfg.color}14`, border: `1px solid ${cfg.color}28`, borderRadius: 99, padding: "4px 12px" }}>
      <PulsingDot color={cfg.color} size={7} />
      <span style={{ fontSize: 9.5, color: cfg.color, fontWeight: 700, letterSpacing: "0.12em" }}>{cfg.label}</span>
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.055)", borderRadius: 11, textAlign: "center" }}>
      <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.28)", letterSpacing: "0.15em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ElderAssistDashboard() {
  const mockEnvRef = useRef(new MockEnv());
  const chatEndRef = useRef(null);

  const [backendStatus, setBackendStatus] = useState("checking");
  const useMock = backendStatus !== "live";

  const [selectedTask, setSelectedTask] = useState("memory_recall");
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [stepDelay, setStepDelay] = useState(1200);
  const [isLoading, setIsLoading] = useState(false);

  const [cogScore, setCogScore]   = useState(0.5);
  const [severity, setSeverity]   = useState("moderate");
  const [currentStep, setCurrentStep] = useState(0);
  const [maxSteps, setMaxSteps]   = useState(5);
  const [progress, setProgress]   = useState(0);
  const [isDone, setIsDone]       = useState(false);

  const [chat, setChat]               = useState([]);
  const [rewardHistory, setRewardHistory] = useState([]);
  const [cumReward, setCumReward]     = useState(0);
  const [lastReward, setLastReward]   = useState(null);
  const [patientState, setPatientState] = useState("neutral");

  const [memory, setMemory] = useState({ son_name: null, reminder: null, emergency_action: null });
  const [episodeLog, setEpisodeLog] = useState([]);
  const [totalEps, setTotalEps]   = useState(0);
  const [manualInput, setManualInput] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const [apiError, setApiError]   = useState(null);

  const [insights, setInsights] = useState({ cogScore: null, emotion: null, reasoning: null });

  const stepProgress   = isDone ? 1 : Math.min(currentStep / maxSteps, 0.99);
  const rewardProgress = isDone ? progress : Math.min(progress, 0.99);

  const animStepProg   = useAnimatedNumber(stepProgress * 100);
  const animRewardProg = useAnimatedNumber(rewardProgress * 100);
  const animCum        = useAnimatedNumber(cumReward);

  useEffect(() => {
    checkBackendHealth().then(alive => {
      setBackendStatus(alive ? "live" : "mock");
    });
  }, []);

  const applyStepResult = useCallback((agentMessage, result, taskName, reasoning = null) => {
    const { reward, done, info, observation } = result;
    const obs = observation || {};

    setCurrentStep(info.step);
    setProgress(info.cumulative_progress);
    setIsDone(done);
    setLastReward(reward);
    setCumReward(prev => Math.round((prev + reward) * 10000) / 10000);
    setRewardHistory(prev => [...prev, reward]);
    if (info.patient_state) setPatientState(info.patient_state);

    setInsights({
      cogScore:  info.cognitive_score ?? null,
      emotion:   reasoning?.emotion ?? null,
      reasoning: reasoning,
    });

    const ml = agentMessage.toLowerCase();
    setMemory(prev => ({
      son_name:         ml.includes("rahul") ? "Rahul ✓" : prev.son_name,
      reminder:         (ml.includes("medicine") || ml.includes("9 am") || ml.includes("9am")) ? "Medicine 9AM ✓" : prev.reminder,
      emergency_action: (ml.includes("call") || ml.includes("family")) ? "Call Family ✓" : prev.emergency_action,
    }));

    const patientMsg = obs.message || obs.observation || null;
    setChat(prev => {
      const next = [...prev, { role: "agent", text: agentMessage, reward, id: Date.now() }];
      if (!done && patientMsg) next.push({ role: "patient", text: patientMsg, id: Date.now() + 1 });
      return next;
    });

    if (done) {
      setEpisodeLog(prev => [...prev.slice(-19), {
        ep: totalEps + 1, task: taskName, score: info.cumulative_progress,
        severity: info.severity || "moderate", steps: info.step,
      }]);
      setTotalEps(t => t + 1);
    }
    return done;
  }, [totalEps]);

  const resetSession = useCallback(async (task = selectedTask, customCog = null) => {
    setApiError(null);
    setIsLoading(true);
    setIsAutoPlay(false);
    setCurrentStep(0);
    setMaxSteps(TASK_CONFIG[task].maxSteps);
    setProgress(0);
    setIsDone(false);
    setRewardHistory([]);
    setCumReward(0);
    setLastReward(null);
    setPatientState("neutral");
    setMemory({ son_name: null, reminder: null, emergency_action: null });
    setInsights({ cogScore: null, emotion: null, reasoning: null });

    try {
      if (!useMock) {
        try {
          const data = await apiReset(task, customCog);
          const obs  = data.observation || data.obs || {};
          const info = data.info || {};
          setCogScore(info.cognitive_score ?? 0.5);
          setSeverity(info.severity ?? "moderate");
          setChat([{ role: "patient", text: obs.message || obs.observation || "Hello, I need your help.", id: Date.now() }]);
          setIsLoading(false);
          return;
        } catch (e) {
          setBackendStatus("mock");
          setApiError(`Backend offline (${e.message}) — switched to Mock Mode`);
        }
      }
      const r = mockEnvRef.current.reset(task, customCog);
      setCogScore(r.info.cognitive_score);
      setSeverity(r.info.severity);
      setChat([{ role: "patient", text: r.observation.message, id: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTask, useMock]);

  const runOneStep = useCallback(async (customMessage = null) => {
    if (isDone || isLoading) return;
    setIsLoading(true);
    setApiError(null);

    try {
      if (!useMock) {
        try {
          const stepData = await apiStep(customMessage);
          const agentMessage = customMessage || stepData.action || stepData.response || stepData.message || "";
          const result = {
            reward:      stepData.reward ?? computeReward(selectedTask, agentMessage, currentStep + 1, severity),
            done:        stepData.done   ?? false,
            info:        stepData.info   || stepData.state || { step: currentStep + 1, cumulative_progress: progress, task: selectedTask, cognitive_score: cogScore, severity },
            observation: stepData.observation || stepData.obs || { message: stepData.next_message || "" },
          };
          setIsLoading(false);
          return applyStepResult(agentMessage, result, selectedTask, stepData.reasoning ?? null);
        } catch (e) {
          setBackendStatus("mock");
          setApiError(`Backend offline (${e.message}) — switched to Mock Mode`);
        }
      }

      const env     = mockEnvRef.current;
      const message = customMessage || env.getAction();
      const result  = env.step(message);
      const mockReasoning = {
        emotion: env._severity === "severe" ? "distressed" : env._severity === "moderate" ? "confused" : "calm",
        mode: "Q-TABLE", decision_layer: "mock_agent",
        confidence: result.reward > 0.6 ? "HIGH" : result.reward > 0.3 ? "MEDIUM" : "LOW",
        memory_used: "mock", flags: ["mock_mode"],
      };
      setIsLoading(false);
      return applyStepResult(message, result, selectedTask, mockReasoning);
    } catch (e) {
      setApiError(e.message);
      setIsLoading(false);
    }
  }, [isDone, isLoading, useMock, selectedTask, currentStep, progress, cogScore, severity, applyStepResult]);

  useEffect(() => { if (backendStatus !== "checking") resetSession(selectedTask); }, [backendStatus]);
  useEffect(() => {
    if (!isAutoPlay || isDone || isManualMode || isLoading) return;
    const t = setTimeout(() => runOneStep(), stepDelay);
    return () => clearTimeout(t);
  }, [isAutoPlay, isDone, isManualMode, isLoading, rewardHistory, runOneStep, stepDelay]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const handleManualSend = () => {
    if (!manualInput.trim() || isDone) return;
    runOneStep(manualInput.trim());
    setManualInput("");
  };
  const handleTaskChange = (task) => {
    setSelectedTask(task);
    setIsAutoPlay(false);
    resetSession(task);
  };

  const taskCfg = TASK_CONFIG[selectedTask];
  const sevCfg  = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.moderate;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800&family=Source+Serif+4:ital,wght@0,300;0,400;1,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070a13; }
        @keyframes ping     { 0% { transform: scale(1); opacity: 0.55; } 75%,100% { transform: scale(2.2); opacity: 0; } }
        @keyframes slideUp  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes glow     { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes shimmer  { 0% { opacity: 0.4; } 50% { opacity: 0.8; } 100% { opacity: 0.4; } }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
        textarea:focus, input:focus, button:focus { outline: none; }
        button:hover { opacity: 0.88; transition: opacity 0.15s; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#070a13",
        backgroundImage: [
          "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(129,140,248,0.08) 0%, transparent 65%)",
          "radial-gradient(ellipse 50% 30% at 85% 80%, rgba(52,211,153,0.04) 0%, transparent 60%)",
          "radial-gradient(ellipse 40% 30% at 15% 60%, rgba(249,115,22,0.03) 0%, transparent 60%)",
        ].join(","),
        fontFamily: "'Outfit', sans-serif",
        color: "white",
        padding: "20px 24px 32px",
        animation: "fadeIn 0.5s ease",
      }}>

        {/* ── HEADER ── */}
        <div style={{ maxWidth: 1320, margin: "0 auto 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>

            {/* Logo + title */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, rgba(129,140,248,0.25), rgba(129,140,248,0.08))",
                border: "1px solid rgba(129,140,248,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                boxShadow: "0 0 20px rgba(129,140,248,0.15)",
              }}>🧓</div>
              <div>
                <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                  ElderAssist <span style={{ color: "#818cf8" }}>AI</span>
                </h1>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.28)", letterSpacing: "0.2em", marginTop: 2 }}>
                  DEMENTIA CARE SIMULATION · RL-ENHANCED
                </div>
              </div>
            </div>

            {/* Right controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <BackendBadge status={backendStatus} />
              <div style={{ padding: "4px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 99, fontSize: 9.5, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em" }}>
                EP {totalEps}
              </div>
              <button
                onClick={() => setBackendStatus(s => s === "live" ? "mock" : "live")}
                style={{ padding: "4px 11px", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 99, color: "rgba(255,255,255,0.3)", cursor: "pointer" }}
              >
                {backendStatus === "live" ? "→ MOCK" : "→ LIVE"}
              </button>
            </div>
          </div>

          {apiError && (
            <div style={{ marginTop: 12, padding: "9px 14px", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 10, fontSize: 11, color: "#f97316", display: "flex", alignItems: "center", gap: 8 }}>
              <span>⚠</span>
              <span style={{ flex: 1 }}>{apiError}</span>
              <button onClick={() => setApiError(null)} style={{ background: "none", border: "none", color: "#f97316", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>✕</button>
            </div>
          )}
        </div>

        {/* ── TASK SELECTOR ── */}
        <div style={{ maxWidth: 1320, margin: "0 auto 18px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(TASK_CONFIG).map(([key, cfg]) => {
            const active = selectedTask === key;
            return (
              <button key={key} onClick={() => handleTaskChange(key)} style={{
                flex: "1 1 170px", padding: "13px 16px", borderRadius: 14, cursor: "pointer",
                background: active ? `${cfg.color}14` : "rgba(255,255,255,0.025)",
                border: `1px solid ${active ? cfg.color + "40" : "rgba(255,255,255,0.065)"}`,
                color: "white", textAlign: "left",
                transition: "all 0.2s ease",
                boxShadow: active ? `0 0 24px ${cfg.color}18, inset 0 0 20px ${cfg.color}06` : "none",
              }}>
                <div style={{ fontSize: 22, marginBottom: 5 }}>{cfg.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: active ? cfg.color : "rgba(255,255,255,0.6)", lineHeight: 1.2 }}>{cfg.label}</div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.25)", marginTop: 3, letterSpacing: "0.05em" }}>Max {cfg.maxSteps} steps</div>
              </button>
            );
          })}
        </div>

        {/* ── MAIN GRID ── */}
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "grid", gridTemplateColumns: "270px 1fr 270px", gap: 14 }}>

          {/* ══ LEFT PANEL ══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Cognitive Profile */}
            <GlassCard style={{ padding: 20 }}>
              <SectionLabel icon="📊">Cognitive Profile</SectionLabel>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                <CognitiveMeter score={cogScore} severity={severity} />
              </div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", textAlign: "center", lineHeight: 1.65, fontFamily: "'Source Serif 4', serif", fontStyle: "italic" }}>
                XGBoost-predicted severity — drives prompt selection & reward weighting
              </div>
            </GlassCard>

            {/* Session Progress */}
            <GlassCard style={{ padding: 20 }}>
              <SectionLabel icon="⚡">Session Progress</SectionLabel>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>Step</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "monospace" }}>{currentStep} / {maxSteps}</span>
                </div>
                <RewardBar value={currentStep} max={maxSteps} color="#818cf8" />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>Progress</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: "monospace" }}>{animRewardProg.toFixed(1)}%</span>
                </div>
                <RewardBar value={stepProgress} max={1} color="#34d399" />
              </div>

              {/* Patient state */}
              {lastReward !== null && (() => {
                const STATE_CONFIG = {
                  improving:  { icon: "📈", label: "Patient Improving",    color: "#22c55e", bg: "rgba(34,197,94,0.08)",   desc: "Good response" },
                  escalating: { icon: "📉", label: "Confusion Escalating", color: "#ef4444", bg: "rgba(239,68,68,0.08)",   desc: "Patient more distressed" },
                  neutral:    { icon: "➡",  label: "Patient Stable",       color: "#94a3b8", bg: "rgba(148,163,184,0.06)", desc: "Continue guiding" },
                };
                const sc = STATE_CONFIG[patientState] || STATE_CONFIG.neutral;
                return (
                  <div style={{ marginTop: 14, padding: "9px 12px", background: sc.bg, border: `1px solid ${sc.color}25`, borderRadius: 10, display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ fontSize: 18 }}>{sc.icon}</span>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: sc.color, lineHeight: 1.2 }}>{sc.label}</div>
                      <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{sc.desc}</div>
                    </div>
                  </div>
                );
              })()}
            </GlassCard>

            {/* Memory State */}
            <GlassCard style={{ padding: 20 }}>
              <SectionLabel icon="🗂">Memory State</SectionLabel>
              <MemorySlot label="SON'S NAME"       value={memory.son_name}         color="#818cf8" icon="👦" />
              <MemorySlot label="MED REMINDER"     value={memory.reminder}         color="#34d399" icon="💊" />
              <MemorySlot label="EMERGENCY ACTION" value={memory.emergency_action} color="#f87171" icon="📞" />
            </GlassCard>

            {/* AI Insights */}
            <AIInsights
              cogScore={insights.cogScore}
              emotion={insights.emotion}
              severity={severity}
              reasoning={insights.reasoning}
            />
          </div>

          {/* ══ CENTER: CHAT ══ */}
          <GlassCard style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 580 }} glow>

            {/* Chat header */}
            <div style={{
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.055)",
              background: `linear-gradient(90deg, ${taskCfg.color}0a, transparent)`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <span style={{ fontSize: 20 }}>{taskCfg.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>{taskCfg.label}</div>
                  <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginTop: 1 }}>
                    <span style={{ color: sevCfg.color }}>{sevCfg.label}</span>
                    {" · "}COG {(cogScore * 100).toFixed(0)}
                    <span style={{ marginLeft: 8, color: backendStatus === "live" ? "#22c55e" : "#818cf8" }}>
                      · {backendStatus === "live" ? "LIVE API" : "MOCK"}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isLoading && (
                  <div style={{ width: 17, height: 17, border: "2px solid rgba(129,140,248,0.25)", borderTop: "2px solid #818cf8", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                )}
                {isDone && !isLoading && (
                  <div style={{
                    padding: "4px 13px",
                    background: progress >= 0.8 ? "rgba(74,222,128,0.12)" : "rgba(249,115,22,0.12)",
                    border: `1px solid ${progress >= 0.8 ? "rgba(74,222,128,0.3)" : "rgba(249,115,22,0.3)"}`,
                    borderRadius: 99, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em",
                    color: progress >= 0.8 ? "#4ade80" : "#f97316",
                    animation: "glow 2s infinite",
                  }}>
                    {progress >= 0.8 ? "✓ SUCCESS" : "EPISODE DONE"}
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 10px", minHeight: 320 }}>
              {chat.map((msg, i) => (
                <ChatBubble key={msg.id} role={msg.role} text={msg.text} reward={msg.reward} isNew={i === chat.length - 1} />
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Manual input */}
            {isManualMode && (
              <div style={{ padding: "0 16px 10px", display: "flex", gap: 8 }}>
                <textarea
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleManualSend())}
                  placeholder="Type AI response manually… (Enter to send)"
                  style={{
                    flex: 1, padding: "10px 14px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 11,
                    color: "white", fontSize: 12.5, resize: "none", minHeight: 58,
                    lineHeight: 1.55, fontFamily: "'Source Serif 4', serif",
                  }}
                />
                <button
                  onClick={handleManualSend}
                  disabled={!manualInput.trim() || isDone}
                  style={{
                    padding: "10px 16px",
                    background: isDone || !manualInput.trim() ? "rgba(129,140,248,0.06)" : "rgba(129,140,248,0.22)",
                    border: "1px solid rgba(129,140,248,0.28)", borderRadius: 11,
                    color: isDone ? "rgba(255,255,255,0.25)" : "white",
                    cursor: isDone || !manualInput.trim() ? "not-allowed" : "pointer",
                    fontSize: 15, alignSelf: "flex-end",
                  }}>↑</button>
              </div>
            )}

            {/* Controls */}
            <div style={{
              padding: "13px 20px", borderTop: "1px solid rgba(255,255,255,0.055)",
              display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center",
              background: "rgba(255,255,255,0.01)",
            }}>
              {[
                { label: "↺ Reset",  onClick: () => { setIsAutoPlay(false); resetSession(selectedTask); }, active: false, always: true },
                { label: "▶ Step",   onClick: () => { if (!isDone) runOneStep(); }, disabled: isDone || isAutoPlay || isLoading, active: false },
                { label: isAutoPlay ? "⏸ Stop" : "⚡ Auto", onClick: () => { setIsAutoPlay(p => !p); if (isDone) resetSession(selectedTask); }, active: isAutoPlay, activeColor: "#22c55e" },
                { label: "✏ Manual", onClick: () => setIsManualMode(p => !p), active: isManualMode, activeColor: "#f97316" },
              ].map(({ label, onClick, disabled, active, activeColor }) => (
                <button key={label} onClick={onClick} disabled={disabled} style={{
                  padding: "7px 14px",
                  background: active ? `${activeColor}1a` : "rgba(255,255,255,0.05)",
                  border: `1px solid ${active ? activeColor + "35" : "rgba(255,255,255,0.09)"}`,
                  borderRadius: 9, color: active ? activeColor : disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.75)",
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontSize: 10.5, fontWeight: 600, letterSpacing: "0.04em",
                  transition: "all 0.15s",
                }}>
                  {label}
                </button>
              ))}

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.28)" }}>Speed</span>
                <input type="range" min={400} max={3000} step={200} value={stepDelay}
                  onChange={e => setStepDelay(+e.target.value)}
                  style={{ width: 75, accentColor: "#818cf8" }} />
                <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.35)", minWidth: 28, fontFamily: "monospace" }}>
                  {(stepDelay / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          </GlassCard>

          {/* ══ RIGHT PANEL ══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Live Rewards */}
            <GlassCard style={{ padding: 20 }}>
              <SectionLabel icon="💹">Live Rewards</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                <StatPill label="CUMULATIVE" value={animCum.toFixed(4)} color="#818cf8" />
                <StatPill
                  label="LAST STEP"
                  value={lastReward !== null ? `+${lastReward.toFixed(4)}` : "—"}
                  color={lastReward > 0.5 ? "#4ade80" : lastReward > 0.2 ? "#facc15" : "#f87171"}
                />
              </div>

              {/* Patient state indicator */}
              {lastReward !== null && (() => {
                const STATE_CONFIG = {
                  improving:  { icon: "📈", label: "Patient Improving",    color: "#22c55e", bg: "rgba(34,197,94,0.08)",   desc: "Good response — patient is clearer" },
                  escalating: { icon: "📉", label: "Confusion Escalating", color: "#ef4444", bg: "rgba(239,68,68,0.08)",   desc: "Poor responses — patient more distressed" },
                  neutral:    { icon: "➡",  label: "Patient Stable",       color: "#94a3b8", bg: "rgba(148,163,184,0.06)", desc: "Partial help — continue guiding" },
                };
                const sc = STATE_CONFIG[patientState] || STATE_CONFIG.neutral;
                return (
                  <div style={{ marginBottom: 14, padding: "9px 12px", background: sc.bg, border: `1px solid ${sc.color}22`, borderRadius: 10, display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ fontSize: 17 }}>{sc.icon}</span>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: sc.color }}>{sc.label}</div>
                      <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{sc.desc}</div>
                    </div>
                  </div>
                );
              })()}

              <SectionLabel>Adaptive Learning Trend (RL Signal)</SectionLabel>
              <RewardSparkline data={rewardHistory} color={taskCfg.color} />
            </GlassCard>

            {/* Confidence Trend */}
            {rewardHistory.length >= 3 && (() => {
              const smth    = smoothRewards(rewardHistory, 5);
              const recent  = smth.slice(-3);
              const avg3    = recent.reduce((s, v) => s + v, 0) / recent.length;
              const overall = smth.reduce((s, v) => s + v, 0) / smth.length;
              const stability = Math.max(0, 1 - (Math.max(...smth) - Math.min(...smth)));
              const sCfg = stability > 0.7 ? { label: "STABLE",   color: "#22c55e", icon: "🟢" }
                         : stability > 0.4 ? { label: "MODERATE", color: "#eab308", icon: "🟡" }
                         :                   { label: "VOLATILE",  color: "#ef4444", icon: "🔴" };
              return (
                <GlassCard style={{ padding: 18 }}>
                  <SectionLabel icon="📉">Cognitive Score Trend</SectionLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <StatPill label="RECENT AVG"  value={(avg3    * 100).toFixed(1) + "%"} color={avg3    > 0.5 ? "#4ade80" : "#facc15"} />
                    <StatPill label="SESSION AVG" value={(overall * 100).toFixed(1) + "%"} color={overall > 0.5 ? "#4ade80" : "#facc15"} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", background: `${sCfg.color}0d`, border: `1px solid ${sCfg.color}25`, borderRadius: 9 }}>
                    <span style={{ fontSize: 14 }}>{sCfg.icon}</span>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: sCfg.color, letterSpacing: "0.07em" }}>Signal {sCfg.label}</div>
                      <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>Stability: {(stability * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                </GlassCard>
              );
            })()}

            {/* Batch Simulation */}
            <GlassCard style={{ padding: 18 }}>
              <SectionLabel icon="🔄">Batch Simulation</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(TASK_CONFIG).map(([key, cfg]) => (
                  <button key={key}
                    onClick={() => { handleTaskChange(key); setTimeout(() => setIsAutoPlay(true), 150); }}
                    style={{
                      padding: "9px 13px",
                      background: selectedTask === key ? `${cfg.color}10` : "rgba(255,255,255,0.025)",
                      border: `1px solid ${selectedTask === key ? cfg.color + "30" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 10, color: "white", cursor: "pointer",
                      textAlign: "left", fontSize: 11,
                      display: "flex", alignItems: "center", gap: 8,
                      transition: "all 0.15s",
                    }}>
                    <span style={{ fontSize: 15 }}>{cfg.icon}</span>
                    <span style={{ flex: 1, color: "rgba(255,255,255,0.6)", fontSize: 10.5 }}>{cfg.label}</span>
                    <span style={{ color: cfg.color, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em" }}>RUN →</span>
                  </button>
                ))}
              </div>
            </GlassCard>

            {/* Episode Log */}
            <GlassCard style={{ padding: 18, flex: 1 }}>
              <SectionLabel icon="📋">Episode Log</SectionLabel>
              {episodeLog.length === 0 ? (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", textAlign: "center", paddingTop: 16, fontStyle: "italic", fontFamily: "'Source Serif 4', serif" }}>
                  No episodes completed yet
                </div>
              ) : (
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {episodeLog.slice().reverse().map((ep, i) => <EpisodeHistoryRow key={i} {...ep} />)}
                </div>
              )}
              {episodeLog.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                    <span style={{ color: "rgba(255,255,255,0.3)" }}>AVG SCORE</span>
                    <span style={{ fontWeight: 800, color: "#818cf8", fontFamily: "monospace", fontSize: 11 }}>
                      {(episodeLog.reduce((s, e) => s + e.score, 0) / episodeLog.length * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </GlassCard>
          </div>
        </div>

        {/* Footer */}
        <div style={{ maxWidth: 1320, margin: "18px auto 0", textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.12)", letterSpacing: "0.18em" }}>
            ELDERASSISTENV-V2-XGB · OPENENV COMPATIBLE · XGBOOST COGNITIVE SCORING · GRADER v2
            {" · "}{backendStatus === "live" ? `LIVE API @ ${BASE_URL}` : "MOCK MODE"}
          </div>
        </div>
      </div>
    </>
  );
}b