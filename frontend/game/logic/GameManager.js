export class GameManager {
    constructor(character, levelManager, input) {
        this.character = character;
        this.levelManager = levelManager;
        this.input = input;

        this._lastTurn = "CENTER";

        this.gameState = "RUNNING";
        this.junctionDismissed = false;

        // Tracks how many junctions have been reached.
        // The FIRST junction (junctionCount === 0) requires a hand-raise gesture
        // or the H key to dismiss the dialogue overlay before turning.
        // All subsequent junctions (junctionCount >= 1) are auto-dismissed —
        // no gesture or keybinding is needed; just turn.
        this.junctionCount = 0;

        this.lives = 3;
        this.score = 0;

        // ── Phase 4: Speedrun / Level tracking ───────────────────────────────
        // score 0-2  → level 1 │ score 3-5 → level 2 │ score 6-8 → level 3
        // score >= 9 → GAME_WON
        this.level = 1;
        this.startTime = Date.now();
        this.endTime = null;
        this.globalTime = "00:00.00";
    }

    // ── Converts elapsed ms into "MM:SS.cs" (centiseconds) ───────────────────
    formatTime(ms) {
        const totalCs = Math.floor(ms / 10);
        const cs = totalCs % 100;
        const secs = Math.floor(totalCs / 100) % 60;
        const mins = Math.floor(totalCs / 6000);
        return (
            String(mins).padStart(2, "0") + ":" +
            String(secs).padStart(2, "0") + "." +
            String(cs).padStart(2, "0")
        );
    }

    // ── Called by QuizManager on a correct answer ─────────────────────────────
    addScore() {
        this.score++;
        this.level = Math.floor(this.score / 3) + 1;

        if (this.score >= 2) {
            this.endTime = Date.now();
            this.gameState = "GAME_WON";
            console.log("🏆 Game Won! Final time:", this.formatTime(this.endTime - this.startTime));
        } else {
            this.gameState = "RUNNING";
            console.log(`✅ Score: ${this.score} | Level: ${this.level}`);
        }
    }

    update() {
        // ── Global timer — ticks in every non-terminal state ─────────────────
        if (this.gameState !== "DEAD" && this.gameState !== "GAME_WON") {
            this.globalTime = this.formatTime(Date.now() - this.startTime);
        }

        const speed = this.character.animator.speed;
        const turn = this.input.turn;

        switch (this.gameState) {

            case "RUNNING": {
                this.levelManager.update(speed);
                if (this.levelManager.isBlocked) {
                    this.gameState = "AT_JUNCTION";
                }
                break;
            }

            case "AT_JUNCTION": {
                // Junction 1 (junctionCount === 0): require a hand-raise (gesture or H key)
                // to dismiss the dialogue overlay before the player can turn.
                // Junction 2+ (junctionCount >= 1): auto-dismiss — just turn directly.
                if (!this.junctionDismissed) {
                    if (this.junctionCount > 0) {
                        // Not the first junction — skip the gesture gate entirely.
                        this.junctionDismissed = true;
                    } else if (this.input.l_arm > 60 || this.input.r_arm > 60) {
                        // First junction — wait for either arm to be raised.
                        this.junctionDismissed = true;
                    }
                } else {
                    if (turn !== "CENTER" && turn !== this._lastTurn) {
                        this.levelManager.handleTurn(turn, this.character.group);
                        this.junctionDismissed = false;
                        this.junctionCount++;           // Increment after each successful turn
                        this._lastTurn = "CENTER";      // Reset so same direction works next junction
                        this.gameState = "AT_DOOR";     // Trigger quiz before resuming
                    }
                }
                this._lastTurn = turn;
                break;
            }

            case "AT_DOOR": {
                break;
            }

            case "DEAD": {
                break;
            }

            case "GAME_WON": {
                break;
            }
        }
    }

    loseLife() {
        this.lives -= 1;
        console.log("💔 Life lost! Remaining lives:", this.lives);

        if (this.lives <= 0) {
            this.gameState = "DEAD";
            console.log("💀 Game Over — no lives remaining.");
        } else {
            // Reset progress — the run restarts from scratch
            this.score = 0;
            this.level = 1;
            //this.startTime = Date.now();
            this.endTime = null;
            this.character.group.rotation.set(0, 0, 0);
            this.levelManager.resetToStart();
            this.gameState = "RUNNING";
        }
    }
}


