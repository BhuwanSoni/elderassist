"""
backend/api.py — ElderAssist FastAPI Server (Production-Ready)

Endpoints:
    GET  /              → serves React frontend (or health check if no build)
    GET  /health        → detailed health + env status
    POST /reset         → start new episode
    GET  /step          → auto-agent step
    POST /step_manual   → manual message step
    GET  /state         → current env state
    GET  /history       → full episode history
    POST /run_episode   → run full episode, return all steps
    GET  /tasks         → list available tasks

Run:
    uvicorn backend.api:app --reload --port 8000
"""

import time
import json
import csv
import os
from typing import Optional, Dict, Any, List
from backend.agent import reset_step_counter, update_q, detect_emotion, _get_state_key  
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.env import ElderAssistEnv
from backend.agent import choose_action

# ── App init ──────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ElderAssist AI Environment",
    description="Dementia care simulation RL environment — ElderAssistEnv-v2-XGB",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # allow all origins (frontend is served from same host)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global state ──────────────────────────────────────────────────────────────

env            = ElderAssistEnv()
current_state  = None           # last Observation object
episode_log: List[Dict] = []    # all steps this episode
all_episodes:  List[Dict] = []  # summary of every completed episode
episode_number = 0
server_start   = time.time()

# ── Data paths ────────────────────────────────────────────────────────────────

DATA_DIR      = os.path.join(os.path.dirname(__file__), "..", "data")
REWARDS_CSV   = os.path.join(DATA_DIR, "rewards.csv")
LOGS_JSON     = os.path.join(DATA_DIR, "logs.json")

os.makedirs(DATA_DIR, exist_ok=True)

# ── Frontend build path ───────────────────────────────────────────────────────
# Resolves to:  <repo_root>/frontend/build/
FRONTEND_BUILD = os.path.join(os.path.dirname(__file__), "..", "frontend", "build")

# ── Request models ────────────────────────────────────────────────────────────

class ResetRequest(BaseModel):
    task_name:        Optional[str]              = "memory_recall"
    patient_features: Optional[Dict[str, float]] = None

class ManualStepRequest(BaseModel):
    message: str

class RunEpisodeRequest(BaseModel):
    task_name:        Optional[str]              = "memory_recall"
    patient_features: Optional[Dict[str, float]] = None
    max_steps:        Optional[int]              = None   # None = use env default

# ── Helpers ───────────────────────────────────────────────────────────────────

def _obs_to_dict(obs) -> Dict[str, Any]:
    """Serialize an Observation dict into a JSON-safe dict."""
    memory = obs.get("memory") or {}
    return {
        "message":  obs["message"],
        "task":     obs["task"],
        "step":     obs["step"],
        "progress": round(obs["progress"], 4),
        "hint":     obs.get("hint", None),
        "memory": {
            "short_term": dict(memory.get("short_term", {})),
            "long_term":  dict(memory.get("long_term",  {})),
            "forgotten":  list(memory.get("forgotten",  [])),
        },
    }


def _append_rewards_csv(ep: int, task: str, step: int,
                         reward: float, cumulative: float,
                         severity: str, cognitive_score: float) -> None:
    write_header = not os.path.exists(REWARDS_CSV)
    with open(REWARDS_CSV, "a", newline="") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow([
                "episode", "task", "step", "reward",
                "cumulative", "severity", "cognitive_score", "timestamp",
            ])
        writer.writerow([
            ep, task, step,
            round(reward, 4), round(cumulative, 4),
            severity, round(cognitive_score, 4),
            round(time.time(), 2),
        ])


def _flush_logs_json() -> None:
    with open(LOGS_JSON, "w") as f:
        json.dump(all_episodes, f, indent=2)


def _flush_live_log() -> None:
    """Write current in-progress episode steps to logs.json after every step.
    This means logs.json always has data — never empty — even mid-episode."""
    live = {
        "live_episode":   episode_number,
        "current_steps":  list(episode_log),
        "completed":      list(all_episodes),
    }
    with open(LOGS_JSON, "w") as f:
        json.dump(live, f, indent=2)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
def health():
    env_ready   = current_state is not None
    env_task    = env.current_task if hasattr(env, "current_task") else None
    env_step    = env.step_count  if hasattr(env, "step_count")   else 0
    env_done    = env.done        if hasattr(env, "done")         else False
    return {
        "status":           "healthy",
        "env_initialized":  env_ready,
        "current_task":     env_task,
        "current_step":     env_step,
        "episode_done":     env_done,
        "total_episodes":   episode_number,
        "uptime_seconds":   round(time.time() - server_start, 1),
    }


@app.get("/tasks", tags=["Info"])
def list_tasks():
    return {
        "tasks": [
            {
                "id":          "memory_recall",
                "label":       "Memory Recall",
                "difficulty":  "easy",
                "max_steps":   5,
                "description": "Remember and confirm the patient's son's name across turns.",
            },
            {
                "id":          "routine_management",
                "label":       "Routine Management",
                "difficulty":  "medium",
                "max_steps":   6,
                "description": "Extract and confirm a medicine reminder at 9 AM.",
            },
            {
                "id":          "emergency_navigation",
                "label":       "Emergency Navigation",
                "difficulty":  "hard",
                "max_steps":   8,
                "description": "Help an elderly patient who is lost find their way safely.",
            },
            {
                "id":          "orientation_check",
                "label":       "Orientation Check",
                "difficulty":  "medium",
                "max_steps":   6,
                "description": "Assess and gently correct the patient's temporal and spatial orientation (MMSE-based).",
            },
            {
                "id":          "object_recall",
                "label":       "Object Recall",
                "difficulty":  "hard",
                "max_steps":   7,
                "description": "Help an elderly patient recall where they placed a missing object using memory and strategy.",
            },
        ]
    }


@app.get("/reset")
def reset(task_name: str = "memory_recall"):
    global current_state, episode_log, episode_number

    valid_tasks = {"memory_recall", "routine_management", "emergency_navigation",
                   "orientation_check", "object_recall"}
    if task_name not in valid_tasks:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid task. Choose from: {valid_tasks}"
        )

    episode_log = []
    episode_number += 1

    env.task_name = task_name
    result = env.reset()

    reset_step_counter(task_name)

    current_state = result["observation"]

    return {
        "episode": episode_number,
        "state": result["observation"],
        "done": result["done"],
        "info": {
            "cognitive_score": result["info"].get("cognitive_score"),
            "severity": result["info"].get("severity"),
            "task": task_name,
            "episode": episode_number,
        },
    }

@app.get("/step", tags=["Environment"])
@app.post("/step", tags=["Environment"])
def step_auto():
    """Agent picks the action automatically."""
    global current_state

    if current_state is None:
        raise HTTPException(status_code=400, detail="Environment not initialized. POST /reset first.")
    if env.done:
        raise HTTPException(status_code=400, detail="Episode is done. POST /reset to start a new one.")

    mem = current_state.get("memory", {})
    merged_memory = {
        **mem.get("short_term", {}),
        **mem.get("long_term", {})
    }

    result = choose_action({
        "message":  current_state["message"],
        "task":     current_state["task"],
        "step":     current_state["step"],
        "memory":   merged_memory,
        "severity": getattr(env, "severity", "moderate"),
    })

    action    = result["response"]
    reasoning = result["reasoning"]

    return _apply_step(action, reasoning)


@app.post("/step_manual", tags=["Environment"])
def step_manual(req: ManualStepRequest):
    """Manually supply an AI response message."""
    global current_state

    if current_state is None:
        raise HTTPException(status_code=400, detail="Environment not initialized. POST /reset first.")
    if env.done:
        raise HTTPException(status_code=400, detail="Episode is done. POST /reset to start a new one.")
    if not req.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    reasoning = {
        "emotion":        "neutral",
        "task":           current_state.get("task", "unknown"),
        "step":           current_state.get("step", 0),
        "memory_used":    "manual_input",
        "mode":           "MANUAL",
        "decision_layer": "human_override",
        "severity":       getattr(env, "severity", "moderate"),
        "confidence":     "n/a",
        "flags":          ["manual_step"],
    }

    return _apply_step(req.message.strip(), reasoning)


def _apply_step(action: str, reasoning: dict) -> Dict[str, Any]:
    """Shared logic for auto + manual step. Now accepts and returns reasoning."""
    global current_state

    step_result    = env.step(action)
    current_state  = step_result["observation"]

    reward          = step_result["reward"]
    done            = step_result["done"]
    info            = step_result["info"] or {}
    cognitive_score = info.get("cognitive_score", getattr(env, "cognitive_score", 0.5))
    severity        = info.get("severity",        getattr(env, "severity",        "moderate"))
    step_num        = info.get("step",             getattr(env, "step_count",     0))
    cumulative      = info.get("cumulative_progress", getattr(env, "progress", 0.0))

    task_name      = getattr(env, "current_task", "")
    next_msg       = step_result["observation"].get("message", "") if isinstance(step_result["observation"], dict) else ""
    next_emotion   = detect_emotion(next_msg)
    next_state_key = _get_state_key(task_name, next_emotion, severity)
    update_q(task_name, reward, next_state_key)

    step_record = {
        "episode":         episode_number,
        "step":            step_num,
        "action":          action,
        "reasoning":       reasoning,
        "reward":          round(reward, 4),
        "cumulative":      round(cumulative, 4),
        "done":            done,
        "severity":        severity,
        "cognitive_score": round(cognitive_score, 4),
        "task":            getattr(env, "current_task", ""),
        "timestamp":       round(time.time(), 2),
    }
    episode_log.append(step_record)

    _append_rewards_csv(
        ep=episode_number,
        task=getattr(env, "current_task", ""),
        step=step_num,
        reward=reward,
        cumulative=cumulative,
        severity=severity,
        cognitive_score=cognitive_score,
    )

    _flush_live_log()

    if done:
        final_grade = info.get("final_grade") or round(cumulative, 4)
        episode_summary = {
            "episode":         episode_number,
            "task":            getattr(env, "current_task", ""),
            "steps":           step_num,
            "final_score":     final_grade,
            "severity":        severity,
            "cognitive_score": round(cognitive_score, 4),
            "success":         final_grade >= 0.6,
            "step_log":        list(episode_log),
            "timestamp":       round(time.time(), 2),
        }
        all_episodes.append(episode_summary)
        _flush_logs_json()

    return {
        "state":    step_result["observation"],
        "action":   action,
        "reasoning": reasoning,
        "reward":   round(reward, 4),
        "done":     done,
        "info": {
            "step":                step_num,
            "cumulative_progress": round(cumulative, 4),
            "final_grade":         info.get("final_grade") if done else None,
            "task":                getattr(env, "current_task", ""),
            "cognitive_score":     round(cognitive_score, 4),
            "severity":            severity,
            "episode":             episode_number,
        },
    }


@app.get("/state", tags=["Environment"])
def get_state():
    """Current environment state without stepping."""
    if current_state is None:
        raise HTTPException(status_code=400, detail="Environment not initialized. POST /reset first.")

    return {
        "state":           _obs_to_dict(current_state),
        "done":            getattr(env, "done", False),
        "step":            getattr(env, "step_count", 0),
        "progress":        round(getattr(env, "progress", 0.0), 4),
        "cognitive_score": round(getattr(env, "cognitive_score", 0.5), 4),
        "severity":        getattr(env, "severity", "moderate"),
        "episode":         episode_number,
    }


@app.get("/history", tags=["Logging"])
def get_history(last_n: int = Query(default=20, ge=1, le=200)):
    """Current episode step log + summary of last N completed episodes."""
    completed = all_episodes[-last_n:] if all_episodes else []
    avg_score = (
        round(sum(e["final_score"] for e in completed) / len(completed), 4)
        if completed else None
    )
    return {
        "episode_number":     episode_number,
        "current_steps":      list(episode_log),
        "completed_episodes": completed,
        "stats": {
            "total_episodes": len(all_episodes),
            "avg_score":      avg_score,
            "success_rate":   round(
                sum(1 for e in all_episodes if e["success"]) / len(all_episodes), 4
            ) if all_episodes else None,
        },
    }

@app.get("/config")
def config():
    return {
        "tasks": ["memory_recall", "routine_management", "emergency_navigation"]
    }

@app.get("/step_fast")
def step_fast():
    return step_auto()

@app.get("/run_episode", tags=["Simulation"])
def run_full_episode(req: RunEpisodeRequest = RunEpisodeRequest()):
    """
    Run a complete episode in one call.
    Returns every step with rewards and reasoning.
    """

    task = req.task_name or "memory_recall"
    valid = {"memory_recall", "routine_management", "emergency_navigation",
             "orientation_check", "object_recall"}

    if task not in valid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid task. Choose from: {valid}"
        )

    env.task_name = task
    reset_result = env.reset()

    obs = reset_result["observation"]
    cog = reset_result["info"].get("cognitive_score", 0.5)
    sev = reset_result["info"].get("severity", "moderate")

    steps_data: List[Dict] = []
    total_reward = 0.0

    max_steps = req.max_steps or {
        "memory_recall": 5,
        "routine_management": 6,
        "emergency_navigation": 8,
        "orientation_check": 6,
        "object_recall": 7,
    }[task]

    for s in range(1, max_steps + 1):

        if env.done:
            break

        mem = obs.get("memory", {})
        merged_memory = {
            **mem.get("short_term", {}),
            **mem.get("long_term", {}),
        }

        agent_result = choose_action({
            "message":  obs["message"],
            "task":     obs["task"],
            "step":     obs["step"],
            "memory":   merged_memory,
            "severity": sev,
        })

        action    = agent_result["response"]
        reasoning = agent_result["reasoning"]

        result = env.step(action)

        reward = result["reward"]
        done   = result["done"]
        obs    = result["observation"]

        total_reward += reward

        steps_data.append({
            "step":         s,
            "patient_msg":  obs["message"],
            "agent_action": action,
            "reasoning":    reasoning,
            "reward":       round(reward, 4),
            "cumulative":   round(min(total_reward, 1.0), 4),
            "done":         done,
        })

        if done:
            break

    final_score = round(min(total_reward, 1.0), 4)
    success = final_score >= 0.6

    episode_summary = {
        "episode":         episode_number,
        "task":            task,
        "steps":           len(steps_data),
        "final_score":     final_score,
        "severity":        sev,
        "cognitive_score": round(cog, 4),
        "success":         success,
        "step_log":        steps_data,
        "timestamp":       round(time.time(), 2),
    }
    all_episodes.append(episode_summary)
    _flush_logs_json()

    return {
        "task":            task,
        "cognitive_score": round(cog, 4),
        "severity":        sev,
        "total_steps":     len(steps_data),
        "final_score":     final_score,
        "success":         success,
        "steps":           steps_data,
    }


# ── Serve React frontend (must be LAST — catches all unmatched routes) ────────

# Mount the static assets folder (JS, CSS, images etc.)
_static_dir = os.path.join(FRONTEND_BUILD, "static")
if os.path.isdir(_static_dir):
    app.mount("/static", StaticFiles(directory=_static_dir), name="static")

@app.get("/", include_in_schema=False)
@app.get("/{full_path:path}", include_in_schema=False)
def serve_react(full_path: str = ""):
    """
    Catch-all route: serve index.html for any path that isn't an API route.
    This enables React Router (client-side routing) to work correctly.
    Falls back to a JSON health response if the build folder doesn't exist yet.
    """
    index_html = os.path.join(FRONTEND_BUILD, "index.html")
    if os.path.isfile(index_html):
        return FileResponse(index_html)
    # Build not present — return JSON so the API is still usable
    return {
        "status":  "running",
        "service": "ElderAssist AI Environment",
        "version": "2.0.0",
        "note":    "React build not found. Run `npm run build` inside /frontend and place the output at frontend/build/",
        "uptime_seconds": round(time.time() - server_start, 1),
    }