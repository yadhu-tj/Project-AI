import cv2
import mediapipe as mp
import time
import numpy as np

# --- ⚙️ TUNING VARIABLES (Adjust these to fit you) ---
# 1. SENSITIVITY: Lower = Easier to walk. Higher = Harder.
# 0.002 is very sensitive (good for casual walking).
BOUNCE_THRESHOLD = 0.002 

# 2. COOLDOWN: Time (seconds) between steps to prevent double-counting.
# 0.3s is roughly 2 steps per second (Normal walking pace).
STEP_COOLDOWN = 0.3

# 3. MOMENTUM: How fast the "movement" fades when you stop.
# 0.95 = Slow fade (Smooth). 0.5 = Instant stop (Jerky).
MOMENTUM_DECAY = 0.95

import os

# --- SETUP ---
BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# Load the model
current_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(current_dir, 'models', 'pose_landmarker_lite.task')

if not os.path.exists(model_path):
    print(f"❌ Model not found at {model_path}")
    exit(1)

options = PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=model_path),
    running_mode=VisionRunningMode.VIDEO
)
detector = PoseLandmarker.create_from_options(options)

cap = cv2.VideoCapture(0)

# State Variables
prev_y = 0               # Last frame's shoulder position
step_count = 0           # Total steps
last_step_time = 0       # Timestamp of last step
current_momentum = 0     # 0.0 to 1.0 (Visualizes speed)
is_moving = False

print("--- UPPER BODY WALK TEST ---")
print("1. Stand so your SHOULDERS are visible.")
print("2. Walk in place comfortably.")
print("3. Watch the Green Bar (Momentum).")

while cap.isOpened():
    ret, frame = cap.read()
    if not ret: break

    # 1. Prepare Frame
    frame = cv2.flip(frame, 1)
    h, w, c = frame.shape
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    
    # 2. Process AI
    timestamp_ms = int(time.time() * 1000)
    detection_result = detector.detect_for_video(mp_image, timestamp_ms)

    if detection_result.pose_landmarks:
        landmarks = detection_result.pose_landmarks[0]
        
        # --- THE CORE LOGIC & DEBUGGING ---
        
        # Get Average Y of Shoulders (Left=11, Right=12)
        # We focus on Shoulders because Head moves too much (looking around).
        shoulder_y = (landmarks[11].y + landmarks[12].y) / 2
        
        # Calculate the "Bob" (Distance moved since last frame)
        # We use absolute value because Up and Down both count as "movement energy"
        delta = abs(shoulder_y - prev_y)
        
        # DEBUG: Raw Position Data
        # print(f"[RAW] Shoulder Y: {shoulder_y:.5f} | Delta: {delta:.5f} | Threshold: {BOUNCE_THRESHOLD}")

        # Update Momentum (The "Flywheel" Effect)
        # If we detect movement, boost momentum. If not, decay it.
        # This simulates a physical object gathering speed.
        if delta > BOUNCE_THRESHOLD:
            current_momentum += 0.1 # Add energy
            print(f"⚡ MOTION DETECTED | Delta: {delta:.5f} > {BOUNCE_THRESHOLD} | Momentum Rising: {current_momentum:.2f}")
            
            # --- STEP COUNTING ---
            # Only count if we are moving Downward (Gravity) + Cooldown is over
            # We look for the "dip" in the walk cycle.
            is_downward_motion = shoulder_y > prev_y
            time_since_last_step = time.time() - last_step_time
            
            if is_downward_motion and (time_since_last_step > STEP_COOLDOWN):
                step_count += 1
                last_step_time = time.time()
                print(f"✅ STEP CONFIRMED! | Total: {step_count} | Time Delta: {time_since_last_step:.2f}s")
            elif not is_downward_motion:
                print(f"   ℹ️ Ignored: Upward Motion")
            elif time_since_last_step <= STEP_COOLDOWN:
                print(f"   ⏳ Ignored: Cooldown Active ({time_since_last_step:.2f}s < {STEP_COOLDOWN}s)")
                
        else:
            old_momentum = current_momentum
            current_momentum *= MOMENTUM_DECAY # Fade out energy
            if old_momentum > 0.01: # Only log decay if we had significant momentum
                print(f"📉 DECELERATING | Momentum detected: {old_momentum:.2f} -> {current_momentum:.2f}")

        # Clamp Momentum (Keep it between 0 and 1)
        current_momentum = max(0, min(1, current_momentum))
        
        # Determine State
        was_moving = is_moving
        is_moving = current_momentum > 0.1
        
        if is_moving and not was_moving:
            print("🚀 STATE CHANGE: IDLE -> MOVING")
        elif not is_moving and was_moving:
            print("🛑 STATE CHANGE: MOVING -> IDLE")
        
        # Save position for next frame
        prev_y = shoulder_y

        # --- VISUALS (The HUD) ---
        
        # Draw Shoulder Line (Visual Feedback)
        sy_pixel = int(shoulder_y * h)
        cv2.line(frame, (0, sy_pixel), (w, sy_pixel), (0, 255, 255), 1)
        
        # 1. State Text
        if is_moving:
            status_text = "MOVING"
            status_color = (0, 255, 0) # Green
        else:
            status_text = "IDLE"
            status_color = (0, 0, 255) # Red
            
        cv2.putText(frame, f"STATUS: {status_text}", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, status_color, 2)
        
        # 2. Step Counter
        cv2.putText(frame, f"STEPS: {step_count}", (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 0), 2)
        
        # 3. Momentum Bar (Smoothness Visualizer)
        bar_width = int(current_momentum * 300)
        cv2.rectangle(frame, (50, 200), (50 + bar_width, 230), (0, 255, 0), -1)
        cv2.rectangle(frame, (50, 200), (350, 230), (255, 255, 255), 2)
        cv2.putText(frame, "MOMENTUM", (50, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    cv2.imshow('Walk Test (Upper Body)', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'): break

cap.release()
cv2.destroyAllWindows()