import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AvatarLoadout } from '../types/shared';

export type Direction = 'down' | 'up' | 'left' | 'right';
const DEFAULT_MODEL_PATH = '/assets/prototype/mmd/korone_256fes/inugami_korone_for_256fes.glb';

/**
 * PrototypePlayerModel
 *
 * HD-2D cardinal avatar prototype:
 * - turns down/up/left/right like Earthmover
 * - uses direction-aware flattening so side views do not collapse into a line
 * - uses MeshBasicMaterial with a controlled tint so lighting does not make one
 *   direction much darker than another
 *
 * This avoids the previous Phong-material problem where the avatar became much
 * darker depending on direction/animation normals.
 */
export class PrototypePlayerModel extends THREE.Group {
  private loader = new GLTFLoader();
  private modelRoot: THREE.Group | null = null;
  private visualRoot = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private currentAction: THREE.AnimationAction | null = null;
  private targetHeight = 208;
  private rotationOffsetY = 0;

  // Lower = flatter. 0.28 keeps enough side read while still reducing obvious 3D bulk.
  private readonly hd2dDepthScale = 0.28;
  private baseModelScale = 1;
  private currentDirection: Direction = 'down';

  // MeshBasic ignores directional lights, so this tint controls avatar brightness consistently.
  // Increase toward 1.0 if too dark; decrease toward 0.75 if too bright.
  private readonly avatarTint = 0.86;

  constructor(public userId: string, displayName: string, _avatar: AvatarLoadout) {
    super();
    this.name = 'PrototypePlayerModel_HD2D_Cardinal_StillCameraDebug';
    this.visualRoot.name = 'HD2DCardinalBasicTintAvatarVisualRoot';
    this.addShadow();
    this.add(this.visualRoot);

    const label = this.createLabel(displayName || 'Orange');
    label.position.set(0, this.targetHeight + 10, 0);
    this.add(label);
    void this.loadModel(DEFAULT_MODEL_PATH);
  }

  update(moving: boolean, _avatar: AvatarLoadout, dt: number, direction?: Direction): void {
    if (direction) this.faceDirection(direction);

    // Stand perfectly still when not moving. No idle animation, no bobbing,
    // no mixer updates. This keeps the HD-2D avatar from shimmering while idle.
    if (!moving) {
      if (this.walkAction) this.walkAction.paused = true;
      if (this.idleAction) {
        if (this.currentAction !== this.idleAction) {
          this.currentAction?.stop();
          this.idleAction.reset().play();
          this.currentAction = this.idleAction;
        }
        this.idleAction.paused = true;
        this.idleAction.time = 0;
      }
      if (this.modelRoot) this.modelRoot.position.y = 0;
      return;
    }

    if (this.walkAction) {
      if (this.currentAction !== this.walkAction) {
        this.currentAction?.stop();
        this.walkAction.reset().play();
        this.currentAction = this.walkAction;
      }
      this.walkAction.paused = false;
    }

    if (this.mixer) this.mixer.update(dt);
    else if (this.modelRoot) {
      const t = performance.now() / 1000;
      this.modelRoot.position.y = Math.sin(t * 12) * 1.1;
    }
  }

  /** Compatibility hook for older ThreeGame patches that call player.faceCamera(). */
  faceCamera(_camera: THREE.Camera): void {
    // Intentionally empty. This avatar should face only down/up/left/right.
  }

  private async loadModel(path: string): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(path);
      const root = gltf.scene;
      this.modelRoot = root;
      root.traverse((object) => this.prepareObject(object));
      this.normalizeModelOnce(root);
      this.visualRoot.add(root);
      this.faceDirection(this.currentDirection);

      if (gltf.animations.length) {
        this.mixer = new THREE.AnimationMixer(root);
        const names = gltf.animations.map((clip) => clip.name.toLowerCase());
        const walkIndex = names.findIndex((name) => name.includes('walk') || name.includes('run'));
        const idleIndex = names.findIndex((name) => name.includes('idle') || name.includes('stand'));
        this.walkAction = this.mixer.clipAction(gltf.animations[walkIndex >= 0 ? walkIndex : 0]);
        this.idleAction = this.mixer.clipAction(gltf.animations[idleIndex >= 0 ? idleIndex : 0]);
        this.currentAction = this.idleAction;
        this.currentAction.play();
      }
    } catch (error) {
      console.warn(`Prototype GLB failed to load: ${path}. Using fallback flat card.`, error);
      this.addFallbackBox();
    }
  }

  private prepareObject(object: THREE.Object3D): void {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const converted = sourceMaterials.map((material) => this.toCardinalAvatarMaterial(material as any));
    mesh.material = Array.isArray(mesh.material) ? converted : converted[0];
  }

  private toCardinalAvatarMaterial(source: any): THREE.MeshBasicMaterial {
    const map = source?.map ?? null;
    if (map) {
      map.magFilter = THREE.NearestFilter;
      map.minFilter = THREE.NearestFilter;
      map.generateMipmaps = false;
      map.colorSpace = THREE.SRGBColorSpace;
    }

    const sourceColor = source?.color instanceof THREE.Color ? source.color.clone() : new THREE.Color(0xffffff);
    const tintColor = sourceColor.multiplyScalar(this.avatarTint);

    return new THREE.MeshBasicMaterial({
      map,
      color: tintColor,
      transparent: Boolean(source?.transparent),
      opacity: typeof source?.opacity === 'number' ? source.opacity : 1,
      alphaTest: 0.02,
      side: THREE.DoubleSide,
      depthWrite: true
    });
  }

  private normalizeModelOnce(root: THREE.Object3D): void {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    this.baseModelScale = this.targetHeight / Math.max(1, size.y);

    root.scale.setScalar(this.baseModelScale);
    root.updateMatrixWorld(true);

    const scaled = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    scaled.getCenter(center);

    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= scaled.min.y;

    this.applyDirectionAwareFlattening();
  }

  private applyDirectionAwareFlattening(): void {
    if (!this.modelRoot) return;
    const s = this.baseModelScale;

    // Front/back: local Z is model depth, compress Z.
    // Left/right: compress local X instead, otherwise side views become a line.
    if (this.currentDirection === 'left' || this.currentDirection === 'right') {
      this.modelRoot.scale.set(s * this.hd2dDepthScale, s, s);
    } else {
      this.modelRoot.scale.set(s, s, s * this.hd2dDepthScale);
    }
  }

  private faceDirection(direction: Direction): void {
    this.currentDirection = direction;

    const angles: Record<Direction, number> = {
      down: 0,
      up: Math.PI,
      left: -Math.PI / 2,
      right: Math.PI / 2
    };

    this.visualRoot.rotation.y = angles[direction] + this.rotationOffsetY;
    this.applyDirectionAwareFlattening();
  }

  private addShadow(): void {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(14, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1, 0.42, 1);
    shadow.position.y = 0.02;
    this.add(shadow);
  }

  private addFallbackBox(): void {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(18, 36, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5fd8ff).multiplyScalar(this.avatarTint) }));
    body.position.y = 18;
    const head = new THREE.Mesh(new THREE.BoxGeometry(22, 18, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd6c7).multiplyScalar(this.avatarTint) }));
    head.position.y = 45;
    group.add(body, head);
    this.modelRoot = group;
    this.baseModelScale = 1;
    this.visualRoot.add(group);
    this.faceDirection(this.currentDirection);
  }

  private createLabel(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = '700 11px sans-serif';
    canvas.width = Math.max(64, Math.ceil(ctx.measureText(text).width) + 12);
    canvas.height = 24;
    ctx.font = '700 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#fff';
    ctx.strokeText(text, canvas.width / 2, 12);
    ctx.fillText(text, canvas.width / 2, 12);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(canvas.width, canvas.height, 1);
    return sprite;
  }
}
