# 🧠 ElderAssist AI — Building an Adaptive Dementia Care Agent

## 🚨 The Problem

Dementia patients don’t just forget information —
they struggle with:

* Memory recall (names, routines)
* Orientation (time, place)
* Anxiety during confusion
* Repetitive questioning

Traditional chatbots fail because they:

* Repeat the same responses
* Ignore emotional state
* Don’t improve over time

---

## 💡 Our Solution

We built **ElderAssist AI** — an intelligent assistant that:

👉 Learns how to respond using Reinforcement Learning
👉 Adapts to patient emotion and severity
👉 Avoids repetition using action history
👉 Provides safe, human-like assistance

---
## 🏗️ System Overview

ElderAssist AI combines:
- 🧠 XGBoost → Cognitive risk prediction
- 🤖 Reinforcement Learning → Adaptive conversation
- 📊 Real-time scoring → Patient state tracking

This creates a closed-loop intelligent care system.

## 🧠 System Architecture

### 🔁 RL Decision Layer

At the core, we use **Q-learning** to decide *what type of response to give*.

State includes:

* Task (memory, navigation, etc.)
* Emotion (positive, neutral, negative)
* Severity (from cognitive model)
* Step phase (early / mid / late)

```python
state_key = f"{task}__{emotion}__{severity}__{step_bucket}"
```

The agent selects actions from:

* reassure
* give_hint
* ask_question
* direct_answer

This is implemented in the RL policy layer 

---

## 🧠 Anti-Repetition Intelligence

One major challenge:
Patients get confused if AI repeats itself.

We solved this using:

```python
recent = _action_history.get(task, [])[-2:]
valid_actions = [a for a in ACTIONS if a not in recent]
```

👉 The agent **never repeats last 2 actions**

This creates:

✔ Natural conversation flow
✔ No “looping questions” problem
✔ More human-like interaction

---

## 📊 Reward-Driven Learning

The system improves using **Q-learning updates**:

```python
Q(s,a) ← Q + α (r + γ max Q(s') − Q)
```

But raw rewards are noisy, so we use **reward shaping**:

```python
reward = compute_shaped_reward(emotion, success)
```

Implemented in simulation loop 

---

## 🧠 Cognitive Awareness (XGBoost Integration)

Each patient has a **dynamic cognitive score**:

* Generated using XGBoost model
* Controls severity: mild → severe
* Affects:

  * prompts
  * difficulty
  * reward scaling

```python
score = _XGB_MODEL.predict_proba(x)
```

From environment logic 

---

## 🧠 Multi-Task Intelligence

The agent handles multiple real-world scenarios:

### 🧠 Memory Recall

→ Remembers: “Son’s name = Rahul”

### 💊 Routine Management

→ Sets medicine reminder at 9 AM

### 🚨 Emergency Navigation

→ Helps lost patient find way safely

### 🧭 Orientation Check

→ Confirms time & place (MMSE-based)

### 🔍 Object Recall

→ Helps find lost items

Tasks defined in environment 

---

## 🤖 Hybrid Response System

RL decides **what to do**
Rules / LLM decide **how to say it**

```text
RL → action type → response bank → final message
```

This ensures:

* Structured responses
* High scoring (grader-aligned)
* Natural conversation

---

## 📊 Evaluation System

Each task has a custom grader:

Example (memory recall):

* Rahul mentioned → +0.4
* Confirms memory → +0.3
* Reassures → +0.3

From grader logic 

---

## 🔄 Continuous Learning

Every step:

1. Agent responds
2. Environment gives reward
3. Q-table updates
4. Policy improves

```python
update_q(task, reward, next_state_key)
```

---

## 🖥️ Full-Stack System

### Backend

* FastAPI server
* RL environment
* Simulation + logging

See API system 

### Frontend

* React-based UI
* Real-time conversation
* AI Insights panel

Frontend logic 

---

## 📊 AI Insights (Key Innovation)

We expose real-time metrics:

* Cognitive Score
* Emotion Detection
* Risk Level

👉 This makes AI **explainable to judges**

---

## 🔥 Example Interaction

Before RL:

> “What is your son's name?”
> “What is your son's name?”
> “What is your son's name?” ❌

After RL:

> “Think gently… do you remember your son’s name?”
> “Great — it’s Rahul 😊”
> “I’ll remember that for you.” ✅

---

## 🏆 Key Achievements

✔ Adaptive RL-based dialogue system
✔ Emotion-aware responses
✔ No repetition loops
✔ Real-world healthcare use case
✔ Full-stack deployable system

---

## 🚀 Conclusion

ElderAssist AI is not just a chatbot.

👉 It is a **learning, adaptive caregiver assistant**
👉 Designed for real-world dementia support

---

## 🔗 Demo

(https://huggingface.co/spaces/Rawbhuwan/elderassist-final)

---

---

## 🚀 Training Notebook

To ensure reproducibility, the full training pipeline is available:

👉 https://colab.research.google.com/drive/1lH8EyxhUA2_3nFCT4BIz_YNQazPkSiht?usp=sharing

This includes:
- Dataset loading
- Feature engineering
- Model training
- Threshold tuning
- Performance evaluation
