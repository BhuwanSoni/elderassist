---
title: ElderAssist
emoji: 🧠
colorFrom: blue
colorTo: green
sdk: docker
sdk_version: 4.44.0
python_version: 3.10
app_file: app.py
# 🧠 ElderAssist AI

### Dementia Care Simulation with Reinforcement Learning & Cognitive Intelligence

---

## 🚀 Overview

**ElderAssist AI** is an intelligent caregiving simulation platform designed to assist in dementia care through real-time AI interaction.

It combines:

* 🤖 **Conversational AI**
* 🧠 **Cognitive Scoring (XGBoost)**
* 🎯 **Reinforcement Learning (Q-Learning)**
* 📊 **Live Feedback & Insights**

👉 The system simulates realistic patient–caregiver interactions and evaluates responses to guide better caregiving decisions.

---

## 🎯 Problem Statement

Dementia patients often:

* Forget daily routines
* Experience confusion & anxiety
* Require patient, adaptive communication

👉 Traditional systems lack **real-time adaptive intelligence**

---

## 💡 Our Solution

ElderAssist AI provides:

* 🗣️ Real-time conversation simulation
* 📈 Cognitive health scoring
* 🎯 Reward-based learning for responses
* ⚠️ Risk-level assessment
* 🧠 AI-driven insights for decision support

---

## 🔥 Key Features

### 🧠 AI Insights Engine

* Cognitive Score (based on MMSE-like features)
* Emotion Detection (context-aware)
* Risk Level Classification (Low / Moderate / High)

---

### 💬 Interactive Care Simulation

* Real-time patient queries
* AI-generated caregiver responses
* Context-aware conversation flow

---

### 🎯 Reinforcement Learning System

* Q-learning based policy updates
* Reward system for better responses
* Continuous improvement over interactions

---

### 📊 Live Analytics Dashboard

* Cognitive profile gauge
* Reward curve visualization
* Session progress tracking
* Patient stability indicator

---

### 🧪 Multi-Scenario Testing

* Memory Recall
* Routine Management
* Emergency Navigation
* Orientation Check
* Object Recall

---

## 🏗️ Tech Stack

### 🔹 Backend

* **FastAPI** – API & server
* **Uvicorn** – ASGI server
* **XGBoost** – Cognitive scoring model
* **Python RL (Q-learning)** – Decision optimization

---

### 🔹 Frontend

* **React.js** – UI
* **Custom UI Components** – Dashboard & interaction panels

---

### 🔹 Deployment

* **Hugging Face Spaces** – Full-stack hosting

---

## 📂 Project Structure

```
elderassist-env/
│
├── app.py                 # Entry point (Uvicorn runner)
├── requirements.txt       # Dependencies
│
├── backend/
│   ├── api.py             # Main FastAPI app
│   ├── agent.py           # RL agent logic
│   ├── env.py             # Environment simulation
│   ├── grader.py          # Scoring system
│   └── simulation.py      # Scenario execution
│
├── frontend/
│   └── build/             # React production build
│
├── model/
│   ├── dementia_model.pkl
│   ├── feature_names.pkl
│   └── threshold.pkl
```

---

## ⚙️ How It Works

1. 👤 User selects a scenario
2. 🧓 Patient simulation generates a query
3. 🤖 AI responds based on:

   * RL policy
   * Cognitive score
4. 📊 System evaluates:

   * Reward
   * Emotion
   * Risk level
5. 🔁 Q-table updates for improved future responses

---

## 📈 Example Output

* Cognitive Score: **48 (Moderate)**
* Emotion Detected: **Confused 😟**
* Risk Level: **Moderate 🟡**
* Reward: **+0.71**

---

## 🧠 Innovation Highlights

* Combines **ML + RL + Conversational AI**
* Real-time adaptive decision system
* Explainable AI outputs for healthcare
* Scalable for real-world caregiver training

---

## 🌍 Impact

* Assists caregivers in better communication
* Helps in early detection of cognitive decline
* Provides structured simulation training
* Bridges gap between AI and healthcare

---

## 🚀 Future Enhancements

* 🎤 Voice interaction (speech-to-text)
* 📱 Mobile app version
* 🧠 Advanced emotion detection (NLP-based)
* ☁️ Cloud-based patient monitoring system
* 🏥 Integration with healthcare providers

---

## 👨‍💻 Author

**Bhuwan Soni**
Computer Science Engineering Student
AI/ML & Full Stack Developer

---

## ⭐ Acknowledgements

* XGBoost Documentation
* FastAPI Community
* Hugging Face Spaces

---

## 🏁 Final Note

> ElderAssist AI is not just a project — it’s a step toward intelligent, empathetic healthcare powered by AI.

---

🔥 *Built with innovation, empathy, and intelligence.*
