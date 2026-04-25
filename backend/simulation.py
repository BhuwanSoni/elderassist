# backend/simulation.py

import csv
import json
import os
from env import ElderAssistEnv
from agent import choose_action, reset_step_counter, update_q, detect_emotion, _get_state_key


# ── Task rotation ──────────────────────────────────────────────────────────────

_TASKS = [
    "memory_recall",
    "routine_management",
    "emergency_navigation",
    "orientation_check",
    "object_recall",
]

SUCCESS_THRESHOLD = 8.0


# ── Reward smoothing (moving average) ─────────────────────────────────────────

def smooth_rewards(rewards, window_size=5):
    """
    Simple moving-average smoother.
    Returns a list the same length as `rewards`.
    """
    smoothed = []
    for i in range(len(rewards)):
        start  = max(0, i - window_size + 1)
        window = rewards[start : i + 1]
        smoothed.append(round(sum(window) / len(window), 4))
    return smoothed


# ── Improved per-step reward shaping ──────────────────────────────────────────

def compute_shaped_reward(
    emotion: str,
    success: bool,
    step_penalty: float = 0.01,
) -> float:
    """
    Soft-penalty reward function with positive reinforcement.
    Used to post-process raw env rewards before Q-table updates.

    Returns a clipped reward in [-1, 1].
    """
    reward = 0.0

    if success:
        reward += 1.0

    if emotion == "positive":
        reward += 0.5
    elif emotion == "neutral":
        reward += 0.1
    elif emotion == "negative":
        reward -= 0.2        # soft penalty, not harsh -1

    reward -= step_penalty   # small efficiency nudge

    # ── Reward clipping (prevents spikes) ─────────────────────────────────
    reward = max(min(reward, 1.0), -1.0)

    return round(reward, 4)


def run_simulation(episodes=50, max_steps=10, save_path="data/rewards.csv"):
    """
    Runs multiple episodes and logs reward per episode.
    Now includes Q-table updates so the agent learns across episodes.

    Args:
        episodes  (int) : number of episodes to run (default 50)
        max_steps (int) : max steps per episode before forced termination
        save_path (str) : CSV output path

    Returns:
        rewards_history (list[float])
    """

    env = ElderAssistEnv()
    rewards_history = []
    tasks_history   = []

    os.makedirs(os.path.dirname(save_path), exist_ok=True)

    for ep in range(episodes):

        task = _TASKS[ep % len(_TASKS)]
        tasks_history.append(task)

        result = env.reset(task_name=task)
        reset_step_counter(task)

        state        = result["observation"]
        done         = False
        total_reward = 0.0
        step_count   = 0

        while not done and step_count < max_steps:

            mem = state.get("memory", {}) if isinstance(state, dict) else {}
            merged_memory = {
                **mem.get("short_term", {}),
                **mem.get("long_term",  {}),
            }

            message  = state["message"] if isinstance(state, dict) else state.message
            severity = getattr(env, "severity", "moderate")
            emotion  = detect_emotion(message)

            agent_result = choose_action({
                "message":  message,
                "task":     state["task"]    if isinstance(state, dict) else state.task,
                "step":     state.get("step", step_count) if isinstance(state, dict) else state.step,
                "memory":   merged_memory,
                "severity": severity,
            })
            action = agent_result["response"]

            result       = env.step(action)
            state        = result["observation"]
            reward       = result["reward"]
            done         = result["done"]
            total_reward += reward
            step_count   += 1

            # ── Q-table update: close the RL loop ─────────────────────────
            # Compute next state key for Bellman update
            next_msg      = state["message"] if isinstance(state, dict) else state.message
            next_emotion  = detect_emotion(next_msg)
            next_state_key = _get_state_key(task, next_emotion, severity, step=step_count)

            # Use shaped reward for Q-learning (smoother gradient signal)
            success       = reward >= 0.50
            shaped        = compute_shaped_reward(next_emotion, success)
            update_q(task, shaped, next_state_key)

        # ── Reward clipping before logging ────────────────────────────────
        total_reward = max(min(total_reward, 10.0), -10.0)
        rewards_history.append(total_reward)
        print(
            f"Episode {ep + 1:>3} | Task: {task:<22} | "
            f"Steps: {step_count} | Reward: {total_reward:.2f}"
        )

    # ── Smooth rewards ─────────────────────────────────────────────────────────
    smoothed_rewards = smooth_rewards(rewards_history, window_size=5)

    # ── Save CSV ───────────────────────────────────────────────────────────────
    with open(save_path, mode="w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["episode", "task", "reward", "smoothed_reward"])
        for i, (r, s, t) in enumerate(zip(rewards_history, smoothed_rewards, tasks_history)):
            writer.writerow([i + 1, t, round(r, 4), round(s, 4)])

    # ── Summary stats ──────────────────────────────────────────────────────────
    avg     = sum(rewards_history) / len(rewards_history) if rewards_history else 0.0
    best    = max(rewards_history)
    worst   = min(rewards_history)
    success = sum(1 for r in rewards_history if r > SUCCESS_THRESHOLD)

    print(f"\n✅ Simulation complete. Results saved to {save_path}")
    print(f"   Episodes    : {episodes}")
    print(f"   Avg reward  : {avg:.2f}  |  Best: {best:.2f}  |  Worst: {worst:.2f}")
    print(f"   Success rate: {success / len(rewards_history) * 100:.1f}%  (threshold > {SUCCESS_THRESHOLD})")

    summary_path = os.path.join(os.path.dirname(save_path), "summary.json")
    with open(summary_path, "w") as f:
        json.dump({
            "episodes":      episodes,
            "avg":           round(avg, 4),
            "best":          round(best, 4),
            "worst":         round(worst, 4),
            "success_count": success,
            "success_rate":  round(success / len(rewards_history) * 100, 2),
            "threshold":     SUCCESS_THRESHOLD,
        }, f, indent=2)

    print(f"   Summary JSON: {summary_path}")
    return {
        "raw_rewards":      rewards_history,
        "smoothed_rewards": smoothed_rewards,
    }


if __name__ == "__main__":
    run_simulation()