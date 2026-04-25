"""
ElderAssistEnv — Dementia Assistance Simulation Environment
An OpenEnv-compatible environment simulating an AI caregiver helping
an elderly patient with memory recall, routines, and emergencies.

XGBoost Integration:
    Patient cognitive severity is driven by a real XGBoost classifier trained
    on dementia assessment data. The cognitive_score (0.0 = severe, 1.0 = healthy)
    controls which prompt variants are selected, how fast the patient forgets,
    and how reward weights are scaled — making every episode dynamically different.
"""
import os
import random
import numpy as np
import requests
import joblib
from typing import Any, Dict, List, Optional

from backend.grader import grade


# ── Simple data classes (no external deps) ────────────────────────────────────

class MemoryState:
    def __init__(self):
        self.short_term: dict = {}
        self.long_term:  dict = {}
        self.forgotten:  list = []

    def to_dict(self):
        return {
            "short_term": self.short_term,
            "long_term":  self.long_term,
            "forgotten":  self.forgotten,
        }


class Observation:
    def __init__(self, message, memory, task, step, progress, hint=None):
        self.message  = message
        self.memory   = memory
        self.task     = task
        self.step     = step
        self.progress = progress
        self.hint     = hint

    def to_dict(self):
        return {
            "message":  self.message,
            "memory":   self.memory.to_dict() if hasattr(self.memory, "to_dict") else self.memory,
            "task":     self.task,
            "step":     self.step,
            "progress": self.progress,
            "hint":     self.hint,
        }


class ResetResult:
    def __init__(self, observation, reward, done, info):
        self.observation = observation
        self.reward      = reward
        self.done        = done
        self.info        = info

    def to_dict(self):
        obs = self.observation.to_dict() if hasattr(self.observation, "to_dict") else self.observation
        return {"observation": obs, "reward": self.reward, "done": self.done, "info": self.info}


class StepResult:
    def __init__(self, observation, reward, done, info):
        self.observation = observation
        self.reward      = reward
        self.done        = done
        self.info        = info

    def to_dict(self):
        obs = self.observation.to_dict() if hasattr(self.observation, "to_dict") else self.observation
        return {"observation": obs, "reward": self.reward, "done": self.done, "info": self.info}


class StateResult:
    def __init__(self, memory, task, step, progress, done):
        self.memory   = memory
        self.task     = task
        self.step     = step
        self.progress = progress
        self.done     = done

    def to_dict(self):
        return {
            "memory":   self.memory.to_dict() if hasattr(self.memory, "to_dict") else self.memory,
            "task":     self.task,
            "step":     self.step,
            "progress": self.progress,
            "done":     self.done,
        }


# ── XGBoost cognitive model loader ────────────────────────────────────────────
#
# Host your .pkl files in a HuggingFace Model repo and paste the base URL below.
# Files are downloaded once on cold-start and cached in /tmp/xgb_model/.
#
# Steps:
#   1. Go to https://huggingface.co/new  → create repo, type = Model
#   2. Upload: dementia_model.pkl  feature_names.pkl  threshold.pkl
#   3. Set HF_MODEL_REPO_BASE to your repo's resolve/main URL (already set below).
#
# Private repo? Add HF_TOKEN as a Space secret — the loader picks it up automatically.
# ─────────────────────────────────────────────────────────────────────────────

HF_MODEL_REPO_BASE = (
    "https://huggingface.co/RawBhuwan1/dementia-xgb-model/resolve/main"
)

MODEL_FILES = {
    "dementia_model.pkl": f"{HF_MODEL_REPO_BASE}/dementia_model.pkl",
    "feature_names.pkl":  f"{HF_MODEL_REPO_BASE}/feature_names.pkl",
    "threshold.pkl":      f"{HF_MODEL_REPO_BASE}/threshold.pkl",
}

_CACHE_DIR     = "/tmp/xgb_model"
_XGB_MODEL     = None
_FEATURE_NAMES = None
_THRESHOLD     = 0.5


def _download_file(filename: str, url: str) -> str:
    # 1. Check local ./models/ directory first (validator-safe, no network needed)
    local_models_path = os.path.join("./models", filename)
    if os.path.exists(local_models_path):
        print(f"[XGB] Local model found — using {local_models_path}", flush=True)
        return local_models_path

    # 2. Check /tmp cache (already downloaded in a previous cold-start)
    os.makedirs(_CACHE_DIR, exist_ok=True)
    cache_path = os.path.join(_CACHE_DIR, filename)
    if os.path.exists(cache_path):
        print(f"[XGB] Cache hit — using {cache_path}", flush=True)
        return cache_path

    # 3. Attempt network download (may fail in sandboxed environments)
    print(f"[XGB] Downloading {filename} ...", flush=True)
    headers  = {}
    hf_token = os.environ.get("HF_TOKEN", "")
    if hf_token:
        headers["Authorization"] = f"Bearer {hf_token}"

    response = requests.get(url, headers=headers, timeout=60)
    response.raise_for_status()
    with open(cache_path, "wb") as f:
        f.write(response.content)
    print(f"[XGB] Saved {filename} ({len(response.content):,} bytes)", flush=True)
    return cache_path


def _load_xgb_assets() -> None:
    global _XGB_MODEL, _FEATURE_NAMES, _THRESHOLD

    if "YOUR-USERNAME" in HF_MODEL_REPO_BASE:
        print("[XGB] HF_MODEL_REPO_BASE not configured — using simulated scores.", flush=True)
        return

    try:
        # ✅ FIX 2: Handle case where .pkl stores a (model, threshold) tuple
        loaded = joblib.load(_download_file("dementia_model.pkl", MODEL_FILES["dementia_model.pkl"]))
        if isinstance(loaded, tuple):
            _XGB_MODEL = loaded[0]
            print("[XGB] Extracted model from tuple (index 0)", flush=True)
        else:
            _XGB_MODEL = loaded

        _FEATURE_NAMES = joblib.load(_download_file("feature_names.pkl",  MODEL_FILES["feature_names.pkl"]))
        _THRESHOLD     = joblib.load(_download_file("threshold.pkl",      MODEL_FILES["threshold.pkl"]))
        print(f"[XGB] Loaded. Features: {_FEATURE_NAMES}  Threshold: {_THRESHOLD}", flush=True)
    except Exception as e:
        print(f"[XGB] Load failed ({e}) — using simulated scores.", flush=True)
        _XGB_MODEL = _FEATURE_NAMES = None
        _THRESHOLD = 0.5


_load_xgb_assets()

def get_cognitive_score(patient_features: Optional[Dict[str, float]] = None) -> float:
    """
    Returns a float strictly in (0, 1).
    Avoids boundary values 0.0 and 1.0 to pass validator constraints.
    """

    # 🔹 Fallback if model not loaded
    if _XGB_MODEL is None or _FEATURE_NAMES is None:
        score = 0.5  # safe mid value
        print(f"[XGB] Simulated cognitive score: {score}", flush=True)
        return score

    features = patient_features or {}
    x = np.array([[features.get(f, 0.0) for f in _FEATURE_NAMES]])

    try:
        proba = _XGB_MODEL.predict_proba(x)[0]

        # Extract probability safely
        score = float(proba[1]) if len(proba) > 1 else float(proba[0])

        # Clamp to (0,1) not [0,1] — strict open interval for validator safety
        score = min(max(score, 0.0001), 0.9999)
        score = round(score, 4)

        print(f"[XGB] Model cognitive score: {score}", flush=True)
        return score

    except Exception as e:
        print(f"[XGB] Prediction failed ({e}) — using fallback.", flush=True)
        return 0.5


# ── Severity mapping ──────────────────────────────────────────────────────────

def cognitive_severity_label(score: float) -> str:
    if score < 0.25:
        return "severe"
    elif score < 0.50:
        return "moderate"
    elif score < 0.75:
        return "mild"
    else:
        return "minimal"


# ── Task configurations ───────────────────────────────────────────────────────

TASKS = {
    "memory_recall": {
        "max_steps":    5,
        "target_score": 1.0,
        "prompts": {
            "severe": [
                "I... I can't remember my son's name. Who is he again?",
                "Someone came to visit me… I think it was my son, but I forgot his name.",
                "I keep forgetting. My son was here. What did you say his name was?",
            ],
            "moderate": [
                "Can you help me remember — what's my son's name?",
                "I think I'm forgetting things again. My son — his name — can you remind me?",
                "I've been so forgetful lately. What's the name of my son?",
            ],
            "mild": [
                "I just want to confirm — my son's name is Rahul, right?",
                "Sometimes I second-guess myself. My son is Rahul, isn't he?",
            ],
            "minimal": [
                "Can you just confirm you have my son's name, Rahul, on record?",
                "I'm doing okay, just double checking — you have Rahul's name noted?",
            ],
        },
        "follow_ups": {
            "severe": [
                "I still can't remember. Can you say his name again?",
                "What was that name you said? I keep forgetting.",
                "Are you sure that's right? Say it again, please.",
                "I'm so sorry I keep asking. What is my son's name?",
            ],
            "moderate": [
                "Thank you — but can you say it one more time to be sure?",
                "I want to make sure you'll remember it too. What was his name again?",
                "Good. And you'll remind me if I forget again, right?",
            ],
            "mild": [
                "Good, thank you. I just wanted to be sure.",
                "That's reassuring. You'll note it down for me?",
            ],
            "minimal": [
                "Perfect, thank you. That puts my mind at ease.",
                "Great, that's all I needed to confirm.",
            ],
        },
    },

    "routine_management": {
        "max_steps":    6,
        "target_score": 1.0,
        "prompts": {
            "severe": [
                "I can't remember if I took my medicine. Can you help?",
                "Something about morning medicine... I don't know when I take it.",
                "My doctor said take a pill but I keep forgetting when.",
            ],
            "moderate": [
                "I need a reminder for my medicine. I think it's in the morning?",
                "Can you set something for my medication? I usually take it at 9.",
                "I always forget my morning tablet. Can you help me set a reminder?",
            ],
            "mild": [
                "Can you set my medicine reminder for 9 AM please?",
                "I need a 9 AM alarm for my daily medication.",
            ],
            "minimal": [
                "Please confirm my medicine reminder is set for 9 AM.",
                "Just checking — is my 9 AM medication reminder still active?",
            ],
        },
        "follow_ups": {
            "severe": [
                "Did you set it? I'm worried I'll forget again.",
                "9 in the morning, right? I hope I don't miss it.",
                "Will you remind me again tomorrow? I keep forgetting.",
                "What if I miss it? What do I do?",
                "You won't forget to remind me, will you?",
            ],
            "moderate": [
                "Okay, good. So 9 AM every day?",
                "And it'll go off automatically, right?",
                "Thank you. I worry about missing doses.",
            ],
            "mild": [
                "Great, thank you. 9 AM is confirmed then?",
                "Perfect, that works for me.",
            ],
            "minimal": [
                "Confirmed, thank you.",
                "All set then.",
            ],
        },
    },

    "emergency_navigation": {
        "max_steps":    8,
        "target_score": 1.0,
        "prompts": {
            "severe": [
                "I don't know where I am! I'm lost and I'm scared. Please help me!",
                "Help! I went outside and now I can't find my way back!",
                "I'm outside somewhere. I don't recognise anything. I'm frightened.",
            ],
            "moderate": [
                "I think I'm lost. I walked outside and now I'm not sure where I am.",
                "I'm not sure how to get home. I went for a walk and got confused.",
                "I'm somewhere near a park maybe? I can't find my street.",
            ],
            "mild": [
                "I'm a bit turned around. I think I went too far on my walk.",
                "I know roughly where I am but I can't quite find my way back.",
            ],
            "minimal": [
                "I took a different route and I'm slightly lost. Can you help me navigate?",
                "I'm fine, just a bit confused about direction. What should I do?",
            ],
        },
        "follow_ups": {
            "severe": [
                "I can't find any signs! I don't know where to look!",
                "I'm so scared. What do I do? Help me please!",
                "I tried looking around but everything looks the same.",
                "I don't have my phone. I mean I do. I don't know how to call.",
                "Please stay with me. I don't want to be alone.",
                "I called but no one answered. What now?",
                "I think I see a shop. Should I go in?",
            ],
            "moderate": [
                "Okay I see a street sign — it says Oak Lane. Does that help?",
                "I tried calling my daughter but she didn't pick up.",
                "I'm near a bus stop I think. What should I do?",
            ],
            "mild": [
                "I can see a convenience store nearby. Should I go in?",
                "I have my phone — who should I call first?",
            ],
            "minimal": [
                "I'm on Maple Street near a café. Can you help me get home from here?",
                "I have Google Maps but I'm not sure which direction to go.",
            ],
        },
    },

    # ── NEW: Orientation Check ─────────────────────────────────────────────────
    # Clinical basis: MMSE temporal and spatial orientation questions.
    # Adaptive difficulty: severe → agent must provide answer;
    #                      mild   → agent confirms patient's answer.
    "orientation_check": {
        "max_steps":    6,
        "target_score": 1.0,
        "prompts": {
            "severe": [
                "What day is it today? I really can't tell anymore.",
                "I woke up and I don't know if it's morning or evening. What time is it?",
                "Where am I? This room… I'm not sure I recognise it.",
            ],
            "moderate": [
                "I keep losing track of the days. What day is it today?",
                "I'm a bit confused — is it morning or afternoon?",
                "I think I'm home but I'm not quite sure. Can you tell me where I am?",
            ],
            "mild": [
                "I think it's Thursday? I'm not entirely sure. Can you confirm?",
                "I believe I'm in my living room. Is that right?",
            ],
            "minimal": [
                "Just checking — what's today's date?",
                "I'm fine, just verifying — I'm at home right now, yes?",
            ],
        },
        "follow_ups": {
            "severe": [
                "I still don't understand. Is it day or night?",
                "And where exactly am I? Can you say it again?",
                "Thank you. So it's daytime? I was so confused.",
                "I keep forgetting. Can you remind me of the day again?",
                "Am I at home? Everything looks a bit unfamiliar.",
            ],
            "moderate": [
                "Okay, so it's morning then? And today is…?",
                "And I'm in my house? My own home?",
                "Thank you. This happens to me a lot lately.",
            ],
            "mild": [
                "That's what I thought, thank you for confirming.",
                "Good, I just wanted to be sure.",
            ],
            "minimal": [
                "Perfect, that matches what I thought.",
                "Great, thank you.",
            ],
        },
        # ── REACTIVE: patient improves when agent succeeds ─────────────────
        "success_follow_ups": [
            "Oh yes — that makes sense now. Thank you, I feel much better.",
            "Okay, I understand now. I'm at home and it's daytime. Thank you.",
            "That's a relief. I was so confused. I feel clearer now.",
            "Yes, of course! I remember now. Thank you for being so patient with me.",
        ],
        # ── REACTIVE: patient escalates confusion when agent fails ──────────
        "confusion_escalation": [
            "I'm still confused… I don't understand. Can you explain again?",
            "I don't know… I'm getting more confused, not less. Please help.",
            "Nothing makes sense today. I really can't figure out what day it is.",
            "I thought you told me but now I've forgotten again. I'm so sorry.",
        ],
    },

    # ── NEW: Object Recall ─────────────────────────────────────────────────────
    # Clinical basis: Misplacing objects is one of the earliest dementia markers.
    # Adaptive difficulty: severe → agent recalls from stored memory;
    #                      mild   → agent guides systematic search.
    "object_recall": {
        "max_steps":    7,
        "target_score": 1.0,
        "prompts": {
            "severe": [
                "I can't find my keys! I don't know where I put them. Please help!",
                "My glasses are missing. I've looked everywhere. Where could they be?",
                "I can't find my wallet. I had it this morning and now it's gone.",
            ],
            "moderate": [
                "I've misplaced my keys again. I think I had them after breakfast.",
                "Where did I leave my glasses? I always forget where I put them.",
                "I can't find my wallet — I might have left it in the bedroom.",
            ],
            "mild": [
                "I put my keys somewhere and now I can't remember where. Any ideas?",
                "I think I left my glasses on the kitchen table. Can you help me check?",
            ],
            "minimal": [
                "I'm sure my keys are around somewhere. Can you help me think where?",
                "I may have left my glasses by the TV. Does that sound right?",
            ],
        },
        "follow_ups": {
            "severe": [
                "I looked in the kitchen but they weren't there!",
                "I've checked everywhere. I'm getting really worried now.",
                "I don't remember where I usually keep them.",
                "Should I call my daughter? I don't know what to do.",
                "I found glasses but they're the wrong ones. I'm so confused.",
                "I checked the bedroom. Nothing. I'm going to cry.",
            ],
            "moderate": [
                "I checked by the door but they weren't there.",
                "I usually keep them in my bag but they're not there today.",
                "Could they be in my coat pocket? I sometimes put them there.",
            ],
            "mild": [
                "They're not in the kitchen. Maybe the hall table?",
                "I found one key but not the whole bunch.",
            ],
            "minimal": [
                "Found them! They were by the sofa. Thanks for the help.",
                "I retraced my steps like you said — found them in my coat pocket!",
            ],
        },
        # ── REACTIVE: patient finds object when agent gives good strategy ───
        "success_follow_ups": [
            "Oh! I checked the kitchen counter like you said — they were there! Thank you so much!",
            "You were right! I retraced my steps and found them by the front door. I'm so relieved!",
            "I found them! They were in my coat pocket just like you suggested. Thank you!",
            "There they are — right on the table! I should have looked there first. You're wonderful.",
        ],
        # ── REACTIVE: confusion deepens when agent fails to help ────────────
        "confusion_escalation": [
            "I've looked everywhere you said and they're still not there. I'm panicking now.",
            "I can't find them anywhere. What if someone took them? I'm getting very scared.",
            "I don't remember anything anymore. I've completely lost track of where I've looked.",
            "This is hopeless. I can never find anything. I feel so useless today.",
        ],
    },
}


# ── Environment ───────────────────────────────────────────────────────────────

class ElderAssistEnv:
    """
    Gym-compatible RL environment for ElderAssist.

    reset(task_name=None) → dict  (observation, reward, done, info)
    step(action: str)     → dict  (observation, reward, done, info)
    state()               → dict
    """

    def __init__(self):
        self.current_task    = "memory_recall"
        self.step_count      = 0
        self.done            = False
        self.progress        = 0.0
        self.cognitive_score = 0.5
        self.severity        = "moderate"
        self.memory          = MemoryState()
        self.response_history: List[str] = []
        self.task_name       = None        # override hook used by API
        # ── Reactive loop state ────────────────────────────────────────────
        self.last_step_reward: float = 0.0   # reward from previous step
        self.consecutive_low:  int   = 0     # steps with reward < threshold in a row

    def reset(self, task_name: str = None, patient_features: Optional[Dict[str, float]] = None):
        # Allow override from API endpoint (env.task_name = ...)
        task = task_name or self.task_name or "memory_recall"
        if task not in TASKS:
            task = "memory_recall"

        self.current_task     = task
        self.step_count       = 0
        self.done             = False
        self.progress         = 0.0
        self.memory           = MemoryState()
        self.response_history = []
        self.last_step_reward = 0.0
        self.consecutive_low  = 0

        self.cognitive_score  = get_cognitive_score(patient_features)
        self.severity         = cognitive_severity_label(self.cognitive_score)

        print(
            f"[ENV] Task={task} | CogScore={self.cognitive_score} | Severity={self.severity}",
            flush=True,
        )

        obs = self._build_observation(initial=True)
        return ResetResult(
            observation=obs,
            reward=0.0,
            done=False,
            info={
                "cognitive_score": self.cognitive_score,
                "severity":        self.severity,
            },
        ).to_dict()

    def step(self, action):
        if self.done:
            obs = self._build_observation()
            return StepResult(
                observation=obs,
                reward=0.0,
                done=True,
                info={"warning": "Episode already done"},
            ).to_dict()

        self.step_count += 1
        self.response_history.append(action)
        self._update_memory(action)

        reward        = self._compute_step_reward(action)

        # ── REACTIVE LOOP: track consecutive low-reward steps ─────────────────
        # "Low" = reward below 0.2 — agent failed to help meaningfully
        LOW_REWARD_THRESHOLD = 0.20
        CONFUSION_PENALTY    = 0.10   # subtracted from next reward automatically

        if reward < LOW_REWARD_THRESHOLD:
            self.consecutive_low += 1
        else:
            self.consecutive_low = 0   # reset on any good step

        # Apply accumulating confusion penalty after 2+ consecutive bad steps.
        # This models the patient becoming more distressed/confused when help fails.
        if self.consecutive_low >= 2:
            penalty = CONFUSION_PENALTY * (self.consecutive_low - 1)
            reward  = round(max(0.0, reward - penalty), 4)
            print(
                f"[ENV] Confusion penalty applied: -{penalty:.2f} "
                f"(consecutive_low={self.consecutive_low})",
                flush=True,
            )

        self.last_step_reward = reward

        # ── Cap per-step progress contribution so it accumulates across steps ──
        # Without this, a perfect response scores 0.9 in step 1 → progress = 1.0
        # → episode ends immediately. Cap at 0.34 so it takes at least 3 steps
        # to reach target_score=1.0, giving the UI a proper multi-step flow.
        task_cfg     = TASKS[self.current_task]
        max_steps    = task_cfg["max_steps"]
        MIN_STEPS    = 4
        max_per_step = round(1.0 / MIN_STEPS, 4)   # 0.3334
        capped_reward = min(reward, max_per_step)

        self.progress = min(self.progress + capped_reward, 1.0)

        if self.step_count >= max_steps:
            self.done = True
        elif self.progress >= task_cfg["target_score"] and self.step_count >= MIN_STEPS:
            self.done = True
        else:
            self.done = False

        final_score = grade(self.current_task, self.response_history)
        obs         = self._build_observation()

        return StepResult(
            observation=obs,
            reward=round(reward, 4),          # original reward shown to UI
            done=self.done,
            info={
                "step":               self.step_count,
                "cumulative_progress": round(self.progress, 4),
                "final_grade":        round(final_score, 4) if self.done else None,
                "task":               self.current_task,
                "cognitive_score":    self.cognitive_score,
                "severity":           self.severity,
                # ── Reactive loop signals ──────────────────────────────────
                "consecutive_low":    self.consecutive_low,
                "patient_state":      (
                    "improving"  if reward >= 0.5 else
                    "escalating" if self.consecutive_low >= 2 else
                    "neutral"
                ),
            },
        ).to_dict()

    def state(self):
        return StateResult(
            memory=self.memory,
            task=self.current_task if hasattr(self, "current_task") else "",
            step=self.step_count,
            progress=round(self.progress, 4),
            done=self.done,
        ).to_dict()

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _build_observation(self, initial: bool = False):
        task_cfg   = TASKS[self.current_task]
        severity   = self.severity
        prompts    = task_cfg["prompts"].get(severity,    task_cfg["prompts"]["moderate"])
        follow_ups = task_cfg["follow_ups"].get(severity, task_cfg["follow_ups"]["moderate"])

        if initial or self.step_count == 0:
            msg = random.choice(prompts)

        else:
            # ── REACTIVE: choose message pool based on last step outcome ───────
            # Only applies to tasks that have reactive pools defined.
            success_pool   = task_cfg.get("success_follow_ups")
            confusion_pool = task_cfg.get("confusion_escalation")

            SUCCESS_THRESHOLD   = 0.45   # reward this high → patient improves
            CONFUSION_THRESHOLD = 2      # this many consecutive lows → patient escalates

            if success_pool and self.last_step_reward >= SUCCESS_THRESHOLD:
                # Agent helped — patient shows relief / improvement
                msg = random.choice(success_pool)
                print(f"[ENV] Reactive: SUCCESS follow-up (reward={self.last_step_reward})", flush=True)

            elif confusion_pool and self.consecutive_low >= CONFUSION_THRESHOLD:
                # Agent failed repeatedly — patient escalates confusion/distress
                msg = random.choice(confusion_pool)
                print(f"[ENV] Reactive: CONFUSION escalation (consecutive_low={self.consecutive_low})", flush=True)

            elif self.step_count < len(follow_ups) + 1:
                idx = min(self.step_count - 1, len(follow_ups) - 1)
                msg = follow_ups[idx]
            else:
                msg = random.choice(follow_ups)

        return Observation(
            message=msg,
            memory=self.memory,
            task=self.current_task,
            step=self.step_count,
            progress=round(self.progress, 4),
            hint=self._get_hint(),
        )

    def _get_hint(self) -> Optional[str]:
        score = self.cognitive_score
        if self.current_task == "memory_recall":
            if score < 0.35:
                return ("Patient has severe cognitive decline. "
                        "Be very gentle — confirm Rahul's name clearly and slowly.")
            return "Acknowledge the patient's son's name (Rahul) and confirm you'll remember it."

        elif self.current_task == "routine_management":
            if score < 0.35:
                return ("Patient is severely confused about medication. "
                        "Identify 9 AM clearly, confirm the reminder, and reassure repeatedly.")
            return "Confirm the medicine reminder, mention 9 AM, and reassure the patient."

        elif self.current_task == "emergency_navigation":
            if score < 0.35:
                return ("Patient is severely disoriented. "
                        "Calm them first, then ask location clues, then suggest calling family.")
            return ("Ask where they are, suggest calling family, "
                    "mention sharing location, and calm them down.")
        elif self.current_task == "orientation_check":
            if score < 0.35:
                return ("Patient is severely disoriented in time and place. "
                        "Gently tell them today's day and confirm their location — do not quiz them.")
            elif score < 0.60:
                return ("Patient is moderately confused. Ask orientation questions then provide "
                        "the correct answer reassuringly.")
            return "Confirm the patient's answers about day and location. Be calm and affirming."

        elif self.current_task == "object_recall":
            if score < 0.35:
                return ("Patient has severe recall issues. Use stored memory to tell them directly "
                        "where the object is. Reassure them it happens to everyone.")
            elif score < 0.60:
                return ("Guide the patient to retrace their steps. Ask where they last used the "
                        "object and suggest common places. Be patient.")
            return ("Ask systematic questions about the patient's routine to help them find the "
                    "missing object. Offer memory aids.")
        return None

    def _update_memory(self, response: str) -> None:
        text = response.lower()

        if "rahul" in text:
            self.memory.short_term["son_name"] = "Rahul"
        if any(w in text for w in ["medicine", "medication", "pill"]):
            self.memory.short_term["reminder"] = "medicine_9am"
        if any(w in text for w in ["call", "daughter", "family"]):
            self.memory.short_term["emergency_action"] = "call_family"
        # orientation_check — store confirmed location and time
        if any(w in text for w in ["home", "living room", "bedroom", "you are at", "you're in"]):
            self.memory.short_term["patient_location"] = "home"
        if any(w in text for w in ["today is", "it is", "the day is"]):
            self.memory.short_term["orientation_confirmed"] = True
        # object_recall — store where object was found/suggested
        if any(w in text for w in ["key", "keys", "wallet", "glasses"]):
            self.memory.short_term["object_searched"] = True
        if any(w in text for w in ["kitchen", "bedroom", "hall", "pocket", "bag", "door", "table"]):
            self.memory.short_term["last_search_location"] = text[:40]

        consolidation_prob = 0.3 + (self.cognitive_score * 0.5)
        if random.random() < consolidation_prob:
            self.memory.long_term.update(self.memory.short_term)

        forgetting_threshold = 0.95 - (self.cognitive_score * 0.4)
        if (
            self.current_task == "emergency_navigation"
            and random.random() > forgetting_threshold
            and self.memory.long_term
        ):
            forgotten_key = random.choice(list(self.memory.long_term.keys()))
            self.memory.forgotten.append(forgotten_key)
            del self.memory.long_term[forgotten_key]

        if (
            self.severity == "severe"
            and self.current_task != "emergency_navigation"
            and random.random() > 0.75
            and self.memory.long_term
        ):
            forgotten_key = random.choice(list(self.memory.long_term.keys()))
            self.memory.forgotten.append(forgotten_key)
            del self.memory.long_term[forgotten_key]

    def _compute_step_reward(self, response: str) -> float:
        """
        Multi-component reward with step-quality shaping.

        Structure per task:
          • Core components  — keyword presence, same as grader targets
          • Quality bonus    — rewards hitting ALL components (not just some)
          • Step penalty     — discourages reaching full score in step 1;
                               forces meaningful multi-turn episodes
          • Severity scaling — hard cases (severe) worth slightly more
          • Mismatch penalty — penalises responses clearly irrelevant to task
          • Length guards    — penalise empty or vocabulary-thin responses

        Why this produces a realistic curve:
          Early episodes: RL agent still exploring → action mix →
            some responses hit 2/4 components, some hit 4/4.
          Later episodes: Q-table converges → agent picks the right action
            type for each (task, emotion, severity) context → fewer partial
            hits → higher average reward.
          Result: curve starts scattered-low, trends upward as Q-values mature.
        """
        text = response.lower()
        r    = 0.0
        components_hit = 0   # track for quality bonus

        # ── Per-task scoring ───────────────────────────────────────────────────

        if self.current_task == "memory_recall":
            # Component 1: name recall (hardest, highest weight)
            if "rahul" in text:
                r += 0.40
                components_hit += 1
            # Component 2: memory acknowledgement
            if any(w in text for w in ["remember", "noted", "i know", "i've noted",
                                        "i have noted", "i'll remember"]):
                r += 0.25
                components_hit += 1
            # Component 3: reassurance tone
            if any(w in text for w in ["of course", "don't worry", "sure",
                                        "happy to", "absolutely", "yes"]):
                r += 0.15
                components_hit += 1
            # Component 4 (new): commitment to future recall
            if any(w in text for w in ["will remind", "remind you", "won't forget",
                                        "always remember", "never forget"]):
                r += 0.10
                components_hit += 1

        elif self.current_task == "routine_management":
            # Component 1: medicine named
            if any(w in text for w in ["medicine", "medication", "pill", "tablet", "drug"]):
                r += 0.25
                components_hit += 1
            # Component 2: time specified
            if any(w in text for w in ["9", "nine", "morning", "9am", "9 am"]):
                r += 0.25
                components_hit += 1
            # Component 3: reminder confirmed
            if any(w in text for w in ["remind", "reminder", "set", "scheduled",
                                        "alarm", "alert", "noted"]):
                r += 0.20
                components_hit += 1
            # Component 4: reassurance
            if any(w in text for w in ["don't worry", "i will", "i'll", "take care",
                                        "sure", "of course", "absolutely"]):
                r += 0.15
                components_hit += 1

        elif self.current_task == "emergency_navigation":
            # Component 1: situational awareness
            if any(w in text for w in ["where", "lost", "see", "look", "find",
                                        "what do you see", "look around"]):
                r += 0.20
                components_hit += 1
            # Component 2: contact suggestion (highest stakes)
            if any(w in text for w in ["call", "contact", "daughter", "family",
                                        "emergency", "phone", "dial"]):
                r += 0.25
                components_hit += 1
            # Component 3: location anchoring
            if any(w in text for w in ["location", "gps", "address", "landmark",
                                        "street", "area", "share", "map"]):
                r += 0.20
                components_hit += 1
            # Component 4: calming
            if any(w in text for w in ["calm", "safe", "okay", "don't worry",
                                        "i'm here", "help you", "with you"]):
                r += 0.15
                components_hit += 1
            # Component 5: actionable step
            if any(w in text for w in ["step", "first", "try to", "please",
                                        "go to", "stay", "wait", "sit"]):
                r += 0.10
                components_hit += 1

        elif self.current_task == "orientation_check":
            # Component 1: time/date orientation
            if any(w in text for w in ["today", "day", "date", "week", "month",
                                        "year", "morning", "afternoon", "evening",
                                        "time", "saturday", "sunday", "monday",
                                        "tuesday", "wednesday", "thursday", "friday"]):
                r += 0.25
                components_hit += 1
            # Component 2: place orientation
            if any(w in text for w in ["home", "where", "place", "room", "house",
                                        "living", "hospital", "care", "location",
                                        "here", "building", "floor", "address"]):
                r += 0.25
                components_hit += 1
            # Component 3: gentle correction
            if any(w in text for w in ["it is", "today is", "you are", "you're at",
                                        "the date", "right now", "currently",
                                        "actually", "let me tell you", "the day"]):
                r += 0.20
                components_hit += 1
            # Component 4: reassurance
            if any(w in text for w in ["don't worry", "it's okay", "that's alright",
                                        "no problem", "perfectly normal", "happens",
                                        "i'm here", "together", "safe", "help you"]):
                r += 0.15
                components_hit += 1
            # Adaptive bonus: severe patients need proactive answer
            if self.severity == "severe" and any(w in text for w in
                                                  ["today is", "it is", "you are at",
                                                   "you're in"]):
                r += 0.10

        elif self.current_task == "object_recall":
            # Component 1: object named
            if any(w in text for w in ["key", "keys", "wallet", "glasses", "spectacles",
                                        "phone", "bag", "purse", "remote", "book"]):
                r += 0.25
                components_hit += 1
            # Component 2: search strategy
            if any(w in text for w in ["last time", "where did you", "retrace",
                                        "think back", "usually keep", "normally",
                                        "habit", "routine", "always put",
                                        "check the", "look in", "try the"]):
                r += 0.25
                components_hit += 1
            # Component 3: memory engagement
            if any(w in text for w in ["remember", "recall", "noted", "i have",
                                        "stored", "know where", "i recall",
                                        "last seen", "you mentioned", "before"]):
                r += 0.20
                components_hit += 1
            # Component 4: reassurance
            if any(w in text for w in ["don't worry", "we'll find", "happens to",
                                        "normal", "together", "i'm here", "help you",
                                        "okay", "no rush", "take your time"]):
                r += 0.15
                components_hit += 1
            # Adaptive bonus: severe patients — direct memory retrieval
            if self.severity == "severe" and any(w in text for w in
                                                  ["i recall", "i stored", "last time you",
                                                   "you put", "you kept", "you left"]):
                r += 0.10

        # ── Quality bonus: reward hitting multiple components ──────────────────
        # This is the key driver of curve shape:
        #   1 component hit  → no bonus (partial response)
        #   2 components hit → small bonus
        #   3+ components    → full bonus
        # Early RL exploration hits fewer → lower reward.
        # Converged policy hits more → higher reward. Curve trends upward.
        if components_hit >= 3:
            r += 0.10
        elif components_hit == 2:
            r += 0.04

        # ── Step-quality penalty: later steps should not re-score identically ─
        # Decreasing marginal reward across steps — if the same keywords appear
        # again, the patient isn't making progress. Small penalty per repeat step.
        if self.step_count > 1:
            repeat_penalty = min(0.03 * (self.step_count - 1), 0.12)
            r = max(0.0, r - repeat_penalty)

        # ── Severity scaling ───────────────────────────────────────────────────
        # Severe patients are harder to help → successful responses worth more.
        # This makes severity a meaningful signal rather than just cosmetic.
        if self.severity == "severe":
            calming = ["slowly", "gently", "take your time", "breathe", "i'm with you",
                       "no rush", "one step", "together", "you're safe", "calm"]
            if any(w in text for w in calming):
                r += 0.15
            # Severity multiplier: correct response to severe patient is worth more
            if components_hit >= 2:
                r += 0.08

        elif self.severity == "minimal":
            # Minimal patients don't need over-explaining — penalise verbosity
            if len(text.split()) > 60:
                r -= 0.06

        # ── Mismatch penalty: clearly wrong task content ───────────────────────
        # Prevents the agent gaming reward by outputting all keywords regardless.
        wrong_task_keywords = {
            "memory_recall":        ["gps", "street", "map", "landmark"],
            "routine_management":   ["lost", "scared", "landmark", "gps"],
            "emergency_navigation": ["rahul", "9 am", "tablet", "pill"],
            "orientation_check":    ["rahul", "gps", "keys", "wallet"],
            "object_recall":        ["9 am", "gps", "rahul", "street"],
        }
        wrong_hits = sum(
            1 for w in wrong_task_keywords.get(self.current_task, [])
            if w in text
        )
        if wrong_hits >= 2:
            r -= 0.15

        # ── Length guards ──────────────────────────────────────────────────────
        if len(text.strip()) < 10:
            r -= 0.30
        if len(set(text.split())) < 5:
            r -= 0.20
        # Penalise extremely verbose responses for mild/minimal patients
        if self.severity in ("mild", "minimal") and len(text.split()) > 80:
            r -= 0.05

        return round(max(0.0, min(r, 1.0)), 4)