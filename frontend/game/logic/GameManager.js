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
            this.checkOrientation();
            // Pass full Vector3 position so LevelManager can calculate distance in any direction
            this.levelManager.update(this.character.group.position);
        }
    }

    checkOrientation() {
        // ROBUST CONSTRAINT SYSTEM
        // Check ALL chunks to see if player is inside any of them
        // PRIORITY: NORMAL chunks override JUNCTION chunks
        const pPos = this.character.group.position;
        const chunks = this.levelManager.chunks;

        let appliedConstraint = false;

        for (const chunk of chunks) {
            const chunkMesh = chunk.mesh;

            // World -> Local
            chunkMesh.updateMatrixWorld(true);
            const localPos = pPos.clone();
            chunkMesh.worldToLocal(localPos);

            // Check if player is inside this chunk's bounds
            // Different bounds for NORMAL vs JUNCTION chunks
            let isInside;
            if (chunk.type === "NORMAL") {
                // Tight bounds for normal corridors
                isInside = Math.abs(localPos.x) < 10 && Math.abs(localPos.z) < 12;
            } else {
                // Wider X bounds for junctions to accommodate side corridors (extend to ±13.5)
                // and turn trigger (fires at ±15)
                isInside = Math.abs(localPos.x) < 18 && Math.abs(localPos.z) < 12;
            }

            if (!isInside) continue;

            const localRot = this.character.group.rotation.y - chunkMesh.rotation.y;
            // Normalize angle -PI to PI
            const normalizeAngle = (a) => {
                a = a % (2 * Math.PI);
                if (a > Math.PI) a -= 2 * Math.PI;
                if (a < -Math.PI) a += 2 * Math.PI;
                return a;
            };
            const normRot = normalizeAngle(localRot);

            // Determine Constraint based on Chunk Type & Local State
            if (chunk.type === "NORMAL") {
                // NORMAL CHUNK: Always constrain to Center (Local X = 0)
                this._applyLocalConstraint(chunkMesh, 'X', 0);
                appliedConstraint = true;
                break; // NORMAL chunks take priority, stop searching
            }
            else if (chunk.type === "JUNCTION" && !appliedConstraint) {
                // JUNCTION: Depends on where we are / facing
                const localRot2 = this.character.group.rotation.y - chunkMesh.rotation.y;
                const normRot2 = normalizeAngle(localRot2);

                if (Math.abs(normRot2) < 0.3) {
                    // APPROACHING (Local Approach path)
                    this._applyLocalConstraint(chunkMesh, 'X', 0);
                } else {
                    // TURNED (Side Path)
                    this._applyLocalConstraint(chunkMesh, 'Z', -6.5);

                    // Turn Trigger: Only fire on the ACTIVE junction (tracked by LevelManager)
                    const isActiveJunction = (chunk === this.levelManager.activeJunction);

                    if (Math.abs(localPos.x) > 0.1 && !chunk.hasTurned && isActiveJunction) {
                        const dir = (localPos.x > 0) ? "LEFT" : "RIGHT";
                        console.log("⚡ Turn trigger! direction:", dir);
                        this.levelManager.handleTurn(dir);
                        chunk.hasTurned = true;
                        break;
                    }
                }
                // Don't break for junctions - keep searching for NORMAL chunks
            }
        }
    }

    _applyLocalConstraint(chunkMesh, localAxis, localValue) {
        // Convert Local Constraint to Global
        // If Local Axis is X, Value is 0.
        // We need to know which World Axis this corresponds to.

        // Get Chunk Global Rotation Y
        const rotY = chunkMesh.rotation.y;

        // Simple Snap: Is chunk aligned Z (0, 180) or X (90, 270)?
        // 0 or PI -> Z-Aligned. Local X = World X. Local Z = World Z.
        // PI/2 or -PI/2 -> X-Aligned. Local X = World Z. Local Z = World X.

        const isZAligned = Math.abs(Math.cos(rotY)) > 0.5; // Cos(0)=1. Cos(90)=0.

        if (localAxis === 'X') {
            if (isZAligned) {
                // World X = ChunkPos.x + localValue
                // (Assuming no translation rotation besides Y)
                // Actually, chunk.worldToLocal handles rotation around origin?
                // Chunk pivot is at its position.
                // So Global = ChunkPos + Rotation * LocalOffset.
                // If we want to lock Local X to localValue.
                // Local Point = (localValue, ?, ?).
                // Rotated: (localValue * cos - ? * sin, ...)
                // For simplified 90-degree rotations:

                const targetWorldCoord = chunkMesh.position.x + localValue * Math.cos(rotY);
                // Wait, if Rot=180, LocalX positive -> WorldX negative?
                // Yes. X * cos(180) = -X.

                this.character.setConstraintMode('Z', targetWorldCoord); // Constrain X (Move Z)
                // Note: setConstraintMode('Z', center) means "Moving along Z, constrain X to center".

            } else {
                // Chunk is X-Aligned (Rot 90).
                // Local X maps to World Z.
                // World Z = ChunkPos.z - localValue * Math.sin(rotY); (Standard rot matrix)

                const targetWorldCoord = chunkMesh.position.z - localValue * Math.sin(rotY);

                this.character.setConstraintMode('X', targetWorldCoord); // Constrain Z (Move X)
            }
        }
        else if (localAxis === 'Z') {
            if (isZAligned) {
                // Local Z maps to World Z.
                // We want to constrain Global Z?
                // Wait. Local Z constraint means "Lock Z".
                // That implies we are moving Side-to-Side (Local X).
                // So we constrain Z. (Mode X).

                const targetWorldCoord = chunkMesh.position.z + localValue * Math.cos(rotY); // Approximate Z translation
                this.character.setConstraintMode('X', targetWorldCoord);
            } else {
                // Chunk X-Aligned.
                // Local Z maps to World X.
                // We want to constrain Global X. (Mode Z).

                const targetWorldCoord = chunkMesh.position.x + localValue * Math.sin(rotY); // Approx X
                // Sin(90)=1. LocalZ -> WorldX.

                this.character.setConstraintMode('Z', targetWorldCoord);
            }
        }
    }

    checkCollision() {
        const chunks = this.levelManager.chunks;
        const pPos = this.character.group.position;
        let anyBlocking = false;

        // Only check the MOST RECENT junction (prevents ghost-blocking by old junctions)
        let latestJunction = null;
        for (let i = chunks.length - 1; i >= 0; i--) {
            if (chunks[i].type === "JUNCTION") {
                latestJunction = chunks[i];
                break;
            }
        }

        if (latestJunction) {
            const chunk = latestJunction;
            chunk.mesh.updateMatrixWorld(true);
            const localPos = pPos.clone();
            chunk.mesh.worldToLocal(localPos);

            // Wall is always at local Z = -chunkLength/2
            const wallLocalZ = -this.levelManager.chunkLength / 2;
            const dist = Math.abs(localPos.z - wallLocalZ);

            if (dist < 4.0 && Math.abs(localPos.x) < 15) {
                // Check if player is facing along the side path (relative to chunk)
                const relativeRot = this.character.group.rotation.y - chunk.mesh.rotation.y;
                const normRot = ((relativeRot % (2 * Math.PI)) + Math.PI) % (2 * Math.PI) - Math.PI;
                const isSidePath = Math.abs(normRot) > 0.5;

                if (isSidePath) {
                    this.character.setBlocked(false);
                    this.character.setCanTurn(true);
                } else {
                    this.character.setBlocked(true);
                    this.character.setCanTurn(true);
                    anyBlocking = true;
                }
            }
        }

        // Only unblock if NO junction is blocking
        if (!anyBlocking) {
            this.character.setBlocked(false);
            this.character.setCanTurn(false);
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
