import eventlet
eventlet.monkey_patch()

# Load .env file — find_dotenv() walks UP the directory tree until it finds .env
try:
    from dotenv import load_dotenv, find_dotenv
    _dotenv_path = find_dotenv(usecwd=False)  # searches from this file upward
    if _dotenv_path:
        load_dotenv(_dotenv_path)
        print(f"✅ .env loaded from: {_dotenv_path}")
    else:
        print("⚠️  No .env file found — relying on system environment variables.")
except ImportError:
    pass  # python-dotenv not installed; rely on system env vars

import socketio
import cv2
import mediapipe as mp
import time
import os
import math
import json
import re
import requests
import numpy as np


from config import (
    CENTER_LEFT_LIMIT, CENTER_RIGHT_LIMIT,
    TURN_LEFT_TRIGGER, TURN_RIGHT_TRIGGER,
    STARTUP_STEPS_REQUIRED, STOP_TIMEOUT,
    STEP_COOLDOWN,
    MOMENTUM_GAIN, MOMENTUM_DECAY,
    CALIB_FRAMES_NEEDED, CALIB_NOISE_MULTIPLIER,
    CALIB_THRESHOLD_MIN, CALIB_THRESHOLD_MAX,
    CALIB_PROGRESS_FRAMES,
    SERVER_HOST, SERVER_PORT,
    CAMERA_INDEX, LOOP_SLEEP,
    BOUNCE_THRESHOLD as _DEFAULT_BOUNCE_THRESHOLD,
)

# --- 0. SERVER SETUP ---
sio = socketio.Server(cors_allowed_origins='*')

# --- LLM SETUP (Gemini REST API) ---
# Uses direct HTTP — no SDK version issues.
# v1beta endpoint has gemini-1.5-flash on the free tier.
_GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
_GEMINI_URL = (
    "https://generativelanguage.googleapis.com"
    "/v1beta/models/gemini-2.5-flash:generateContent"
    "?key={key}"
)
if _GEMINI_API_KEY:
    print("✅ Gemini REST API ready (gemini-2.5-flash / v1beta).")
else:
    print("⚠️  GEMINI_API_KEY not set. Personalization will return fallback questions.")

# --- AI SETUP ---
BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

current_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(current_dir, 'models', 'pose_landmarker_lite.task')

if not os.path.exists(model_path):
    print(f"❌ FATAL: Model not found at {model_path}")
    exit(1)

options = PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=model_path),
    running_mode=VisionRunningMode.VIDEO
)
detector = PoseLandmarker.create_from_options(options)
cap = cv2.VideoCapture(CAMERA_INDEX)

# Serve frontend file
static_files = {
    '/': '../frontend/index.html',
    '/assets': '../frontend/assets',
    '/game': '../frontend/game',
}

app = socketio.WSGIApp(sio, static_files=static_files)

# --- STATE VARIABLES ---
system_state = "CALIBRATING" # CALIBRATING -> ACTIVE
prev_y = 0
current_momentum = 0
last_step_time = 0
step_count = 0
calibration_frames = 0
calibration_noise_values = []
consecutive_steps = 0
is_walking_state = False
center_lock_active = False
BOUNCE_THRESHOLD = _DEFAULT_BOUNCE_THRESHOLD  # Will be overwritten after calibration

print("✅ SERVER RUNNING... (Waiting for Dashboard)")

@sio.event
def connect(sid, environ):
    print(f"✅ CLIENT CONNECTED: {sid}")

@sio.event
def disconnect(sid):
    print(f"❌ CLIENT DISCONNECTED: {sid}")

# --- IN-MEMORY PLAYER REGISTRY ---
_player_registry = {}  # { sid: { name, class, topic } }

_FALLBACK_QUESTIONS = [
    {"text": "What is 8 × 7?",                  "optA": "A) 54",   "optB": "B) 56",  "answer": "B"},
    {"text": "Which is a prime number?",          "optA": "A) 9",    "optB": "B) 11", "answer": "B"},
    {"text": "What is 144 ÷ 12?",                "optA": "A) 12",   "optB": "B) 13", "answer": "A"},
    {"text": "Square root of 81?",               "optA": "A) 9",    "optB": "B) 7",  "answer": "A"},
    {"text": "15% of 200 = ?",                   "optA": "A) 30",   "optB": "B) 25", "answer": "A"},
    {"text": "True or False: 2³ = 8",            "optA": "A) True",  "optB": "B) False", "answer": "A"},
    {"text": "How many sides has a hexagon?",     "optA": "A) 5",    "optB": "B) 6",  "answer": "B"},
    {"text": "0.5 × 0.5 = ?",                   "optA": "A) 0.25", "optB": "B) 0.5", "answer": "A"},
    {"text": "If f(x) = x² – 4, f(3) = ?",      "optA": "A) 5",    "optB": "B) 9",  "answer": "A"},
    {"text": "log₂(64) = ?",                     "optA": "A) 5",    "optB": "B) 6",  "answer": "B"},
]

def _generate_questions(topic: str) -> list:
    """
    Calls the Gemini REST API directly (v1beta / gemini-1.5-flash).
    Returns a list of 10 dicts: [{text, optA, optB, answer}, ...]
    Falls back to _FALLBACK_QUESTIONS if API key is missing or call fails.
    """
    if not _GEMINI_API_KEY:
        print("[LLM] No API key — using fallback questions.")
        return _FALLBACK_QUESTIONS

    prompt = (
        f'Generate exactly 10 trivia questions about the topic: "{topic}".\n'
        'Return ONLY a valid JSON array — no markdown, no explanation, no code fences.\n'
        'Each element must strictly follow this schema:\n'
        '[{"text": "Question text?", "optA": "A) Option one", "optB": "B) Option two", "answer": "A" or "B"}]\n'
        'Rules:\n'
        '- Exactly 10 elements.\n'
        '- "answer" must be exactly the string "A" or the string "B".\n'
        '- optA must start with "A) " and optB must start with "B) ".\n'
        '- The correct answer must be factually accurate.\n'
        '- Output raw JSON only.'
    )

    url = _GEMINI_URL.format(key=_GEMINI_API_KEY)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7}
    }

    resp = requests.post(url, json=payload, timeout=30)
    resp.raise_for_status()  # raises HTTPError on 4xx/5xx

    data = resp.json()
    raw = data["candidates"][0]["content"]["parts"][0]["text"].strip()

    # Strip markdown fences if the model adds them despite instructions
    raw = re.sub(r'^```(?:json)?\s*', '', raw, flags=re.IGNORECASE)
    raw = re.sub(r'\s*```$', '', raw)

    questions = json.loads(raw)

    if not isinstance(questions, list) or len(questions) != 10:
        raise ValueError(f"Expected 10 questions, got {len(questions) if isinstance(questions, list) else type(questions)}")

    required_keys = {"text", "optA", "optB", "answer"}
    for i, q in enumerate(questions):
        if not required_keys.issubset(q.keys()):
            raise ValueError(f"Question {i} missing keys: {required_keys - set(q.keys())}")
        if q["answer"] not in ("A", "B"):
            raise ValueError(f"Question {i} has invalid answer: {q['answer']!r}")

    return questions


@sio.event
def request_questions(sid, data):
    """
    Socket.IO event: 'request_questions'
    Payload: { name: str, classId: str, topic: str }
    Emits 'questions_ready' with 10-question array, or 'questions_error' on failure.
    """
    name    = str(data.get('name',    'Player')).strip()
    class_id= str(data.get('classId', 'Unknown')).strip()
    topic   = str(data.get('topic',   'General Knowledge')).strip()

    print(f"[LLM] [{sid}] Request — Player: '{name}' | Class: '{class_id}' | Topic: '{topic}'")

    # Store player info
    _player_registry[sid] = {'name': name, 'class': class_id, 'topic': topic}

    try:
        questions = _generate_questions(topic)
        print(f"[LLM] [{sid}] ✅ Sending {len(questions)} questions.")
        sio.emit('questions_ready', questions, to=sid)
    except Exception as e:
        print(f"[LLM] [{sid}] ❌ Generation failed: {e}")
        sio.emit('questions_error', {'message': str(e)}, to=sid)

# --- IMPORT MOTION LOGIC ---
from motion_logic.gesture_detection import calculate_arm_angle, calculate_wiper_angle

# ... (Removed local definitions) ...

def game_loop():
    global system_state, prev_y, current_momentum, last_step_time, step_count
    global calibration_frames, calibration_noise_values, consecutive_steps
    global is_walking_state, center_lock_active, BOUNCE_THRESHOLD

    while True:
        ret, frame = cap.read()
        if not ret: 
            eventlet.sleep(0.1)
            continue

        frame = cv2.flip(frame, 1)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        timestamp_ms = int(time.time() * 1000)
        
        detection_result = detector.detect_for_video(mp_image, timestamp_ms)

        # Default Values
        status_msg = "NO PLAYER"
        turn_signal = "CENTER"
        calib_progress = 0.0
        left_arm = 0
        right_arm = 0
        left_wave = 0
        right_wave = 0

        if detection_result.pose_landmarks:
            landmarks = detection_result.pose_landmarks[0]
            nose_x = landmarks[0].x

            # --- 1. PLAYER LOCK (Initial Check) ---
            # During calibration, strictly enforce center.
            # During game, allow leaning (wider zone).
            lock_limit_l = CENTER_LEFT_LIMIT if system_state == "CALIBRATING" else 0.1
            lock_limit_r = CENTER_RIGHT_LIMIT if system_state == "CALIBRATING" else 0.9

            if nose_x < lock_limit_l or nose_x > lock_limit_r:
                center_lock_active = False
                status_msg = "STEP CENTER"
            else:
                center_lock_active = True
                
                # Get Shoulders (for walking)
                shoulder_y = (landmarks[11].y + landmarks[12].y) / 2
                delta = abs(shoulder_y - prev_y)

                # --- 2. AUTO-CALIBRATION PHASE ---
                if system_state == "CALIBRATING":
                    calibration_frames += 1
                    calibration_noise_values.append(delta)
                    calib_progress = min(1.0, calibration_frames / CALIB_PROGRESS_FRAMES)
                    status_msg = "CALIBRATING"
                    
                    if calibration_frames > CALIB_FRAMES_NEEDED:
                        max_noise = max(calibration_noise_values)
                        BOUNCE_THRESHOLD = max(
                            CALIB_THRESHOLD_MIN,
                            min(CALIB_THRESHOLD_MAX, max_noise * CALIB_NOISE_MULTIPLIER)
                        )
                        system_state = "ACTIVE"
                        print(f"✅ CALIBRATED! Threshold: {BOUNCE_THRESHOLD:.5f}")
                
                # --- 3. ACTIVE GAME PHASE ---
                elif system_state == "ACTIVE":
                    status_msg = "IDLE"
                    
                    # A. WALK LOGIC
                    if delta > BOUNCE_THRESHOLD:
                        current_momentum += MOMENTUM_GAIN
                        is_moving_down = shoulder_y > prev_y
                        if is_moving_down and (time.time() - last_step_time > STEP_COOLDOWN):
                            step_count += 1
                            consecutive_steps += 1
                            last_step_time = time.time()
                            if consecutive_steps >= STARTUP_STEPS_REQUIRED:
                                is_walking_state = True
                    else:
                        current_momentum *= MOMENTUM_DECAY
                        if (time.time() - last_step_time) > STOP_TIMEOUT:
                            consecutive_steps = 0
                            is_walking_state = False
                    
                    # Clamp Momentum
                    current_momentum = max(0, min(1, current_momentum))
                    if is_walking_state: status_msg = "WALKING"

                    # B. TURN LOGIC (Leaning)
                    # Simple X-Axis check on Nose
                    if nose_x < TURN_LEFT_TRIGGER:
                        turn_signal = "LEFT"
                    elif nose_x > TURN_RIGHT_TRIGGER:
                        turn_signal = "RIGHT"
                    else:
                        turn_signal = "CENTER"

                    # C. ARM LOGIC (Shadow Man)
                    left_arm = calculate_arm_angle(landmarks[11], landmarks[15])
                    right_arm = calculate_arm_angle(landmarks[12], landmarks[16])

                    # Wave (Elbow -> Wrist Vector)
                    # Left: 13->15. Right: 14->16.
                    left_wave = calculate_wiper_angle(landmarks[13], landmarks[15])
                    right_wave = calculate_wiper_angle(landmarks[14], landmarks[16])
                
                prev_y = shoulder_y

        # --- BROADCAST ---
        sio.emit('telemetry', {
            'status': status_msg,
            'steps': step_count,
            'momentum': round(current_momentum, 2),
            'turn': turn_signal,     # <--- NEW: LEFT, RIGHT, or CENTER
            'l_arm': int(left_arm),
            'r_arm': int(right_arm),
            'l_wave': int(left_wave),
            'r_wave': int(right_wave),
            'calibration': round(calib_progress, 2)
        })
        
        eventlet.sleep(LOOP_SLEEP)

if __name__ == '__main__':
    eventlet.spawn(game_loop)
    eventlet.wsgi.server(eventlet.listen((SERVER_HOST, SERVER_PORT)), app)