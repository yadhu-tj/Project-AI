import cv2
import mediapipe as mp
import time
import numpy as np

# =============================================================================
# ARM SWING TEST — Visual Debug Version
# =============================================================================
# This script tests arm swing detection with visual feedback (green dots).
# No Socket.IO, no game logic — just pure detection + visualization.
# =============================================================================

# --- MEDIAPIPE SETUP ---
BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# Load the model
import os
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

# --- CAMERA SETUP ---
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("❌ Camera not available")
    exit(1)

print("✅ Camera opened. Starting arm swing detection test...")
print("=" * 60)
print("INSTRUCTIONS:")
print("1. Stand back so shoulders and hips are visible")
print("2. Calibration: Stand still for 3 seconds")
print("3. After calibration: Walk in place, swinging your arms")
print("4. Watch for GREEN DOTS on your wrists when swing detected")
print("5. Press 'Q' to quit")
print("=" * 60)

# =============================================================================
# CONFIGURATION
# =============================================================================
ARM_SWING_THRESHOLD = 0.3       # Ratio of shoulder width (tune 0.2-0.4)
MIN_SWING_VELOCITY = 0.3        # Units per second (tune 0.2-0.5)
MIN_STEP_INTERVAL = 0.3         # Seconds between steps
HIP_RISE_THRESHOLD = 0.02       # Hip validation threshold

# =============================================================================
# STATE VARIABLES
# =============================================================================
# Calibration
is_calibrated = False
calibration_start_time = None
calibration_samples = {
    'left_wrist_x': [], 'left_wrist_y': [],
    'right_wrist_x': [], 'right_wrist_y': [],
    'left_shoulder_x': [], 'left_shoulder_y': [],
    'right_shoulder_x': [], 'right_shoulder_y': [],
    'hip_y': []
}

# Calibrated baselines
neutral = {
    'left_wrist_x': 0, 'left_wrist_y': 0,
    'right_wrist_x': 0, 'right_wrist_y': 0,
    'shoulder_width': 0.2,
    'hip_y': 0.5
}

# Arm swing state machines
left_arm_state = "NEUTRAL"   # NEUTRAL, SWINGING_FORWARD, SWINGING_BACK
right_arm_state = "NEUTRAL"

# Previous frame data (for velocity)
prev_left_wrist_x = None
prev_right_wrist_x = None
prev_time = time.time()

# Step tracking
last_step_side = None
last_step_time = 0
step_count = 0

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def calculate_velocity(current, previous, delta_time):
    """Calculate velocity (change per second)."""
    if previous is None or delta_time == 0:
        return 0
    return (current - previous) / delta_time


def detect_arm_swing(wrist_x, shoulder_x, shoulder_width, prev_wrist_x, 
                     delta_time, arm_state, arm_name):
    """
    Detect arm swing using normalized position and velocity.
    Returns: (new_state, swing_completed)
    """
    # Normalize wrist position relative to shoulder and body size
    wrist_offset = wrist_x - shoulder_x
    swing_ratio = wrist_offset / shoulder_width if shoulder_width > 0 else 0
    
    # Calculate velocity
    velocity = calculate_velocity(wrist_x, prev_wrist_x, delta_time)
    
    new_state = arm_state
    swing_completed = False
    
    # State machine
    if arm_state == "NEUTRAL":
        # Check if swinging forward (wrist moving left, in front of shoulder)
        if swing_ratio < -ARM_SWING_THRESHOLD and velocity < -MIN_SWING_VELOCITY:
            new_state = "SWINGING_FORWARD"
            print(f"   [{arm_name}] → SWINGING_FORWARD (ratio={swing_ratio:.2f}, vel={velocity:.2f})")
    
    elif arm_state == "SWINGING_FORWARD":
        # Check if starting to swing back (crossed neutral position)
        if swing_ratio > 0:
            new_state = "SWINGING_BACK"
            swing_completed = True
            print(f"   [{arm_name}] → SWING COMPLETE! (ratio={swing_ratio:.2f})")
    
    elif arm_state == "SWINGING_BACK":
        # Check if returned to neutral
        if abs(swing_ratio) < 0.1:
            new_state = "NEUTRAL"
            print(f"   [{arm_name}] → NEUTRAL (ready for next swing)")
    
    return new_state, swing_completed


def validate_step(foot_side, current_time, hip_y, baseline_hip_y):
    """
    Validate if a step should be counted.
    Checks: alternation, timing, optional hip validation.
    """
    global last_step_side, last_step_time, step_count
    
    # Check alternation
    if last_step_side == foot_side:
        print(f"   ❌ REJECTED: Can't step {foot_side} twice in a row")
        return False
    
    # Check timing
    if (current_time - last_step_time) < MIN_STEP_INTERVAL:
        print(f"   ❌ REJECTED: Too fast (wait {MIN_STEP_INTERVAL}s between steps)")
        return False
    
    # Optional: Hip validation (if hips visible)
    if hip_y is not None and baseline_hip_y is not None:
        hip_rise = baseline_hip_y - hip_y  # Y is inverted (lower value = higher position)
        if hip_rise < HIP_RISE_THRESHOLD:
            print(f"   ⚠️  WARNING: Hips didn't rise enough (rise={hip_rise:.3f}). Still counting...")
            # Don't reject, just warn
    
    # VALID STEP
    last_step_side = foot_side
    last_step_time = current_time
    step_count += 1
    print(f"   ✅ STEP #{step_count} — {foot_side} FOOT")
    return True


# =============================================================================
# MAIN LOOP
# =============================================================================

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    
    # Mirror and convert
    frame = cv2.flip(frame, 1)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    
    # Detect pose
    timestamp_ms = int(time.time() * 1000)
    detection_result = detector.detect_for_video(mp_image, timestamp_ms)
    
    h, w, _ = frame.shape
    current_time = time.time()
    delta_time = current_time - prev_time
    prev_time = current_time
    
    # --- CALIBRATION PHASE ---
    if not is_calibrated:
        if calibration_start_time is None:
            calibration_start_time = current_time
        
        elapsed = current_time - calibration_start_time
        progress = min(int((elapsed / 3.0) * 100), 100)
        
        # Display calibration status
        cv2.rectangle(frame, (0, 0), (w, 100), (0, 0, 0), -1)
        cv2.putText(frame, f"CALIBRATING... {progress}%", (20, 50), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 255), 3)
        cv2.putText(frame, "Stand still with arms at sides", (20, 85), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # Collect samples
        if detection_result.pose_landmarks:
            landmarks = detection_result.pose_landmarks[0]
            if len(landmarks) > 24:
                calibration_samples['left_wrist_x'].append(landmarks[15].x)
                calibration_samples['left_wrist_y'].append(landmarks[15].y)
                calibration_samples['right_wrist_x'].append(landmarks[16].x)
                calibration_samples['right_wrist_y'].append(landmarks[16].y)
                calibration_samples['left_shoulder_x'].append(landmarks[11].x)
                calibration_samples['left_shoulder_y'].append(landmarks[11].y)
                calibration_samples['right_shoulder_x'].append(landmarks[12].x)
                calibration_samples['right_shoulder_y'].append(landmarks[12].y)
                calibration_samples['hip_y'].append((landmarks[23].y + landmarks[24].y) / 2)
        
        # Complete calibration
        if elapsed >= 3.0:
            # Calculate averages
            neutral['left_wrist_x'] = np.mean(calibration_samples['left_wrist_x'])
            neutral['left_wrist_y'] = np.mean(calibration_samples['left_wrist_y'])
            neutral['right_wrist_x'] = np.mean(calibration_samples['right_wrist_x'])
            neutral['right_wrist_y'] = np.mean(calibration_samples['right_wrist_y'])
            
            left_shoulder_x = np.mean(calibration_samples['left_shoulder_x'])
            right_shoulder_x = np.mean(calibration_samples['right_shoulder_x'])
            neutral['shoulder_width'] = abs(right_shoulder_x - left_shoulder_x)
            neutral['hip_y'] = np.mean(calibration_samples['hip_y'])
            
            is_calibrated = True
            print("\n✅ CALIBRATION COMPLETE!")
            print(f"   Shoulder width: {neutral['shoulder_width']:.3f}")
            print(f"   Left wrist neutral: ({neutral['left_wrist_x']:.3f}, {neutral['left_wrist_y']:.3f})")
            print(f"   Right wrist neutral: ({neutral['right_wrist_x']:.3f}, {neutral['right_wrist_y']:.3f})")
            print(f"   Hip baseline: {neutral['hip_y']:.3f}")
            print("\n🏃 START WALKING IN PLACE! Swing your arms naturally.\n")
    
    # --- GAMEPLAY PHASE ---
    else:
        if detection_result.pose_landmarks:
            landmarks = detection_result.pose_landmarks[0]
            
            if len(landmarks) > 24:
                # Extract landmarks
                left_wrist = landmarks[15]
                right_wrist = landmarks[16]
                left_shoulder = landmarks[11]
                right_shoulder = landmarks[12]
                left_hip = landmarks[23]
                right_hip = landmarks[24]
                
                # Current positions
                left_wrist_x = left_wrist.x
                right_wrist_x = right_wrist.x
                left_shoulder_x = left_shoulder.x
                right_shoulder_x = right_shoulder.x
                hip_y = (left_hip.y + right_hip.y) / 2
                
                # Shoulder width (for normalization)
                shoulder_width = abs(right_shoulder_x - left_shoulder_x)
                
                # --- LEFT ARM SWING DETECTION ---
                left_arm_state, left_swing_complete = detect_arm_swing(
                    left_wrist_x, left_shoulder_x, shoulder_width,
                    prev_left_wrist_x, delta_time, left_arm_state, "LEFT ARM"
                )
                
                # --- RIGHT ARM SWING DETECTION ---
                right_arm_state, right_swing_complete = detect_arm_swing(
                    right_wrist_x, right_shoulder_x, shoulder_width,
                    prev_right_wrist_x, delta_time, right_arm_state, "RIGHT ARM"
                )
                
                # --- STEP VALIDATION ---
                if left_swing_complete:
                    # Left arm forward = Right foot step
                    if validate_step("RIGHT", current_time, hip_y, neutral['hip_y']):
                        # Visual feedback: GREEN DOT on left wrist (the arm that swung)
                        cv2.circle(frame, (int(left_wrist_x * w), int(left_wrist.y * h)), 
                                   30, (0, 255, 0), -1)
                
                if right_swing_complete:
                    # Right arm forward = Left foot step
                    if validate_step("LEFT", current_time, hip_y, neutral['hip_y']):
                        # Visual feedback: GREEN DOT on right wrist
                        cv2.circle(frame, (int(right_wrist_x * w), int(right_wrist.y * h)), 
                                   30, (0, 255, 0), -1)
                
                # Update previous positions
                prev_left_wrist_x = left_wrist_x
                prev_right_wrist_x = right_wrist_x
                
                # --- VISUAL DEBUG OVERLAY ---
                # Draw skeleton
                for landmark in landmarks:
                    cx, cy = int(landmark.x * w), int(landmark.y * h)
                    cv2.circle(frame, (cx, cy), 3, (255, 255, 255), -1)
                
                # Draw wrists with color based on state
                left_wrist_color = (0, 255, 0) if left_arm_state == "SWINGING_FORWARD" else (255, 255, 255)
                right_wrist_color = (0, 255, 0) if right_arm_state == "SWINGING_FORWARD" else (255, 255, 255)
                
                cv2.circle(frame, (int(left_wrist_x * w), int(left_wrist.y * h)), 
                           10, left_wrist_color, -1)
                cv2.circle(frame, (int(right_wrist_x * w), int(right_wrist.y * h)), 
                           10, right_wrist_color, -1)
                
                # HUD
                cv2.rectangle(frame, (0, 0), (w, 120), (0, 0, 0), -1)
                cv2.putText(frame, f"STEPS: {step_count}", (20, 40), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3)
                cv2.putText(frame, f"L ARM: {left_arm_state}", (20, 75), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, left_wrist_color, 2)
                cv2.putText(frame, f"R ARM: {right_arm_state}", (20, 105), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, right_wrist_color, 2)
                
                # Last step indicator
                if last_step_side:
                    cv2.putText(frame, f"LAST: {last_step_side}", (w - 250, 40), 
                                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 0), 3)
    
    # Show frame
    cv2.imshow('ARM SWING TEST — Green Dots = Step Detected', frame)
    
    # Quit on 'Q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Cleanup
cap.release()
cv2.destroyAllWindows()
print(f"\n📊 SESSION COMPLETE — Total steps: {step_count}")