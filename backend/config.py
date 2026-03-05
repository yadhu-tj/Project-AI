# =============================================================================
#  config.py  —  Central configuration for all game + motion constants
#
#  EDITING GUIDE
#  ─────────────
#  All tunable values live here.  server.py and gesture_detection.py import
#  from this file — changing a value here instantly affects the whole backend.
#  DO NOT place new magic numbers directly in source files.
# =============================================================================


# ─── 1. PLAYER LOCK  (Center-zone enforcement during calibration) ─────────────
# Nose X must stay between these limits while calibrating.
# After calibration the server widens the zone to 0.1 / 0.9 (hard-coded in
# the STEP CENTER check) so the player can lean freely.
CENTER_LEFT_LIMIT   = 0.3   # Below this → "STEP CENTER"
CENTER_RIGHT_LIMIT  = 0.7   # Above this → "STEP CENTER"


# ─── 2. TURN TRIGGERS  (Nose X leaning thresholds) ───────────────────────────
# Must satisfy: CENTER_LEFT_LIMIT < TURN_LEFT_TRIGGER
#               TURN_RIGHT_TRIGGER < CENTER_RIGHT_LIMIT  (conceptually)
TURN_LEFT_TRIGGER   = 0.4   # Nose left of this  → emit turn = "LEFT"
TURN_RIGHT_TRIGGER  = 0.6   # Nose right of this → emit turn = "RIGHT"


# ─── 3. HYSTERESIS  (Anti-flicker / startup smoothing) ───────────────────────
STARTUP_STEPS_REQUIRED = 3    # Consecutive detections before walk state starts
STOP_TIMEOUT           = 0.5  # Seconds of no bounce before walk state resets


# ─── 4. PHYSICS  (Walking momentum — auto-calibrated at runtime) ──────────────
# BOUNCE_THRESHOLD is overwritten after calibration; this is the fallback.
BOUNCE_THRESHOLD   = 0.003  # Shoulder delta to count as a bounce (default)
STEP_COOLDOWN      = 0.3    # Minimum seconds between counted steps
MOMENTUM_GAIN      = 0.15   # How much momentum each bounce adds
MOMENTUM_DECAY     = 0.92   # Multiplicative friction when not bouncing

# Auto-calibration clamps for the computed BOUNCE_THRESHOLD
CALIB_FRAMES_NEEDED     = 60     # Number of frames to sample noise
CALIB_NOISE_MULTIPLIER  = 1.5    # Scale factor applied to max observed noise
CALIB_THRESHOLD_MIN     = 0.0015 # Hard floor for calibrated threshold
CALIB_THRESHOLD_MAX     = 0.01   # Hard ceiling for calibrated threshold


# ─── 5. ARM DETECTION  (Gesture / answer selection) ──────────────────────────
# Used inside gesture_detection.calculate_arm_angle()
ARM_LIFT_OFFSET       = 0.4    # Shifts T-pose (diff ≈ 0) to ~90 °
ARM_DEADZONE          = 0.30   # lift_raw below this → angle reported as 0
ARM_ANGLE_MULTIPLIER  = 240    # Scales the normalised lift to degrees (0-180)


# ─── 6. SERVER / CAMERA ───────────────────────────────────────────────────────
SERVER_HOST        = ''       # Bind to all interfaces
SERVER_PORT        = 5000
CAMERA_INDEX       = 0        # OpenCV VideoCapture index (0 = default webcam)
LOOP_SLEEP         = 0.03     # Seconds between game-loop ticks (~33 fps cap)
CALIB_PROGRESS_FRAMES = 60   # Denominator for calib progress 0.0 → 1.0


# ─── 7. DEVELOPER MODE ────────────────────────────────────────────────────────
# Set DEV_SKIP_AI_QUESTIONS = True  to bypass the Gemini API entirely.
# The backend will return a set of hardcoded fallback questions instead.
# This avoids burning API quota during development / testing.
#
# ✅ To go back to live AI questions:  set DEV_SKIP_AI_QUESTIONS = False
DEV_SKIP_AI_QUESTIONS = False
