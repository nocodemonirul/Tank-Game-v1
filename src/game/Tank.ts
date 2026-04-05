import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from './InputManager';

export class Tank {
  group: THREE.Group;
  turret: THREE.Group;
  barrel: THREE.Group;
  muzzleFlash: THREE.PointLight;
  muzzleMesh: THREE.Mesh;
  
  wheelsL: THREE.Mesh[] = [];
  wheelsR: THREE.Mesh[] = [];
  
  particles: THREE.InstancedMesh;
  particleData: any[] = [];
  
  position: THREE.Vector3;
  rotation: number = 0;
  velocity: THREE.Vector3;
  body: CANNON.Body;
  world: CANNON.World;
  scene: THREE.Scene;
  
  projectiles: { mesh: THREE.Mesh, body: CANNON.Body, life: number }[] = [];
  
  recoil: number = 0;
  
  hullMaterial: THREE.MeshPhysicalMaterial;
  trackMaterial: THREE.MeshPhysicalMaterial;
  metalMaterial: THREE.MeshPhysicalMaterial;

  constructor(scene: THREE.Scene, world: CANNON.World) {
    this.world = world;
    this.scene = scene;
    this.group = new THREE.Group();
    this.position = new THREE.Vector3(0, 0, -10);
    this.velocity = new THREE.Vector3();
    this.group.position.copy(this.position);

    // Physics Body
    const tankShape = new CANNON.Box(new CANNON.Vec3(1.6, 0.7, 2.75));
    this.body = new CANNON.Body({
      mass: 5000,
      shape: tankShape,
      position: new CANNON.Vec3(0, 2, -10),
    });
    world.addBody(this.body);

    this.hullMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x3a4a23,
      metalness: 0.7,
      roughness: 0.4,
      clearcoat: 0.2,
      clearcoatRoughness: 0.3,
    });

    this.trackMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x111111,
      metalness: 0.4,
      roughness: 0.8,
    });

    this.metalMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x222222,
      metalness: 0.9,
      roughness: 0.3,
      clearcoat: 0.5,
    });

    this.turret = new THREE.Group();
    this.barrel = new THREE.Group();
    
    this.muzzleFlash = new THREE.PointLight(0xffaa00, 0, 20);
    this.muzzleMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 })
    );
    this.muzzleMesh.visible = false;

    this.particles = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.3 }),
      20
    );
    for (let i = 0; i < 20; i++) {
      this.particleData.push({ life: 0, maxLife: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), scale: 0 });
    }

    this.buildMesh();
    scene.add(this.group);
  }

  buildMesh() {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 5.5), this.hullMaterial);
    hull.position.y = 1.0;
    hull.castShadow = true;
    hull.receiveShadow = true;
    this.group.add(hull);

    const trackL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 6.0), this.trackMaterial);
    trackL.position.set(-1.9, 0.6, 0);
    trackL.castShadow = true;
    trackL.receiveShadow = true;
    this.group.add(trackL);

    const trackR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 6.0), this.trackMaterial);
    trackR.position.set(1.9, 0.6, 0);
    trackR.castShadow = true;
    trackR.receiveShadow = true;
    this.group.add(trackR);

    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.9, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    
    for (let i = 0; i < 6; i++) {
      const z = -2.2 + i * 0.88;
      const wheelL = new THREE.Mesh(wheelGeo, this.metalMaterial);
      wheelL.position.set(-1.9, 0.4, z);
      wheelL.castShadow = true;
      this.group.add(wheelL);
      this.wheelsL.push(wheelL);

      const wheelR = new THREE.Mesh(wheelGeo, this.metalMaterial);
      wheelR.position.set(1.9, 0.4, z);
      wheelR.castShadow = true;
      this.group.add(wheelR);
      this.wheelsR.push(wheelR);
    }

    this.turret.position.set(0, 1.8, -0.5);
    this.group.add(this.turret);

    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.0, 16), this.hullMaterial);
    turretBase.castShadow = true;
    turretBase.receiveShadow = true;
    this.turret.add(turretBase);

    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16), this.metalMaterial);
    hatch.position.set(0, 0.55, 0.5);
    hatch.castShadow = true;
    this.turret.add(hatch);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.0, 8), this.metalMaterial);
    antenna.position.set(-0.8, 1.5, 0.8);
    antenna.castShadow = true;
    this.turret.add(antenna);

    const exhaust = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.4), this.metalMaterial);
    exhaust.position.set(0, 0.5, 2.8);
    exhaust.castShadow = true;
    this.group.add(exhaust);

    this.barrel.position.set(0, 0, -1.4);
    this.turret.add(this.barrel);

    const mantlet = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.0), this.hullMaterial);
    mantlet.castShadow = true;
    this.barrel.add(mantlet);

    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 4.0, 16), this.metalMaterial);
    gun.rotation.x = Math.PI / 2;
    gun.position.z = -2.0;
    gun.castShadow = true;
    this.barrel.add(gun);

    this.muzzleFlash.position.set(0, 0, -4.5);
    this.muzzleMesh.position.set(0, 0, -4.5);
    this.barrel.add(this.muzzleFlash);
    this.barrel.add(this.muzzleMesh);
    
    this.group.add(this.particles);
  }

  updateMovement(delta: number, input: InputManager) {
    const speed = 10;
    const turnSpeed = 1.5;

    let moveZ = 0;
    if (input.keys['KeyW'] || input.keys['ArrowUp']) moveZ -= 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) moveZ += 1;

    let turnY = 0;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) turnY += 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) turnY -= 1;

    // Apply forces/velocity to physics body
    const localForward = new CANNON.Vec3(0, 0, moveZ);
    const forward = new CANNON.Vec3();
    this.body.quaternion.vmult(localForward, forward);
    
    const targetVelX = forward.x * speed;
    const targetVelZ = forward.z * speed;

    this.body.velocity.x = THREE.MathUtils.damp(this.body.velocity.x, targetVelX, 10, delta);
    this.body.velocity.z = THREE.MathUtils.damp(this.body.velocity.z, targetVelZ, 10, delta);

    if (moveZ !== 0) {
      this.body.angularVelocity.y = turnY * turnSpeed * (moveZ < 0 ? 1 : -1);
    } else {
      this.body.angularVelocity.y = THREE.MathUtils.damp(this.body.angularVelocity.y, turnY * turnSpeed, 10, delta);
    }
  }

  updateVisuals(delta: number, input: InputManager, camera: THREE.PerspectiveCamera | null) {
    // Sync position and rotation
    this.position.set(this.body.position.x, this.body.position.y - 0.7, this.body.position.z);
    this.group.position.copy(this.position);
    this.group.quaternion.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);
    
    // Extract Y rotation for turret logic
    const euler = new THREE.Euler().setFromQuaternion(this.group.quaternion, 'YXZ');
    this.rotation = euler.y;

    let moveZ = 0;
    if (input.keys['KeyW'] || input.keys['ArrowUp']) moveZ -= 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) moveZ += 1;
    let turnY = 0;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) turnY += 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) turnY -= 1;

    const speed = 10;
    const wheelRot = (moveZ * speed * delta) / 0.4;
    this.wheelsL.forEach(w => w.rotation.x -= wheelRot + (turnY * 0.05));
    this.wheelsR.forEach(w => w.rotation.x -= wheelRot - (turnY * 0.05));

    let targetTurretYaw = input.mouseX - this.rotation;
    while (targetTurretYaw > Math.PI) targetTurretYaw -= Math.PI * 2;
    while (targetTurretYaw < -Math.PI) targetTurretYaw += Math.PI * 2;
    
    this.turret.rotation.y = THREE.MathUtils.damp(this.turret.rotation.y, targetTurretYaw, 10, delta);
    this.barrel.rotation.x = THREE.MathUtils.damp(this.barrel.rotation.x, input.mouseY, 10, delta);

    if (input.mouseDown && this.recoil <= 0) {
      this.recoil = 1.0;
      this.shoot();
    }

    if (this.recoil > 0) {
      this.recoil -= delta * 5;
      this.barrel.position.z = -1.4 + (this.recoil > 0 ? this.recoil * 0.5 : 0);
      
      const isFlashing = this.recoil > 0.8;
      this.muzzleFlash.intensity = isFlashing ? 10 : 0;
      this.muzzleMesh.visible = isFlashing;
      if (isFlashing) {
        const scale = 1 + Math.random() * 0.5;
        this.muzzleMesh.scale.set(scale, scale, scale);
        this.muzzleMesh.rotation.z = Math.random() * Math.PI;
      }
    } else {
      this.muzzleFlash.intensity = 0;
      this.muzzleMesh.visible = false;
      this.barrel.position.z = -1.4;
    }

    const isMoving = moveZ !== 0 || turnY !== 0;
    const dummy = new THREE.Object3D();
    this.particleData.forEach((p, i) => {
      p.life -= delta;
      if (p.life <= 0 && isMoving) {
        p.life = p.maxLife = 0.5 + Math.random() * 0.5;
        const isLeft = Math.random() > 0.5;
        p.pos.set(isLeft ? -1 : 1, 1.4, 2.8);
        p.vel.set((Math.random() - 0.5) * 0.5, 1 + Math.random(), (Math.random() - 0.5) * 0.5);
        p.scale = 0.1 + Math.random() * 0.2;
      } else if (p.life <= 0 && !isMoving && Math.random() < 0.1) {
        // Idle exhaust smoke
        p.life = p.maxLife = 1.0 + Math.random() * 1.0;
        p.pos.set((Math.random() - 0.5) * 0.5, 0.8, 2.8);
        p.vel.set((Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.2);
        p.scale = 0.2 + Math.random() * 0.2;
      }
      
      if (p.life > 0) {
        p.pos.addScaledVector(p.vel, delta);
        p.scale += delta * 0.5;
        dummy.position.copy(p.pos);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        this.particles.setMatrixAt(i, dummy.matrix);
      } else {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.particles.setMatrixAt(i, dummy.matrix);
      }
    });
    this.particles.instanceMatrix.needsUpdate = true;

    if (camera) {
      const target = this.position.clone().add(new THREE.Vector3(0, 3, 0));
      const dist = 10;
      const camX = target.x + dist * Math.cos(input.mouseY) * Math.sin(input.mouseX);
      const camY = target.y + dist * Math.sin(input.mouseY);
      const camZ = target.z + dist * Math.cos(input.mouseY) * Math.cos(input.mouseX);
      
      camera.position.set(camX, camY, camZ);
      camera.lookAt(target);
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;
      
      p.mesh.position.copy(p.body.position as unknown as THREE.Vector3);
      p.mesh.quaternion.copy(p.body.quaternion as unknown as THREE.Quaternion);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.world.removeBody(p.body);
        this.projectiles.splice(i, 1);
      }
    }

    // Update explosions
    if ((this as any).explosions) {
      for (let i = (this as any).explosions.length - 1; i >= 0; i--) {
        const exp = (this as any).explosions[i];
        exp.life -= delta;
        exp.mesh.scale.addScalar(delta * 10);
        exp.mesh.material.opacity = exp.life / 0.5;
        
        if (exp.life <= 0) {
          this.scene.remove(exp.mesh);
          (this as any).explosions.splice(i, 1);
        }
      }
    }
  }

  shoot() {
    const projectileGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const projectileMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const mesh = new THREE.Mesh(projectileGeo, projectileMat);
    
    // Get world position and direction of the barrel tip
    const barrelTip = new THREE.Vector3(0, 0, -4.5);
    barrelTip.applyMatrix4(this.barrel.matrixWorld);
    
    const direction = new THREE.Vector3(0, 0, -1);
    direction.transformDirection(this.barrel.matrixWorld);

    mesh.position.copy(barrelTip);
    this.scene.add(mesh);

    const shape = new CANNON.Sphere(0.2);
    const body = new CANNON.Body({
      mass: 10,
      shape: shape,
      position: new CANNON.Vec3(barrelTip.x, barrelTip.y, barrelTip.z),
    });
    
    const speed = 100;
    body.velocity.set(direction.x * speed, direction.y * speed, direction.z * speed);
    
    this.world.addBody(body);
    
    const projectileObj = { mesh, body, life: 3.0 };
    this.projectiles.push(projectileObj);

    // Collision event
    body.addEventListener("collide", (e: any) => {
      // Create explosion effect
      this.createExplosion(body.position.x, body.position.y, body.position.z);
      
      // Remove projectile on next frame
      projectileObj.life = 0;
    });
    
    // Apply recoil force to tank
    const recoilForce = new CANNON.Vec3(-direction.x * 50000, -direction.y * 50000, -direction.z * 50000);
    this.body.applyImpulse(recoilForce, new CANNON.Vec3(0, 0, 0));
  }

  createExplosion(x: number, y: number, z: number) {
    // Visual explosion
    const geo = new THREE.SphereGeometry(1, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    const explosionObj = { mesh, life: 0.5 };
    
    // We can add it to a list of explosions to animate
    if (!(this as any).explosions) {
      (this as any).explosions = [];
    }
    (this as any).explosions.push(explosionObj);

    // Apply explosion force to nearby bodies
    const explosionPos = new CANNON.Vec3(x, y, z);
    const explosionRadius = 10;
    const explosionForce = 5000;

    for (const body of this.world.bodies) {
      if (body.type === CANNON.Body.DYNAMIC && body !== this.body) {
        const distance = body.position.distanceTo(explosionPos);
        if (distance < explosionRadius) {
          const forceDir = body.position.vsub(explosionPos);
          forceDir.normalize();
          const forceMultiplier = 1 - (distance / explosionRadius);
          const force = forceDir.scale(explosionForce * forceMultiplier);
          body.applyImpulse(force, body.position);
        }
      }
    }
  }
}
