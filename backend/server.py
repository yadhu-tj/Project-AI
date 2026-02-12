import eventlet
import socketio
import cv2
import mediapipe as mp
import time
import os
import math
import numpy as np

# --- 0. SERVER SETUP ---
sio = socketio.Server(cors_allowed_origins='*')

# Serve frontend files
static_files = {
    '/': '../frontend/index.html',
    '/assets': '../frontend/assets',
}

app = socketio.WSGIApp(sio, static_files=static_files)

# ==========================================
# ⚙️ LOGIC CONFIGURATION
# ==========================================

# 1. PLAYER LOCK (Center Zone for Calibration)
CENTER_LEFT_LIMIT = 0.3
CENTER_RIGHT_LIMIT = 0.7

# 2. TURNING ZONES (Leaning)
# If nose goes past these points, we trigger a turn
TURN_LEFT_TRIGGER = 0.4
TURN_RIGHT_TRIGGER = 0.6

# 3. HYSTERESIS (Anti-Flicker)
STARTUP_STEPS_REQUIRED = 3
STOP_TIMEOUT = 0.5

# 4. PHYSICS (Will be auto-calibrated)
BOUNCE_THRESHOLD = 0.003  # Default fallback
STEP_COOLDOWN = 0.3       # Rhythm speed limit
MOMENTUM_DECAY = 0.92     # Coasting friction

# ==========================================

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
cap = cv2.VideoCapture(0)

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

print("✅ SERVER RUNNING... (Waiting for Dashboard)")

def calculate_arm_angle(shoulder, wrist):
    """Calculates relative arm lift (0 = Down, 180 = Up)"""
    # Adjusted for full range (Hands Down to Hands Up)
    # Offset 0.4 maps ~T-pose (diff=0) to ~90 deg
    # Multiplier 240 ensures reaching 180 deg (Hands Above Head) is easy
    lift = (shoulder.y - wrist.y) + 0.4
    final_angle = max(0, min(180, lift * 240))
    return int(final_angle)

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
                    calib_progress = min(1.0, calibration_frames / 60)
                    status_msg = "CALIBRATING"
                    
                    if calibration_frames > 60:
                        max_noise = max(calibration_noise_values)
                        BOUNCE_THRESHOLD = max(0.0015, min(0.01, max_noise * 1.5))
                        system_state = "ACTIVE"
                        print(f"✅ CALIBRATED! Threshold: {BOUNCE_THRESHOLD:.5f}")
                
                # --- 3. ACTIVE GAME PHASE ---
                elif system_state == "ACTIVE":
                    status_msg = "IDLE"
                    
                    # A. WALK LOGIC
                    if delta > BOUNCE_THRESHOLD:
                        current_momentum += 0.15 
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
                
                prev_y = shoulder_y

        # --- BROADCAST ---
        sio.emit('telemetry', {
            'status': status_msg,
            'steps': step_count,
            'momentum': round(current_momentum, 2),
            'turn': turn_signal,     # <--- NEW: LEFT, RIGHT, or CENTER
            'l_arm': int(left_arm),
            'r_arm': int(right_arm),
            'calibration': round(calib_progress, 2)
        })
        
        eventlet.sleep(0.03)

if __name__ == '__main__':
    eventlet.spawn(game_loop)
    eventlet.wsgi.server(eventlet.listen(('', 5000)), app)