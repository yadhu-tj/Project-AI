import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

export class CharacterFactory {
    static create(scene) {
        const group = new THREE.Group();
        scene.add(group);

        // Materials
        const armorMat = new THREE.MeshStandardMaterial({
            color: 0xDDDDDD, // Silver/White for visibility
            roughness: 0.2,
            metalness: 0.8
        });
        const jointMat = new THREE.MeshStandardMaterial({ color: 0x555555 });

        // --- TORSO (Body) ---
        // Main Block
        const torsoGeo = new THREE.BoxGeometry(0.4, 0.6, 0.25);
        const torso = new THREE.Mesh(torsoGeo, armorMat);
        torso.position.y = 1.1;
        torso.castShadow = true;
        group.add(torso);

        // --- STYLING: CYBER-SPINE & BACKPACK (Backside) ---
        // A. Cyber Spine
        const spineGeo = new THREE.BoxGeometry(0.12, 0.55, 0.05);
        const spineMat = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.3,
            metalness: 0.8
        });
        const spine = new THREE.Mesh(spineGeo, spineMat);
        spine.position.set(0, 0, 0.15);
        spine.castShadow = true;
        torso.add(spine);

        // B. Neon Core
        const neonGeo = new THREE.BoxGeometry(0.04, 0.45, 0.02);
        const neonMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 2.0
        });
        const neon = new THREE.Mesh(neonGeo, neonMat);
        neon.position.set(0, 0, 0.03);
        spine.add(neon);

        // C. Upper Back Vents
        const ventGeo = new THREE.BoxGeometry(0.1, 0.15, 0.1);
        const ventLeft = new THREE.Mesh(ventGeo, spineMat);
        ventLeft.position.set(-0.12, 0.15, 0.12);
        torso.add(ventLeft);

        const ventRight = new THREE.Mesh(ventGeo, spineMat);
        ventRight.position.set(0.12, 0.15, 0.12);
        torso.add(ventRight);

        // D. Lower Power Unit
        const powerGeo = new THREE.BoxGeometry(0.3, 0.1, 0.08);
        const powerUnit = new THREE.Mesh(powerGeo, spineMat);
        powerUnit.position.set(0, -0.2, 0.16);
        torso.add(powerUnit);

        // --- HEAD ---
        const headGroup = new THREE.Group();
        headGroup.position.y = 0.6;
        torso.add(headGroup);

        const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.45), armorMat);
        headGroup.add(headMesh);

        // --- ARMS ---
        const createArm = (isLeft) => {
            const side = isLeft ? -1 : 1;
            const shoulder = new THREE.Group();
            shoulder.position.set(side * 0.4, 0.35, 0);
            torso.add(shoulder);

            const shoulderMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12), jointMat);
            shoulder.add(shoulderMesh);

            const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), armorMat);
            upperArm.position.y = -0.3;
            shoulder.add(upperArm);

            const elbow = new THREE.Group();
            elbow.position.y = -0.3;
            upperArm.add(elbow);

            const elbowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1), jointMat);
            elbow.add(elbowMesh);

            const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), armorMat);
            forearm.position.y = -0.3;
            elbow.add(forearm);

            const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.12), jointMat);
            hand.position.y = -0.35;
            forearm.add(hand);

            return { shoulder, elbow };
        };

        const leftArm = createArm(true);
        const rightArm = createArm(false);

        // --- LEGS ---
        const createLeg = (isLeft) => {
            const side = isLeft ? -1 : 1;
            const hip = new THREE.Group();
            hip.position.set(side * 0.2, -0.45, 0);
            torso.add(hip);

            const hipMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12), jointMat);
            hip.add(hipMesh);

            const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), armorMat);
            thigh.position.y = -0.35;
            hip.add(thigh);

            const knee = new THREE.Group();
            knee.position.y = -0.35;
            thigh.add(knee);

            const kneeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11), jointMat);
            knee.add(kneeMesh);

            const shin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.15), armorMat);
            shin.position.y = -0.35;
            knee.add(shin);

            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.25), jointMat);
            foot.position.set(0, -0.4, -0.05);
            shin.add(foot);

            return { hip, knee };
        };

        const leftLeg = createLeg(true);
        const rightLeg = createLeg(false);

        return {
            group,
            torso,
            headGroup,
            leftArm,
            rightArm,
            leftLeg,
            rightLeg
        };
    }
}
