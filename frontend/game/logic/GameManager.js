import { CONFIG } from "../../game/config.js";
export class GameManager {
    constructor(character, levelManager, input, onFlash = null) {
        this.character = character;
        this.levelManager = levelManager;
        this.input = input;
        this.onFlash = onFlash;

        this._lastTurn = "CENTER";

        this.gameState = "RUNNING";
        this.junctionDismissed = false;

        this.junctionCount = 0;

        this.lives = 3;
        this.score = 0;

        this.level = 1;
        this.startTime = Date.now();
        this.endTime = null;
        this.globalTime = "00:00.00";
        this.timerActive = false;
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
        const prevLevel = this.level;
        this.score++;
        this.level = Math.floor(this.score / 3) + 1;

        if (this.score >= 6) {
            this.endTime = Date.now();
            this.gameState = "GAME_WON";
            console.log("🏆 Game Won! Final time:", this.formatTime(this.endTime - this.startTime));
        } else {
            this.gameState = "DOOR_OPENING";
            if (this.level > prevLevel) {
                if (this.onFlash) this.onFlash("cyan", "LEVEL " + this.level + " SECURED");
            } else {
                if (this.onFlash) this.onFlash("cyan", "SYSTEM OVERRIDE SUCCESSFUL");
            }
            console.log(`✅ Score: ${this.score} | Level: ${this.level}`);
        }
    }

    update() {
        if (!this.timerActive) return;

        const now = Date.now();
        const frameDelta = now - (this._prevFrameTime || now);
        this._prevFrameTime = now;

        const overlayPaused = this.gameState === "AT_JUNCTION"
            && this.junctionCount === 0
            && !this.junctionDismissed;

        if (overlayPaused) {
            this.startTime += frameDelta;
        }

        if (this.gameState !== "DEAD" && this.gameState !== "GAME_WON") {
            this.globalTime = this.formatTime(now - this.startTime);
        }

        const speed = this.character.animator.speed;
        const turn = this.input.turn;

        switch (this.gameState) {

            case "RUNNING": {
                this.levelManager.update(speed);
                if (this.levelManager.isBlocked) {
                    if (this.levelManager.blockerType === "JUNCTION") this.gameState = "AT_JUNCTION";
                    else if (this.levelManager.blockerType === "DOOR") this.gameState = "AT_DOOR";
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
                    } else if (this.input.l_arm > CONFIG.ARM_RAISE_THRESHOLD || this.input.r_arm > CONFIG.ARM_RAISE_THRESHOLD) {
                        // First junction — wait for either arm to be raised.
                        this.junctionDismissed = true;
                    }
                } else {
                    if (turn !== "CENTER" && turn !== this._lastTurn) {
                        this.levelManager.handleTurn(turn, this.character.group);
                        this.junctionDismissed = false;
                        this.junctionCount++;
                        this._lastTurn = "CENTER";
                        this.gameState = "RUNNING";
                    }
                }
                this._lastTurn = turn;
                break;
            }

            case "AT_DOOR": {
                break;
            }

            case "DOOR_OPENING": {
                if (this.levelManager.openActiveDoor()) {
                    this.gameState = "RUNNING";
                }
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
            //this.score = 0;
            //this.level = 1;
            //this.startTime = Date.now();
            this.endTime = null;
            this.character.group.rotation.set(0, 0, 0);
            this.levelManager.resetToStart();
            this.gameState = "RUNNING";
            if (this.onFlash) this.onFlash("red", "INCORRECT - YOU LOSE A LIFE");
        }
    }
}


