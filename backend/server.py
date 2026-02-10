import eventlet
import socketio
import cv2
import mediapipe as mp
import time
import os
import sys
import json
from datetime import datetime

# =============================================================================
# CONFIG — Load from config.json, fall back to defaults
# =============================================================================
current_dir = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.join(current_dir, 'config.json')

DEFAULT_CONFIG = {
    "zone_offset": 0.15,
    "walk_threshold": 0.015,
    "walk_timeout": 0.25,
    "required_steps": 2,
    "camera_retry_interval": 5,
    "camera_max_retries": 10,
    "calibration_duration": 3.0,
    "smoothing_buffer_size": 5,
    "fps_target": 30
}

try:
    with open(config_path, 'r') as f:
        config = {**DEFAULT_CONFIG, **json.load(f)}
    print(f"✅ Config loaded from {os.path.basename(config_path)}")
except FileNotFoundError:
    config = DEFAULT_CONFIG
    print("⚠️ config.json not found, using defaults.")

# --- Extract config values ---
ZONE_OFFSET         = config["zone_offset"]
WALK_THRESHOLD      = config["walk_threshold"]
WALK_TIMEOUT        = config["walk_timeout"]
REQUIRED_STEPS      = config["required_steps"]
CAMERA_RETRY_INTERVAL = config["camera_retry_interval"]
CAMERA_MAX_RETRIES  = config["camera_max_retries"]
CALIBRATION_DURATION = config["calibration_duration"]
SMOOTHING_BUFFER_SIZE = config["smoothing_buffer_size"]
FPS_TARGET          = config["fps_target"]

# Dynamic zone limits (set during calibration)
ZONE_LEFT_LIMIT  = 0.40  # Fallback, overwritten by calibration
ZONE_RIGHT_LIMIT = 0.60

# =============================================================================
# SETUP — Socket.IO Server
# =============================================================================
sio = socketio.Server(cors_allowed_origins='*')
app = socketio.WSGIApp(sio)

# =============================================================================
# MEDIAPIPE — Pose Landmarker Setup
# =============================================================================
BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

model_path = os.path.join(current_dir, 'models', 'pose_landmarker_lite.task')

if not os.path.exists(model_path):
    print(f"❌ FATAL ERROR: Model not found at {model_path}")
    print("   Run setup script or ensure models/ folder exists.")
    sys.exit(1)

options = PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=model_path),
    running_mode=VisionRunningMode.VIDEO
)
detector = PoseLandmarker.create_from_options(options)

# =============================================================================
# GLOBAL STATE
# =============================================================================
cap = None

# Game state
state = "IDLE"
position = "CENTER"
prev_y = 0
last_step_time = time.time()
steps_counter = 0

# Delta compression — track last emitted values
prev_state_emit = None
prev_zone_emit = None

# Calibration state
is_calibrated = False
calibration_start_time = 0
calibration_samples = []

# Walk detection smoothing buffer
delta_y_buffer = []

# =============================================================================
# HELPERS
# =============================================================================

def log(msg):
    """Print a timestamped log message."""
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")


def init_camera():
    """Initialize or re-initialize the webcam. Returns True on success."""
    global cap
    try:
        if cap is not None:
            cap.release()
        cap = cv2.VideoCapture(0)
        if cap.isOpened():
            log("📷 Camera opened successfully.")
            return True
        else:
            log("⚠️ Camera could not be opened.")
            return False
    except Exception as e:
        log(f"⚠️ Camera init error: {e}")
        return False


def attempt_reconnect():
    """Try to reconnect to the camera with retries. Returns True on success."""
    log("🔌 Camera lost. Starting reconnection attempts...")
    sio.emit('game_update', {'state': 'CAMERA_ERROR', 'zone': 'CENTER'})

    for i in range(1, CAMERA_MAX_RETRIES + 1):
        log(f"   Attempt {i}/{CAMERA_MAX_RETRIES}...")
        eventlet.sleep(CAMERA_RETRY_INTERVAL)

        if init_camera():
            log("📷 Camera reconnected!")
            sio.emit('game_update', {'state': 'CAMERA_RECOVERED', 'zone': 'CENTER'})
            return True

    log("❌ Failed to reconnect after all retries. Giving up.")
    return False


def emit_if_changed(new_state, new_zone):
    """Only emit a game_update if state or zone actually changed (delta compression)."""
    global prev_state_emit, prev_zone_emit
    if new_state != prev_state_emit or new_zone != prev_zone_emit:
        sio.emit('game_update', {'state': new_state, 'zone': new_zone})
        prev_state_emit = new_state
        prev_zone_emit = new_zone


def smooth_delta(raw_delta):
    """Add raw_delta to the rolling buffer and return the smoothed average."""
    delta_y_buffer.append(raw_delta)
    if len(delta_y_buffer) > SMOOTHING_BUFFER_SIZE:
        delta_y_buffer.pop(0)
    return sum(delta_y_buffer) / len(delta_y_buffer)


def start_calibration():
    """Reset calibration state to begin a new calibration phase."""
    global is_calibrated, calibration_start_time, calibration_samples
    global prev_state_emit, prev_zone_emit
    is_calibrated = False
    calibration_start_time = time.time()
    calibration_samples = []
    prev_state_emit = None  # Force next emit
    prev_zone_emit = None
    log("🎯 Calibration started — stand in your neutral position for 3 seconds.")


# =============================================================================
# SOCKET EVENTS
# =============================================================================

@sio.on('recalibrate')
def on_recalibrate(sid, data=None):
    """Handle recalibration request from frontend."""
    log("🔄 Recalibration requested by client.")
    start_calibration()
    sio.emit('game_update', {'state': 'CALIBRATING', 'progress': 0})


# =============================================================================
# MAIN GAME LOOP
# =============================================================================

print(f"✅ SERVER READY (Model: {os.path.basename(model_path)})")
print(f"   Config: threshold={WALK_THRESHOLD}, timeout={WALK_TIMEOUT}, "
      f"steps={REQUIRED_STEPS}, zone_offset=±{ZONE_OFFSET}")
print("   Open http://localhost:5000 (or index.html) to play.")


def game_loop():
    global state, position, prev_y, last_step_time, steps_counter
    global is_calibrated, calibration_start_time, calibration_samples
    global ZONE_LEFT_LIMIT, ZONE_RIGHT_LIMIT
    global delta_y_buffer

    # --- Initial Camera Setup ---
    if not init_camera():
        if not attempt_reconnect():
            log("🛑 No camera available. Game loop exiting.")
            return

    log("📷 Camera feed active. Entering game loop...")

    # --- Start initial calibration ---
    start_calibration()

    consecutive_idle_frames = 0
    frame_sleep = 1.0 / FPS_TARGET  # e.g. 0.033s for 30 FPS

    while True:
        try:
            # --- Camera health check ---
            if cap is None or not cap.isOpened():
                if not attempt_reconnect():
                    break

            ret, frame = cap.read()
            if not ret:
                log("⚠️ Frame read failed.")
                if not attempt_reconnect():
                    break
                continue

            # --- Process Frame ---
            frame = cv2.flip(frame, 1)  # Mirror effect
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            timestamp_ms = int(time.time() * 1000)

            try:
                detection_result = detector.detect_for_video(mp_image, timestamp_ms)

                if detection_result.pose_landmarks:
                    landmarks = detection_result.pose_landmarks[0]

                    if len(landmarks) > 24:
                        # --- Hip midpoint ---
                        hip_x = (landmarks[23].x + landmarks[24].x) / 2

                        # =====================================================
                        # CALIBRATION PHASE
                        # =====================================================
                        if not is_calibrated:
                            calibration_samples.append(hip_x)
                            elapsed = time.time() - calibration_start_time
                            progress = min(int((elapsed / CALIBRATION_DURATION) * 100), 100)

                            sio.emit('game_update', {
                                'state': 'CALIBRATING',
                                'progress': progress
                            })

                            if elapsed >= CALIBRATION_DURATION:
                                if calibration_samples:
                                    neutral = sum(calibration_samples) / len(calibration_samples)
                                else:
                                    neutral = 0.5  # Fallback

                                ZONE_LEFT_LIMIT = neutral - ZONE_OFFSET
                                ZONE_RIGHT_LIMIT = neutral + ZONE_OFFSET
                                is_calibrated = True

                                log(f"✅ Calibration complete: center={neutral:.3f}")
                                log(f"   Zone limits: LEFT<{ZONE_LEFT_LIMIT:.3f}  |  RIGHT>{ZONE_RIGHT_LIMIT:.3f}")

                                sio.emit('game_update', {
                                    'state': 'CALIBRATED',
                                    'zone': 'CENTER'
                                })

                                # Reset game state for clean start
                                state = "IDLE"
                                steps_counter = 0
                                delta_y_buffer = []

                        # =====================================================
                        # NORMAL GAMEPLAY
                        # =====================================================
                        else:
                            # 1. ZONE CHECK
                            if hip_x < ZONE_LEFT_LIMIT:
                                position = "LEFT"
                            elif hip_x > ZONE_RIGHT_LIMIT:
                                position = "RIGHT"
                            else:
                                position = "CENTER"

                            # 2. RHYTHM CHECK (Shoulders: 11, 12)
                            shoulder_y = (landmarks[11].y + landmarks[12].y) / 2
                            raw_delta_y = abs(shoulder_y - prev_y)
                            curr_time = time.time()

                            # Smoothed delta (rolling average)
                            smoothed_delta = smooth_delta(raw_delta_y)

                            # NOISE GATE — only count if above threshold
                            if smoothed_delta > WALK_THRESHOLD:
                                consecutive_idle_frames = 0

                                if (curr_time - last_step_time) > 0.15:
                                    last_step_time = curr_time
                                    steps_counter += 1

                                    if steps_counter >= REQUIRED_STEPS:
                                        state = "WALKING"
                            else:
                                consecutive_idle_frames += 1

                            # HARD STOP — force idle after silence
                            if (consecutive_idle_frames > 5 or
                                    (curr_time - last_step_time) > WALK_TIMEOUT):
                                state = "IDLE"
                                steps_counter = 0

                            prev_y = shoulder_y

                            # 3. EMIT (delta compressed)
                            emit_if_changed(state, position)

            except Exception as mp_err:
                log(f"⚠️ MediaPipe error: {mp_err}")

        except Exception as e:
            log(f"⚠️ Frame loop error: {e}")
            eventlet.sleep(1)  # Cooldown to prevent tight spin

        # Yield to eventlet for I/O
        eventlet.sleep(frame_sleep)


# =============================================================================
# ENTRY POINT
# =============================================================================
if __name__ == '__main__':
    eventlet.spawn(game_loop)
    eventlet.wsgi.server(eventlet.listen(('', 5000)), app)