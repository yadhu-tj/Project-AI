export class GameManager {
    constructor(character, levelManager, input) {
        this.character = character;
        this.levelManager = levelManager;
        this.input = input;

        this.state = "RUNNING"; // RUNNING, BLOCKED
    }

    update() {
        if (this.state === "RUNNING") {
            this.checkCollision();
        }
    }

    checkCollision() {
        // Check upcoming T-Junctions
        // We know T-Junctions are marked with type 'JUNCTION' in LevelManager

        const chunks = this.levelManager.chunks;
        const playerZ = this.character.group.position.z;

        for (const chunk of chunks) {
            if (chunk.type === "JUNCTION") {
                // Junction Wall is at chunk.z - chunkLength/2
                // Example: Chunk at -200. Wall at -210.
                const wallZ = chunk.z - (this.levelManager.chunkLength / 2);

                // Dist: Player is at -205. Wall -210. Dist = 5.
                // Note: Player Z is negative. Wall Z is more negative.
                // Abs distance
                const dist = Math.abs(playerZ - wallZ);

                // Stop threshold (e.g. 3 units before wall)
                // Also ensure player is actually approaching it (Player Z > Wall Z)
                if (playerZ > wallZ && dist < 3.0) {
                    this.triggerBlock();
                }
            }
        }
    }

    triggerBlock() {
        console.log("🛑 BLOCKED AT T-JUNCTION");
        this.state = "BLOCKED";

        // Stop Character
        if (this.character.animator) {
            this.character.animator.isBlocked = true;
            this.character.animator.speed = 0;
        }
    }
}
