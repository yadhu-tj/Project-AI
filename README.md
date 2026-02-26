# Motion Link

**Motion Link** is a real-time, full-body gesture-controlled 3D speedrun game. Players physically walk in place and lean their body to navigate through a procedurally generated neon maze, answering quiz questions at blast doors to progress through three levels against a live race timer — no keyboard, no controller, just movement.

---

## Table of Contents

- [How It Works](#how-it-works)
- [System Architecture](#system-architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Controls Reference](#controls-reference)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## How It Works

```
Webcam Feed
    │
    ▼
Python Backend  (MediaPipe Pose + OpenCV)
    │   Detects: walking bounce, lean direction, arm raises
    │   Emits telemetry via Socket.IO @ localhost:5000
    ▼
Browser Frontend  (Three.js + vanilla JS)
    │   Receives telemetry → drives character, maze, quiz
    │   Renders: procedural neon corridor, T-junctions, blast doors
    ▼
Player Experience
    Walk in place → move forward
    Lean left/right → turn at T-junction
    Raise right arm → Quiz Option A
    Raise left arm  → Quiz Option B
```

**Gameplay loop:**
1. System calibrates to the player's natural body noise (~2 seconds).
2. A 3 → 2 → 1 → **GO!** countdown fires and the race clock starts.
3. Player walks forward through a neon corridor toward a **T-junction**.
4. Player raises either hand to acknowledge the turn instructions, then **leans** to pick a direction.
5. After turning, player walks to a **blast door** — a quiz appears.
6. Answer correctly → door slides open, score advances.
7. Wrong answer or timeout → lose a life, respawn at maze start (score preserved).
8. Complete **6 correct answers** across 3 levels → **VICTORY** screen with final time.

---

## System Architecture

```
Project-AI/
├── backend/
│   ├── server.py               # Python WebSocket server + game loop
│   ├── config.py               # Centralised backend constants
│   └── motion_logic/
│       └── gesture_detection.py  # Arm-angle + wiper calculations
└── frontend/
    ├── index.html              # Game shell + all overlays
    ├── assets/
    │   ├── css/style.css       # All game UI styles
    │   └── js/game_engine.js   # Three.js scene, orchestration
    └── game/
        ├── config.js           # Centralised frontend constants
        ├── input_adapter.js    # Socket.IO telemetry consumer
        ├── character_factory.js
        ├── character_control.js
        ├── character_animator.js
        ├── camera_controller.js
        ├── logic/
        │   ├── GameManager.js  # State machine (RUNNING / AT_JUNCTION / AT_DOOR / …)
        │   └── QuizManager.js  # Quiz lifecycle, timer, gesture answer
        └── world/
            ├── LevelManager.js # Procedural chunk streaming + door/junction state
            └── ChunkFactory.js # Three.js mesh builders (corridor, T-junction, blast door)
```

**Tech stack**

| Layer | Technology |
|---|---|
| Pose estimation | [MediaPipe Pose Landmarker Lite](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) |
| Computer vision | OpenCV (`opencv-python-headless`) |
| Backend server | Python + `eventlet` + `python-socketio` |
| 3D rendering | [Three.js r160](https://threejs.org/) (CDN, no build step) |
| Frontend comms | Socket.IO v4 (CDN) |
| Fonts | Google Fonts — Orbitron, Rajdhani |

---

## Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.9 – 3.11 |
| pip | Latest |
| Webcam | Any USB or built-in camera |
| Browser | Chrome / Edge (WebSocket + ES modules) |
| OS | Windows 10/11 · macOS 12+ · Ubuntu 20.04+ |

> **Note:** The MediaPipe model file (`pose_landmarker_lite.task`) must be present at `backend/models/pose_landmarker_lite.task`. Download link below.

---

## Installation

### 1 — Clone the repository

```bash
git clone https://github.com/your-org/motion-link.git
cd motion-link
```

### 2 — Create a Python virtual environment

```bash
python -m venv venv
```

Activate it:

| Platform | Command |
|---|---|
| Windows (PowerShell) | `.\venv\Scripts\Activate.ps1` |
| Windows (cmd) | `.\venv\Scripts\activate.bat` |
| macOS / Linux | `source venv/bin/activate` |

### 3 — Install Python dependencies

```bash
pip install -r requirement.txt
```

Dependencies installed:

```
eventlet
python-socketio
opencv-python-headless
mediapipe
numpy
```

### 4 — Download the MediaPipe model

Download `pose_landmarker_lite.task` from the [MediaPipe Models page](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker#models) and place it at:

```
backend/models/pose_landmarker_lite.task
```

Create the `models/` directory if it does not exist:

```bash
mkdir backend/models
```

### 5 — Verify your webcam index

By default the server uses camera index `0` (the system default webcam).  
If you have multiple cameras, edit `backend/config.py`:

```python
CAMERA_INDEX = 0   # change to 1, 2, … as needed
```

---

## Running the Application

### Start the server

```bash
cd backend
python server.py
```

You should see:

```
✅ SERVER RUNNING... (Waiting for Dashboard)
```

### Open the game

Open your browser and navigate to:

```
http://localhost:5000
```

The page will connect automatically. Stand in front of the webcam and follow the on-screen calibration prompt.

> **No separate build step is required.** The frontend is served directly by the Python backend as static files.

---

## Controls Reference

### Physical gestures (primary)

| Gesture | Action |
|---|---|
| Walk in place | Move forward through the corridor |
| Lean left | Turn left at a T-junction |
| Lean right | Turn right at a T-junction |
| Raise **right** arm | Raise hand (first junction dismiss) / Quiz **Option A** |
| Raise **left** arm | Raise hand (first junction dismiss) / Quiz **Option B** |

### Keyboard shortcuts (development / testing)

| Key | Action |
|---|---|
| `H` | Simulate hand raise (dismisses first-junction overlay) |
| `Q` | Restart run (after Game Over or Victory) |

---

## Project Structure

```
Project-AI/
├── backend/
│   ├── config.py                   # All backend tunable constants
│   ├── server.py                   # Main entry point — WSGI + game loop
│   ├── motion_logic/
│   │   ├── gesture_detection.py    # Arm-angle math
│   │   ├── walking.py              # (reserved)
│   │   └── turning.py              # (reserved)
│   └── models/
│       └── pose_landmarker_lite.task   # MediaPipe model (download separately)
├── frontend/
│   ├── index.html
│   ├── assets/
│   │   ├── css/style.css
│   │   └── js/game_engine.js
│   └── game/
│       ├── config.js
│       ├── input_adapter.js
│       ├── character_factory.js
│       ├── character_control.js
│       ├── character_animator.js
│       ├── camera_controller.js
│       ├── logic/
│       │   ├── GameManager.js
│       │   └── QuizManager.js
│       └── world/
│           ├── LevelManager.js
│           └── ChunkFactory.js
├── requirement.txt
└── README.md
```

---

## Configuration

All tunable values are centralized in two files — no magic numbers exist in source files.

### `backend/config.py`

| Constant | Default | Description |
|---|---|---|
| `CENTER_LEFT_LIMIT` | `0.3` | Nose X limit for calibration lock (left) |
| `CENTER_RIGHT_LIMIT` | `0.7` | Nose X limit for calibration lock (right) |
| `TURN_LEFT_TRIGGER` | `0.4` | Lean threshold to emit LEFT turn |
| `TURN_RIGHT_TRIGGER` | `0.6` | Lean threshold to emit RIGHT turn |
| `BOUNCE_THRESHOLD` | `0.003` | Shoulder delta to count as a walking step |
| `STEP_COOLDOWN` | `0.3` | Minimum seconds between steps |
| `MOMENTUM_GAIN` | `0.15` | Momentum added per bounced step |
| `MOMENTUM_DECAY` | `0.92` | Friction coefficient when not walking |
| `CAMERA_INDEX` | `0` | OpenCV camera device index |
| `SERVER_PORT` | `5000` | Port the backend listens on |

### `frontend/game/config.js`

| Constant | Default | Description |
|---|---|---|
| `SOCKET_URL` | `http://localhost:5000` | Backend WebSocket address |
| `ARM_RAISE_THRESHOLD` | `60` | Arm angle (°) to count as raised |
| `QUIZ_TIMER_START` | `30` | Seconds per quiz question |
| `ARM_COOLDOWN_FRAMES` | `20` | Grace frames after quiz starts |
| `CHUNK_LENGTH` | `20` | Corridor chunk length (units) |
| `SEQUENCE_LEN` | `6` | Straight chunks between junctions |

---

## Troubleshooting

**Server starts but camera is black / "NO PLAYER"**  
→ Check that no other application is using the webcam. Try `CAMERA_INDEX = 1` in `config.py`.

**`FATAL: Model not found`**  
→ Ensure `backend/models/pose_landmarker_lite.task` exists. Re-download from the MediaPipe link above.

**Browser shows "Connecting…" indefinitely**  
→ Confirm the server is running on port 5000. Check for firewall rules blocking localhost.

**Arm raises trigger wrong quiz answer**  
→ Ensure you are standing centered in the camera frame, facing forward. Avoid bright backlighting.

**Calibration never completes**  
→ Stand still with arms at sides, face the camera. The system needs ~2 seconds of stable body pose.

**`eventlet` deprecation warning**  
→ This is a display-only warning and does not affect functionality. The server runs correctly.

---

## License

This project is for educational and demonstration purposes.
