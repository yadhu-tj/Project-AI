import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { ChunkFactory } from "./ChunkFactory.js";

export class LevelManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = [];
        this.factory = new ChunkFactory();

        // Config (Must match factory for logic)
        this.chunkLength = 20;
        this.chunkWidth = 7;
        this.renderDistance = 8;

        // Initialize state
        this.nextChunkPos = new THREE.Vector3(0, 0, 0);
        this.direction = new THREE.Vector3(0, 0, -1); // Start moving North (-Z)

        this.chunksSpawned = 0; // Track progress
        this.stopSpawning = false; // Flag to stop world generation at T-Junction
        this.activeJunction = null; // Track the current junction chunk for turn logic

        // Initial Generation
        for (let i = 0; i < this.renderDistance; i++) {
            this.spawnSequence();
        }
    }

    spawnSequence() {
        console.log("📦 spawnSequence called, stopSpawning:", this.stopSpawning, "chunksSpawned:", this.chunksSpawned);
        if (this.stopSpawning) return;

        // Pattern: 6 Straight -> 1 T-Junction
        const SEQUENCE_LENGTH = 6;

        if (this.chunksSpawned > 0 && this.chunksSpawned % SEQUENCE_LENGTH === 0) {
            console.log("  -> Spawning T-Junction");
            this.spawnTJunction();
            this.stopSpawning = true; // Stop generation after spawning the Fork
        } else {
            console.log("  -> Spawning normal chunk");
            this.spawnChunk();
        }
        this.chunksSpawned++;
    }

    spawnTJunction() {
        const chunk = this.factory.createJunctionChunk();

        // Position & Rotate
        chunk.position.copy(this.nextChunkPos);
        chunk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), this.direction);

        this.scene.add(chunk);

        // Store
        const junctionData = {
            mesh: chunk,
            pos: this.nextChunkPos.clone(),
            type: "JUNCTION"
        };
        this.chunks.push(junctionData);
        this.activeJunction = junctionData; // Track for handleTurn

        // Advance
        this.nextChunkPos.addScaledVector(this.direction, this.chunkLength);
    }

    spawnChunk() {
        const chunk = this.factory.createStandardChunk();

        // Position & Rotate
        chunk.position.copy(this.nextChunkPos);
        chunk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), this.direction);

        this.scene.add(chunk);

        this.chunks.push({
            mesh: chunk,
            pos: this.nextChunkPos.clone(),
            type: "NORMAL"
        });

        // Advance
        this.nextChunkPos.addScaledVector(this.direction, this.chunkLength);
    }

    handleTurn(directionStr) {
        console.log("🔄 HANDLE TURN:", directionStr);

        // "LEFT" or "RIGHT"
        // CRITICAL: Save old direction BEFORE updating it
        const oldDir = this.direction.clone();
        console.log("  Old direction:", oldDir);

        // 1. Determine new Direction Vector
        const axis = new THREE.Vector3(0, 1, 0);
        const angle = (directionStr === "LEFT") ? -Math.PI / 2 : Math.PI / 2;

        this.direction.applyAxisAngle(axis, angle);
        this.direction.round();
        console.log("  New direction:", this.direction.clone());

        // 2. Calculate New Spawn Position
        const junctionChunk = this.activeJunction;
        if (!junctionChunk) {
            console.error("  ERROR: No active junction!");
            return;
        }
        const chunkStart = junctionChunk.pos.clone();
        console.log("  Junction chunk start:", chunkStart);

        // Junction center is at -6.5 (local Z) from chunk start
        const junctionCenter = chunkStart.clone().add(oldDir.clone().multiplyScalar(6.5));
        console.log("  Junction center:", junctionCenter);

        // Side corridors are at ±13.5 (local X) from junction center
        // Get perpendicular vector (cross product of oldDir and Y-axis)
        const perpendicular = new THREE.Vector3().crossVectors(oldDir, axis).normalize();
        console.log("  Perpendicular:", perpendicular);

        // LEFT turn uses -perpendicular (local X = -13.5), RIGHT uses +perpendicular (local X = +13.5)
        const sideOffset = perpendicular.clone().multiplyScalar((directionStr === "LEFT") ? -13.5 : 13.5);
        const sideCorridorStart = junctionCenter.clone().add(sideOffset);
        console.log("  Side corridor start:", sideCorridorStart);

        // Side corridor is 20 units long, spawn at the end
        this.nextChunkPos = sideCorridorStart.clone().add(this.direction.clone().multiplyScalar(20));
        console.log("  Next chunk pos:", this.nextChunkPos);

        // 3. Resume spawning with fresh pattern
        this.chunksSpawned = 0;
        this.stopSpawning = false;
        console.log("  Calling spawnSequence...");
        this.spawnSequence();
    }

    update(playerPos) {
        // playerPos is a Vector3
        if (this.stopSpawning) return;

        // Check distance to the "Next Chunk Spawn Point"
        const dist = playerPos.distanceTo(this.nextChunkPos);
        const buffer = this.renderDistance * this.chunkLength;

        if (dist < buffer) {
            this.spawnSequence();
            this.removeOldChunks(playerPos);
        }
    }

    removeOldChunks(playerPos) {
        // Remove chunks that are far away
        const MAX_DIST = this.chunkLength * (this.renderDistance + 2); // 160 assuming render 6

        if (this.chunks.length > 0) {
            const oldestChunk = this.chunks[0];
            const dist = playerPos.distanceTo(oldestChunk.pos);

            if (dist > MAX_DIST) {
                this.scene.remove(oldestChunk.mesh);
                this.chunks.shift();
            }
        }
    }
}
