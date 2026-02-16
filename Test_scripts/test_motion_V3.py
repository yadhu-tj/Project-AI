import cv2
import mediapipe as mp
import time
import numpy as np
from collections import deque
import os

# =============================================================================
# UPPER BODY STEP TRACKER — SUBJECT LOCK VERSION
# =============================================================================

# ---------------- MEDIAPIPE SETUP ----------------
BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

current_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(current_dir, 'models', 'pose_landmarker_lite.task')

if not os.path.exists(model_path):
    print("Model not found.")
    exit(1)

options = PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=model_path),
    running_mode=VisionRunningMode.VIDEO
)
detector = PoseLandmarker.create_from_options(options)

# ---------------- CAMERA ----------------
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

if not cap.isOpened():
    print("Camera not available")
    exit(1)

# =============================================================================
# CONFIGURATION
# =============================================================================

ARM_SWING_THRESHOLD = 0.18
MIN_STEP_INTERVAL = 0.25
SMOOTHING = 0.85
MIN_CONFIDENCE = 0.6

LOCK_POSITION_TOLERANCE = 0.15
LOCK_SCALE_TOLERANCE = 0.25
LOCK_GRACE_TIME = 0.5

# =============================================================================
# STATE VARIABLES
# =============================================================================

is_calibrated = False
calibration_start = None

neutral = {
    "center_x": 0,
    "center_y": 0,
    "shoulder_width": 0,
}

last_step_time = 0
step_count = 0
last_locked_time = time.time()

left_wrist_history = deque(maxlen=15)
right_wrist_history = deque(maxlen=15)

smoothed_left_x = 0.5
smoothed_right_x = 0.5

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def subject_locked(landmarks):
    """Check if subject matches calibrated position."""
    left_shoulder = landmarks[11]
    right_shoulder = landmarks[12]

    center_x = (left_shoulder.x + right_shoulder.x) / 2
    shoulder_width = abs(right_shoulder.x - left_shoulder.x)

    pos_diff = abs(center_x - neutral["center_x"])
    scale_diff = abs(shoulder_width - neutral["shoulder_width"]) / neutral["shoulder_width"]

    if pos_diff > LOCK_POSITION_TOLERANCE:
        return False
    if scale_diff > LOCK_SCALE_TOLERANCE:
        return False

    return True


def detect_step():
    """Detect step from arm swing oscillation."""
    if len(left_wrist_history) < 6:
        return False

    left = list(left_wrist_history)
    right = list(right_wrist_history)

    # detect simple peak
    if left[-2] < left[-3] and left[-2] < left[-1]:
        return True
    if right[-2] > right[-3] and right[-2] > right[-1]:
        return True

    return False


# =============================================================================
# MAIN LOOP
# =============================================================================

print("Upper Body Step Tracker Started. Press Q to quit.")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

    timestamp = int(time.time() * 1000)
    result = detector.detect_for_video(mp_image, timestamp)

    h, w, _ = frame.shape
    current_time = time.time()

    # ---------------- CALIBRATION ----------------
    if not is_calibrated:
        if calibration_start is None:
            calibration_start = current_time

        elapsed = current_time - calibration_start
        progress = min(int((elapsed / 3.0) * 100), 100)

        cv2.rectangle(frame, (0, 0), (w, 100), (0, 0, 0), -1)
        cv2.putText(frame, f"CALIBRATING {progress}%", (20, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 255), 3)

        if result.pose_landmarks:
            landmarks = result.pose_landmarks[0]

            if len(landmarks) > 12:
                left_shoulder = landmarks[11]
                right_shoulder = landmarks[12]

                center_x = (left_shoulder.x + right_shoulder.x) / 2
                shoulder_width = abs(right_shoulder.x - left_shoulder.x)

                neutral["center_x"] = center_x
                neutral["center_y"] = (left_shoulder.y + right_shoulder.y) / 2
                neutral["shoulder_width"] = shoulder_width

        if elapsed >= 3.0:
            is_calibrated = True
            print("Calibration complete. Start walking.")

    # ---------------- GAMEPLAY ----------------
    else:
        if result.pose_landmarks:
            landmarks = result.pose_landmarks[0]

            if len(landmarks) > 16:

                # ---- SUBJECT LOCK ----
                if subject_locked(landmarks):
                    last_locked_time = current_time
                else:
                    if current_time - last_locked_time > LOCK_GRACE_TIME:
                        cv2.putText(frame, "SUBJECT LOST", (20, 80),
                                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3)
                        cv2.imshow("Step Tracker", frame)
                        if cv2.waitKey(1) & 0xFF == ord('q'):
                            break
                        continue

                left_wrist = landmarks[15]
                right_wrist = landmarks[16]
                left_shoulder = landmarks[11]
                right_shoulder = landmarks[12]

                if (
                    left_wrist.visibility > MIN_CONFIDENCE and
                    right_wrist.visibility > MIN_CONFIDENCE
                ):
                    # smoothing
                    smoothed_left_x = (
                        SMOOTHING * smoothed_left_x +
                        (1 - SMOOTHING) * left_wrist.x
                    )
                    smoothed_right_x = (
                        SMOOTHING * smoothed_right_x +
                        (1 - SMOOTHING) * right_wrist.x
                    )

                    left_wrist_history.append(smoothed_left_x)
                    right_wrist_history.append(smoothed_right_x)

                    # step detection
                    if detect_step():
                        if current_time - last_step_time > MIN_STEP_INTERVAL:
                            step_count += 1
                            last_step_time = current_time

                # ---- DRAW DEBUG ----
                for lm in [left_wrist, right_wrist, left_shoulder, right_shoulder]:
                    cx, cy = int(lm.x * w), int(lm.y * h)
                    cv2.circle(frame, (cx, cy), 6, (255, 255, 255), -1)

                # draw subject lock box
                lock_center_x = int(neutral["center_x"] * w)
                lock_center_y = int(neutral["center_y"] * h)
                box_w = int(neutral["shoulder_width"] * w * 2)
                box_h = int(box_w * 1.5)

                x1 = lock_center_x - box_w // 2
                y1 = lock_center_y - box_h // 2
                x2 = lock_center_x + box_w // 2
                y2 = lock_center_y + box_h // 2

                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 255), 2)

    # ---------------- HUD ----------------
    cv2.rectangle(frame, (0, 0), (w, 80), (0, 0, 0), -1)
    cv2.putText(frame, f"STEPS: {step_count}", (20, 55),
                cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0, 255, 0), 3)

    cv2.imshow("Step Tracker", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print(f"Session complete. Total steps: {step_count}")
