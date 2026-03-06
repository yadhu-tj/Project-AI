// =============================================================================
//  config.js  —  Central configuration for all frontend game constants
//
//  EDITING GUIDE
//  ─────────────
//  All tunable values live here. Import CONFIG from this file in any module
//  that needs these values. DO NOT place new magic numbers in source files.
// =============================================================================

export const CONFIG = {

    // ── Network ───────────────────────────────────────────────────────────────
    // If the game is loaded via file://, fallback to localhost. Otherwise use the actual hostname.
    SOCKET_URL: window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin,

    // ── Gesture thresholds ────────────────────────────────────────────────────
    ARM_RAISE_THRESHOLD: 60,   // l_arm / r_arm value above which arm is "raised"
    ARM_COOLDOWN_FRAMES: 20,   // Grace frames after quiz starts before arm triggers

    // ── Quiz ──────────────────────────────────────────────────────────────────
    QUIZ_TIMER_START: 30,   // Seconds on the countdown clock

    // ── World geometry ────────────────────────────────────────────────────────
    CHUNK_LENGTH: 20,   // Length of each corridor chunk (units)
    CHUNK_WIDTH: 7,   // Width of each corridor chunk (units)
    WALL_HEIGHT: 15,   // Height of corridor walls (units)

    // ── Level generation ──────────────────────────────────────────────────────
    RENDER_DISTANCE: 8,   // How many chunk-sequences to spawn ahead
    SEQUENCE_LEN: 6,   // Straight chunks between each T-junction
};
