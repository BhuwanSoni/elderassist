"""
grader.py — Graders for each task.
Each grader takes a list of agent response strings and returns a float in [0.0, 1.0].
"""
from typing import List


def grade_memory_recall(history: List[str]) -> float:
    """
    Easy task: Agent must remember and confirm the patient's son's name (Rahul).
    Scoring:
      - Mentions 'rahul' at least once          : +0.4
      - Acknowledges / confirms memory           : +0.3
      - Responds gently / reassuringly           : +0.3
    """
    score = 0.0
    rahul_mentioned = False
    confirmed       = False
    gentle          = False

    for response in history:
        text = response.lower()
        if "rahul" in text:
            rahul_mentioned = True
        if any(w in text for w in ["remember", "noted", "i know", "i've noted",
                                    "i have noted", "i'll remember"]):
            confirmed = True
        if any(w in text for w in ["of course", "don't worry", "sure",
                                    "happy to", "absolutely", "yes"]):
            gentle = True

    if rahul_mentioned:
        score += 0.4
    if confirmed:
        score += 0.3
    if gentle:
        score += 0.3

    return round(min(score, 1.0), 4)


def grade_routine_management(history: List[str]) -> float:
    """
    Medium task: Agent must extract and confirm a medicine reminder at 9 AM.
    Scoring:
      - Mentions medicine/medication             : +0.3
      - Mentions 9 / 9 AM / morning             : +0.3
      - Sets / confirms reminder                 : +0.2
      - Gives reassurance                        : +0.2
    """
    score       = 0.0
    medicine    = False
    time_ok     = False
    reminder_set = False
    reassured   = False

    for response in history:
        text = response.lower()
        if any(w in text for w in ["medicine", "medication", "tablet", "pill", "drug"]):
            medicine = True
        if any(w in text for w in ["9", "nine", "morning", "9am", "9 am"]):
            time_ok = True
        if any(w in text for w in ["remind", "reminder", "set", "scheduled",
                                    "alarm", "alert", "noted"]):
            reminder_set = True
        if any(w in text for w in ["don't worry", "i will", "i'll", "take care",
                                    "sure", "of course", "absolutely"]):
            reassured = True

    if medicine:
        score += 0.3
    if time_ok:
        score += 0.3
    if reminder_set:
        score += 0.2
    if reassured:
        score += 0.2

    return round(min(score, 1.0), 4)


def grade_emergency_navigation(history: List[str]) -> float:
    """
    Hard task: Agent must handle an elderly person who is lost.
    Multi-step: detect distress, ask location, suggest calling contact, calm user.
    Scoring:
      - Detects distress / asks where they are  : +0.2
      - Suggests calling someone                : +0.25
      - Mentions location/GPS/address/landmark  : +0.25
      - Calms the user / provides reassurance   : +0.15
      - Gives a clear actionable step           : +0.15
    """
    score      = 0.0
    detects    = False
    calls      = False
    location   = False
    calms      = False
    actionable = False

    for response in history:
        text = response.lower()
        if any(w in text for w in ["where are you", "lost", "help",
                                    "what do you see", "look around", "find you"]):
            detects = True
        if any(w in text for w in ["call", "contact", "daughter", "family",
                                    "emergency", "phone", "dial", "112", "911"]):
            calls = True
        if any(w in text for w in ["location", "gps", "address", "landmark",
                                    "street", "area", "share", "map"]):
            location = True
        if any(w in text for w in ["calm", "safe", "okay", "don't worry",
                                    "i'm here", "help you", "with you"]):
            calms = True
        if any(w in text for w in ["step", "first", "try to", "please",
                                    "go to", "stay", "wait", "sit"]):
            actionable = True

    if detects:
        score += 0.2
    if calls:
        score += 0.25
    if location:
        score += 0.25
    if calms:
        score += 0.15
    if actionable:
        score += 0.15

    return round(min(score, 1.0), 4)


def grade_orientation_check(history: List[str]) -> float:
    """
    Medium task: Agent must assess the patient's temporal/spatial orientation.
    Clinical basis: Mini-Mental State Exam (MMSE) orientation questions.

    Scoring:
      - Asks or confirms day / date / time       : +0.25
      - Asks or confirms place / location        : +0.25
      - Provides correct orientation gently      : +0.25
      - Reassures and does not embarrass patient : +0.25

    Adaptive difficulty:
      - Severe:   agent must provide the answer unprompted
      - Moderate: agent may ask and then confirm
      - Mild:     agent confirms patient's answer
    """
    score         = 0.0
    time_checked  = False
    place_checked = False
    corrects      = False
    reassures     = False

    for response in history:
        text = response.lower()

        # Time/date orientation
        if any(w in text for w in ["today", "day", "date", "week", "month",
                                    "year", "morning", "afternoon", "evening",
                                    "time", "saturday", "sunday", "monday",
                                    "tuesday", "wednesday", "thursday", "friday"]):
            time_checked = True

        # Place orientation
        if any(w in text for w in ["home", "where", "place", "room", "house",
                                    "living", "hospital", "care", "location",
                                    "here", "building", "floor", "address"]):
            place_checked = True

        # Agent provides correct answer / gentle correction
        if any(w in text for w in ["it is", "today is", "you are", "you're at",
                                    "the date", "right now", "currently",
                                    "actually", "let me tell you", "the day"]):
            corrects = True

        # Reassurance
        if any(w in text for w in ["don't worry", "it's okay", "that's alright",
                                    "no problem", "perfectly normal", "happens",
                                    "i'm here", "together", "safe", "help you"]):
            reassures = True

    if time_checked:
        score += 0.25
    if place_checked:
        score += 0.25
    if corrects:
        score += 0.25
    if reassures:
        score += 0.25

    return round(min(score, 1.0), 4)


def grade_object_recall(history: List[str]) -> float:
    """
    Hard task: Agent must help patient recall where they placed objects.
    Clinical basis: Object recall is a key early-stage dementia marker.

    Scoring:
      - Mentions the lost object (keys/wallet/glasses) : +0.25
      - Suggests a retracing / last-seen strategy      : +0.25
      - Engages long-term memory to help               : +0.25
      - Reassures / de-escalates frustration           : +0.25

    Adaptive difficulty:
      - Severe:   agent recalls from stored memory and provides direct answer
      - Moderate: agent guides patient to recall with hints
      - Mild:     agent asks systematic questions
    """
    score        = 0.0
    object_named = False
    strategy     = False
    memory_used  = False
    reassures    = False

    OBJECTS = ["key", "keys", "wallet", "glasses", "spectacles", "phone",
               "bag", "purse", "medicine", "remote", "book"]

    for response in history:
        text = response.lower()

        if any(obj in text for obj in OBJECTS):
            object_named = True

        if any(w in text for w in ["last time", "where did you", "retrace",
                                    "think back", "usually keep", "normally",
                                    "habit", "routine", "always put",
                                    "check the", "look in", "try the"]):
            strategy = True

        if any(w in text for w in ["remember", "recall", "noted", "i have",
                                    "stored", "know where", "i recall",
                                    "last seen", "you mentioned", "before"]):
            memory_used = True

        if any(w in text for w in ["don't worry", "we'll find", "happens to",
                                    "normal", "together", "i'm here", "help you",
                                    "okay", "alright", "no rush", "take your time"]):
            reassures = True

    if object_named:
        score += 0.25
    if strategy:
        score += 0.25
    if memory_used:
        score += 0.25
    if reassures:
        score += 0.25

    return round(min(score, 1.0), 4)


GRADERS = {
    "memory_recall":        grade_memory_recall,
    "routine_management":   grade_routine_management,
    "emergency_navigation": grade_emergency_navigation,
    "orientation_check":    grade_orientation_check,
    "object_recall":        grade_object_recall,
}


def grade(task: str, history: List[str]) -> float:
    if task not in GRADERS:
        return 0.0
    return GRADERS[task](history)