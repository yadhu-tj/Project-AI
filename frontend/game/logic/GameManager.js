export class GameManager {
    constructor(character, levelManager, input) {
        this.character = character;
        this.levelManager = levelManager;
        this.input = input;

        this._lastTurn = "CENTER"; // Edge-detection for turn input

        // Set to true while the junction overlay is visible.
        // Turns are suppressed during this time so that dismissing
        // the overlay with a hand raise doesn't also fire handleTurn().
        this.overlayOpen = false;
    }

    update() {
        const speed = this.character.animator.speed;

        // Always try to scroll the world (LevelManager ignores this when blocked)
        this.levelManager.update(speed);

        // Only check for turn gestures when NOT blocked by the overlay
        if (this.levelManager.isBlocked && !this.overlayOpen) {
            this._checkTurnInput();
        } else {
            // Reset edge-detector when not processing turns
            this._lastTurn = "CENTER";
        }
    }

    // ─── PRIVATE ───────────────────────────────────────────────────────────────

    _checkTurnInput() {
        const turn = this.input.turn; // "LEFT" | "RIGHT" | "CENTER"

        // Fire only on a fresh LEFT or RIGHT gesture (edge detection)
        if ((turn === "LEFT" || turn === "RIGHT") && turn !== this._lastTurn) {
            console.log("🔄 Turn triggered:", turn);
            this.levelManager.handleTurn(turn, this.character.group);
        }

        this._lastTurn = turn;
    }
}
