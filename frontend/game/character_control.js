import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { CharacterFactory } from "./character_factory.js";
import { CharacterAnimator } from "./character_animator.js";

// Turn mode configuration (for future upgrade)
const TURN_MODE = "INSTANT"; // "INSTANT" or "GRADUAL"

export class CharacterController {
    constructor(scene, input, gameManager) {
        this.input = input;
        this.gameManager = gameManager; // Reference to GameManager for turn callbacks

        // 1. Create Mesh Hierarchy via Factory
        this.parts = CharacterFactory.create(scene);
        this.group = this.parts.group;

        // 2. Initialize Animator
        this.animator = new CharacterAnimator(this.parts);

        // 3. Control Flags
        this.canTurn = false; // Locked by default (until T-Junction)

        // 4. Turn tracking
        this.lastTurnInput = "CENTER";
    }

    setCanTurn(enabled) {
        this.canTurn = enabled;
    }

    setBlocked(blocked) {
        // Pass collision state to animator (to stop movement)
        this.animator.isBlocked = blocked;
    }

    setConstraintMode(axis, center) {
        this.animator.setConstraintMode(axis, center);
    }

    update() {
        // 1. Get Raw Input
        const rawInput = this.input;

        // 2. Handle Turn Input (BEFORE animator update)
        if (this.canTurn && rawInput.turn !== "CENTER" && rawInput.turn !== this.lastTurnInput) {
            this.handleTurn(rawInput.turn);
        }
        this.lastTurnInput = rawInput.turn;

        // 3. Filter Input based on Flags
        const effectiveInput = { ...rawInput };

        if (TURN_MODE === "INSTANT") {
            // In instant mode, disable gradual turning in animator
            effectiveInput.turn = "CENTER";
        } else {
            // In gradual mode, allow animator to handle turning
            if (!this.canTurn) {
                effectiveInput.turn = "CENTER";
            }
        }

        // 4. Delegate to Animator
        this.animator.update(effectiveInput);
    }

    handleTurn(direction) {
        if (TURN_MODE === "INSTANT") {
            // Instant 90° rotation
            const angle = (direction === "LEFT") ? Math.PI / 2 : -Math.PI / 2;
            this.group.rotation.y += angle;

            // Notify GameManager to spawn new chunks
            this.gameManager.handleJunctionTurn(direction);

            // Disable turning after turn completes
            this.canTurn = false;
        } else {
            // GRADUAL mode - future implementation
            // Will track rotation progress and trigger spawn at 45°
        }
    }
}
