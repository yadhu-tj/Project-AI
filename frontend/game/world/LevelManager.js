import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

export class LevelManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = [];
        this.chunkLength = 20; // Length of one corridor segment
        this.chunkWidth = 7;   // Narrower path
        this.wallHeight = 15;  // Huge walls
        this.renderDistance = 6; // How many chunks ahead to render

        // Materials
        this.mats = {
            floor: new THREE.MeshStandardMaterial({
                color: 0x111111,
                roughness: 0.1,
                metalness: 0.8
            }),
            wall: new THREE.MeshStandardMaterial({
                color: 0x404455, // Slate Blue-Grey for contrast
                roughness: 0.2,
                metalness: 0.1
            }),
            neon: new THREE.MeshBasicMaterial({
                color: 0x00ffff
            })
        };

        // Initialize state
        this.nextChunkZ = 0;
        this.chunksSpawned = 0; // Track progress
        this.stopSpawning = false; // Flag to stop world generation at T-Junction

        // Initial Generation
        for (let i = 0; i < this.renderDistance; i++) {
            this.spawnSequence();
        }
    }

    spawnSequence() {
        if (this.stopSpawning) return;

        // Pattern: 5 Straight -> 1 T-Junction
        // We want to test. Let's say 4 Straight -> 1 T.
        const SEQUENCE_LENGTH = 10;

        if (this.chunksSpawned > 0 && this.chunksSpawned % SEQUENCE_LENGTH === 0) {
            this.spawnTJunction();
            this.stopSpawning = true; // Stop generation after spawning the Fork
        } else {
            this.spawnChunk();
        }
        this.chunksSpawned++;
    }

    spawnTJunction() {
        const chunk = new THREE.Group();
        chunk.position.z = this.nextChunkZ;
        this.scene.add(chunk);

        // 1. FLOOR
        const floorGeo = new THREE.PlaneGeometry(this.chunkWidth, this.chunkLength);
        const floor = new THREE.Mesh(floorGeo, this.mats.floor);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        chunk.add(floor);

        // Helper to create a visual corridor segment (Floor + Walls)
        const createCorridorSegment = (px, py, pz, ry) => {
            const seg = new THREE.Group();

            // Floor
            const fGeo = new THREE.PlaneGeometry(this.chunkWidth, this.chunkLength);
            const fMesh = new THREE.Mesh(fGeo, this.mats.floor);
            fMesh.rotation.x = -Math.PI / 2;
            fMesh.receiveShadow = true;
            seg.add(fMesh);

            // Grid
            const gHelp = new THREE.GridHelper(this.chunkWidth, 7, 0x00ffff, 0x222222);
            gHelp.scale.z = this.chunkLength / this.chunkWidth;
            gHelp.position.y = 0.02;
            seg.add(gHelp);

            // Walls (Left and Right)
            const wallGeo = new THREE.BoxGeometry(1, this.wallHeight, this.chunkLength);
            const pillarGeo = new THREE.BoxGeometry(1.5, this.wallHeight + 1, 2);
            const pillarNeonGeo = new THREE.BoxGeometry(1.6, this.wallHeight, 0.2);
            const trimGeo = new THREE.BoxGeometry(0.5, 0.2, this.chunkLength);

            const addWall = (xOffset) => {
                const w = new THREE.Mesh(wallGeo, this.mats.wall);
                w.position.set(xOffset, this.wallHeight / 2, 0);
                w.castShadow = true;
                w.receiveShadow = true;
                seg.add(w);

                const p = new THREE.Mesh(pillarGeo, this.mats.wall);
                p.position.set(xOffset, this.wallHeight / 2, 0); // Pillow at center
                seg.add(p);

                const n = new THREE.Mesh(pillarNeonGeo, this.mats.neon);
                n.position.set(xOffset, this.wallHeight / 2, 0);
                seg.add(n);

                const t1 = new THREE.Mesh(trimGeo, this.mats.neon);
                t1.position.set((xOffset > 0 ? xOffset - 0.5 : xOffset + 0.5), 4, 0);
                seg.add(t1);

                const t2 = new THREE.Mesh(trimGeo, this.mats.neon);
                t2.position.set((xOffset > 0 ? xOffset - 0.5 : xOffset + 0.5), this.wallHeight - 1, 0);
                seg.add(t2);
            };

            addWall(-this.chunkWidth / 2 - 0.5);
            addWall(this.chunkWidth / 2 + 0.5);

            seg.position.set(px, py, pz);
            seg.rotation.y = ry;
            return seg;
        };

        // ALIGNMENT FIX:
        // Main Chunk: Z = 0. Ends at -10 (chunkLength/2).
        // Blocking Wall: Z = -10.
        // Side Paths width = 7.
        // We want the Side Paths to meet the Main Path *before* the wall.
        // The intersection zone is from -3 to -10 (-chunkLength/2 + chunkWidth .. -chunkLength/2).
        // Center of intersection = -6.5.

        const junctionZ = -this.chunkLength / 2 + this.chunkWidth / 2; // -10 + 3.5 = -6.5
        const widthOffset = this.chunkLength / 2 + this.chunkWidth / 2; // 10 + 3.5 = 13.5

        // LEFT PATH (Rotated +90 deg)
        // Center of Left Path (Length 20) is at X = -13.5.
        // Its Right Edge is at X = -3.5 (Aligned with Main Path Left Edge).
        const leftCorridor = createCorridorSegment(-widthOffset, 0, junctionZ, Math.PI / 2);
        chunk.add(leftCorridor);

        // RIGHT PATH (Rotated -90 deg)
        const rightCorridor = createCorridorSegment(widthOffset, 0, junctionZ, -Math.PI / 2);
        chunk.add(rightCorridor);

        // APPROACH WALLS (Main Path)
        // From Start (+10) to Intersection Start (-3). Length = 13.
        // Center = (+10 - 3) / 2 = +3.5.
        const approachLength = this.chunkLength - this.chunkWidth; // 20 - 7 = 13
        const approachZ = (this.chunkLength / 2) - (approachLength / 2); // 10 - 6.5 = 3.5

        const approachWallGeo = new THREE.BoxGeometry(1, this.wallHeight, approachLength);
        // ... (Reuse logic/materials) ...
        const addApproachWall = (xOffset) => {
            const w = new THREE.Mesh(approachWallGeo, this.mats.wall);
            w.position.set(xOffset, this.wallHeight / 2, approachZ);
            w.castShadow = true;
            w.receiveShadow = true;
            chunk.add(w);

            // Add trim for continuity
            const trimGeo = new THREE.BoxGeometry(0.5, 0.2, approachLength);
            const t1 = new THREE.Mesh(trimGeo, this.mats.neon);
            t1.position.set((xOffset > 0 ? xOffset - 0.5 : xOffset + 0.5), 4, approachZ);
            chunk.add(t1);
        };

        addApproachWall(-this.chunkWidth / 2 - 0.5);
        addApproachWall(this.chunkWidth / 2 + 0.5);


        // GRID (Red Warning Center at Intersection)
        const grid = new THREE.GridHelper(this.chunkWidth, 7, 0xff0000, 0x111111);
        grid.position.set(0, 0.02, junctionZ);
        grid.scale.z = 1; // Square
        chunk.add(grid);

        // 2. WALLS (The Fork)
        // No Side Walls.
        // BLOCKING WALL at the end.
        const blockGeo = new THREE.BoxGeometry(this.chunkWidth + 10, this.wallHeight, 1);
        const blockWall = new THREE.Mesh(blockGeo, this.mats.wall);
        // Position at the END of the chunk (-chunkLength/2 locally? No, logic is relative).
        // Chunk origin is at `nextChunkZ` (Start). End is `nextChunkZ - chunkLength`.
        // So local -chunkLength / 2 is center. -chunkLength is end.
        // Plane is center.
        // If chunk.z = 0.
        // Floor is at 0. Covers +10 to -10.
        // My nextChunkZ decrements by 20.
        // So Chunk 0: +10 to -10.
        // Chunk 1: -10 to -30.
        // So the "End" of the chunk is at local z = -10.

        blockWall.position.set(0, this.wallHeight / 2, -this.chunkLength / 2);
        blockWall.castShadow = true;
        chunk.add(blockWall);

        // Neon Warning on Wall (Arrow)
        // REPLACED with Text Sign
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 512, 128);
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TURN  <  >', 256, 64);

        const textTex = new THREE.CanvasTexture(canvas);
        const textMat = new THREE.MeshBasicMaterial({ map: textTex });
        const signGeo = new THREE.PlaneGeometry(8, 2);
        const sign = new THREE.Mesh(signGeo, textMat);
        sign.position.set(0, 5, -this.chunkLength / 2 + 0.6); // On the wall
        chunk.add(sign);

        // Grid (Red Warning)

        // Corners (Pillars) at start to frame the junction
        const pillarGeo = new THREE.BoxGeometry(1.5, this.wallHeight, 1.5);
        const lPillar = new THREE.Mesh(pillarGeo, this.mats.wall);
        lPillar.position.set(-this.chunkWidth / 2 - 1, this.wallHeight / 2, this.chunkLength / 2);
        chunk.add(lPillar);

        const rPillar = new THREE.Mesh(pillarGeo, this.mats.wall);
        rPillar.position.set(this.chunkWidth / 2 + 1, this.wallHeight / 2, this.chunkLength / 2);
        chunk.add(rPillar);

        // Store
        this.chunks.push({
            mesh: chunk,
            z: this.nextChunkZ,
            type: "JUNCTION" // Mark for Game Logic
        });

        // Advance
        this.nextChunkZ -= this.chunkLength;
    }

    spawnChunk() {
        const chunk = new THREE.Group();
        chunk.position.z = this.nextChunkZ;
        this.scene.add(chunk);

        // 1. FLOOR (With Grid)
        const floorGeo = new THREE.PlaneGeometry(this.chunkWidth, this.chunkLength);
        const floor = new THREE.Mesh(floorGeo, this.mats.floor);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        chunk.add(floor);

        // Floor Grid (Tron style)
        const grid = new THREE.GridHelper(this.chunkWidth, 4, 0x00AABB, 0x111111);
        grid.position.y = 0.05; // Slightly above floor to avoid z-fighting
        grid.position.z = -this.chunkLength / 2; // Center it (GridHelper is centered)
        // Wait, GridHelper size is square? We need rectangular. 
        // GridHelper(size, divisions). Size is length of side.
        // Let's scale it.
        grid.scale.z = this.chunkLength / this.chunkWidth;
        // Actually, easiest to just make a grid that covers the chunk.
        // Or just use texture... sticking to GridHelper for now.
        // Let's try simple GridHelper but positioned carefully.
        const gridHelper = new THREE.GridHelper(this.chunkWidth, 7, 0x00ffff, 0x222222);
        gridHelper.scale.z = this.chunkLength / this.chunkWidth;
        gridHelper.position.y = 0.02;
        chunk.add(gridHelper);


        // 2. WALLS (Left & Right) with PILLARS
        const wallGeo = new THREE.BoxGeometry(1, this.wallHeight, this.chunkLength);
        const pillarGeo = new THREE.BoxGeometry(1.5, this.wallHeight + 1, 2);
        const pillarNeonGeo = new THREE.BoxGeometry(1.6, this.wallHeight, 0.2);

        // Helper to build a wall side
        const createWallSide = (xPos) => {
            // Main Wall Plate
            const wall = new THREE.Mesh(wallGeo, this.mats.wall);
            wall.position.set(xPos, this.wallHeight / 2, 0);
            wall.castShadow = true;
            wall.receiveShadow = true;
            chunk.add(wall);

            // Pillar (At the end of the chunk to hide seams)
            // Positioned at z = -chunkLength/2 ? No, PlaneGeometry is centered at 0,0 locally?
            // PlaneGeometry(width, height) -> Centered at 0.
            // My chunk logic: nextChunkZ is the start?
            // "chunk.position.z = this.nextChunkZ".
            // Objects added to chunk are relative.
            // floor is centered at 0? No, default plane is centered.
            // So floor goes from +Length/2 to -Length/2 relative to chunk center.
            // My chunks overlap? 
            // "this.nextChunkZ -= this.chunkLength".
            // If I place chunk at 0. Next at -20.
            // Chunk 0 covers -10 to +10? 
            // If so, gaps might appear if not perfect.
            // Let's assume standard behavior.

            const pillar = new THREE.Mesh(pillarGeo, this.mats.wall);
            pillar.position.set(xPos, this.wallHeight / 2, this.chunkLength / 2); // At the "Start" (User side)
            chunk.add(pillar);

            // Vertical Neon on Pillar
            const vNeon = new THREE.Mesh(pillarNeonGeo, this.mats.neon);
            vNeon.position.set(xPos, this.wallHeight / 2, this.chunkLength / 2);
            chunk.add(vNeon);

            // Top Neon Trim (Running along wall)
            const trimGeo = new THREE.BoxGeometry(0.5, 0.2, this.chunkLength);
            const trim = new THREE.Mesh(trimGeo, this.mats.neon);
            const sideOffset = (xPos > 0) ? -0.5 : 0.5; // Inner side
            trim.position.set(xPos + sideOffset, 4, 0); // Eye level trim? Height 4.
            chunk.add(trim);

            // High trim
            const highTrim = new THREE.Mesh(trimGeo, this.mats.neon);
            highTrim.position.set(xPos + sideOffset, this.wallHeight - 1, 0);
            chunk.add(highTrim);
        };

        createWallSide(-this.chunkWidth / 2 - 0.5); // Left
        createWallSide(this.chunkWidth / 2 + 0.5);  // Right

        // Store
        this.chunks.push({
            mesh: chunk,
            z: this.nextChunkZ
        });

        // Advance (-Z direction)
        this.nextChunkZ -= this.chunkLength;
    }

    update(playerZ) {
        // Player moves in -Z. 
        // We want ensure chunks exist ahead of player (more negative Z).

        // Find the Z of the last chunk generated
        const lastChunkZ = this.nextChunkZ + this.chunkLength;

        // Generating ahead
        // If player is within 'renderDistance * chunkLength' of the end
        // Actually simpler: Just keep a buffer of chunks ahead relative to player

        const bufferDistance = this.chunkLength * (this.renderDistance - 2);

        // If playerZ is getting closer to nextChunkZ than the buffer...
        if (playerZ < this.nextChunkZ + bufferDistance) {
            this.spawnSequence();
            this.removeOldChunks(playerZ);
        }
    }

    removeOldChunks(playerZ) {
        // Remove chunks that are far behind the player (+Z direction)
        // Keep 2 chunks behind
        const cleanupThreshold = playerZ + (this.chunkLength * 2);

        // Filter in place
        // Chunks are ordered from 0 downwards. 0 is "Behind" if we walked far (-100).
        // Actually, 0 is the start. -20, -40...
        // If player is at -100.
        // Chunk at 0 is at +100 relative to player. WAY BEHIND.

        // We want to keep chunks where z < cleanupThreshold
        // Wait, Z decreases. 
        // 0 (Start) > -20 > -40.
        // Player at -100.
        // Threshold = -100 + 40 = -60.
        // Chunk at 0 > -60. Remove.
        // Chunk at -60 == -60. Keep?

        // We need to iterate and remove
        // But Chunks list is [0, -20, -40...]
        // The OLDEST spawn (Highest Z) is at index 0.

        if (this.chunks.length > 0) {
            const oldestChunk = this.chunks[0];
            if (oldestChunk.z > cleanupThreshold) {
                // Remove
                this.scene.remove(oldestChunk.mesh);
                this.chunks.shift(); // Remove first element
            }
        }
    }
}
