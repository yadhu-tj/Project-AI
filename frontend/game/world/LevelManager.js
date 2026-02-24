import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { ChunkFactory } from "./ChunkFactory.js";

export class LevelManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = [];
        this.factory = new ChunkFactory();

        // Config
        this.chunkLength = 20;
        this.renderDistance = 8;
        this.SEQUENCE_LEN = 6; // Straights before each T-junction

        // World container — scrolls/rotates while character stays fixed at origin
        this.worldContainer = new THREE.Group();
        scene.add(this.worldContainer);

        // Spawn state
        this.nextChunkLocalZ = 0;
        this.chunksSpawned = 0;
        this.stopSpawning = false;

        // Travel distance — direction-agnostic scalar that counts how far the
        // world has scrolled since the last reset. Used for all distance checks
        // so they remain correct after the container has been rotated.
        this.travelDistance = 0;

        // Junction state
        this.isBlocked = false;
        this.activeJunction = null; // { localZ, ... }
        this.justTurned = false; // One-frame snap flag for camera

        // Spawn initial corridor
        for (let i = 0; i < this.renderDistance; i++) {
            this._spawnSequence();
        }
    }

    // Called every frame with the current movement speed
    update(speed) {
        this.justTurned = false; // Clear snap flag after one frame

        if (this.isBlocked || speed <= 0) return;

        // KEY FIX: translateZ moves along the container's OWN local Z axis.
        // After a turn the container is rotated, so translateZ automatically
        // scrolls in the new corridor direction instead of always world +Z.
        this.worldContainer.translateZ(speed);
        this.travelDistance += speed;

        // Spawn new frontier chunks when close enough
        if (!this.stopSpawning) {
            // nextChunkLocalZ is negative (e.g. -160). The chunk is within
            // renderDistance when travelDistance has closed that gap.
            const distToFrontier = Math.abs(this.nextChunkLocalZ) - this.travelDistance;
            if (distToFrontier < this.renderDistance * this.chunkLength) {
                this._spawnSequence();
                this._removeOldChunks();
            }
        }

        // Check if the junction's blocking wall has reached the character
        if (this.activeJunction) {
            // Wall is at the FAR end of the junction chunk (localZ - chunkLength/2)
            const distToWall = Math.abs(this.activeJunction.localZ) + this.chunkLength / 2;
            if (this.travelDistance >= distToWall - 4.0) {
                this.isBlocked = true;
            }
        }
    }

    // Called by GameManager when player turns at the junction
    handleTurn(direction, characterGroup) {
        const angle = (direction === "LEFT") ? Math.PI / 2 : -Math.PI / 2;

        // 1. Rotate world container — new local -Z points along the new corridor direction
        this.worldContainer.rotation.y += angle;

        // 2. Rotate character to face the new direction (camera follows)
        if (characterGroup) {
            characterGroup.rotation.y += angle;
        }

        // 3. Clear all existing chunks
        for (const chunk of this.chunks) {
            this.worldContainer.remove(chunk.mesh);
        }
        this.chunks = [];

        // 4. Reset container position — new corridor starts right at the character
        this.worldContainer.position.set(0, 0, 0);

        // 5. Reset ALL spawn & travel state
        this.nextChunkLocalZ = 0;
        this.chunksSpawned = 0;
        this.stopSpawning = false;
        this.activeJunction = null;
        this.isBlocked = false;
        this.travelDistance = 0;   // ← Reset so distance checks are fresh
        this.justTurned = true; // Signal camera to snap this frame

        // 6. Spawn fresh corridor in the new direction
        for (let i = 0; i < this.renderDistance; i++) {
            this._spawnSequence();
        }
    }

    // ─── PRIVATE ───────────────────────────────────────────────────────────────

    _spawnSequence() {
        if (this.stopSpawning) return;

        if (this.chunksSpawned > 0 && this.chunksSpawned % this.SEQUENCE_LEN === 0) {
            this._spawnJunctionChunk();
            this.stopSpawning = true;
        } else {
            this._spawnStraightChunk();
        }
        this.chunksSpawned++;
    }

    _spawnStraightChunk() {
        const chunk = this.factory.createStandardChunk();
        chunk.position.z = this.nextChunkLocalZ;
        this.worldContainer.add(chunk);

        this.chunks.push({ mesh: chunk, localZ: this.nextChunkLocalZ, type: "NORMAL" });
        this.nextChunkLocalZ -= this.chunkLength;
    }

    _spawnJunctionChunk() {
        const chunk = this.factory.createJunctionChunk();
        chunk.position.z = this.nextChunkLocalZ;
        this.worldContainer.add(chunk);

        const data = { mesh: chunk, localZ: this.nextChunkLocalZ, type: "JUNCTION" };
        this.chunks.push(data);
        this.activeJunction = data;

        this.nextChunkLocalZ -= this.chunkLength;
    }

    _removeOldChunks() {
        // A chunk is "old" when the world has scrolled far enough past it.
        // localZ is negative, so the chunk was at distance |localZ| from origin.
        // It's behind the character once travelDistance > |localZ| + buffer.
        const REMOVE_BUFFER = this.chunkLength * 2;

        if (this.chunks.length > 0) {
            const oldest = this.chunks[0];
            const distWhenSpawned = Math.abs(oldest.localZ);
            if (this.travelDistance > distWhenSpawned + REMOVE_BUFFER) {
                this.worldContainer.remove(oldest.mesh);
                this.chunks.shift();
            }
        }
    }
}
