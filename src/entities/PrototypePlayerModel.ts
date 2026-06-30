import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AvatarLoadout } from '../types/shared';

export type Direction = 'down' | 'up' | 'left' | 'right';
const DEFAULT_MODEL_PATH = '/assets/prototype/mmd/korone_256fes/inugami_korone_for_256fes.glb';

export class PrototypePlayerModel extends THREE.Group {
  private loader = new GLTFLoader();
  private modelRoot: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private currentAction: THREE.AnimationAction | null = null;
  private targetHeight = 208;
  private rotationOffsetY = 0;

  constructor(public userId: string, displayName: string, _avatar: AvatarLoadout) {
    super();
    this.addShadow();
    const label = this.createLabel(displayName || 'Orange');
    label.position.set(0, this.targetHeight + 10, 0);
    this.add(label);
    void this.loadModel(DEFAULT_MODEL_PATH);
  }

  update(moving: boolean, _avatar: AvatarLoadout, dt: number, direction?: Direction): void {
    if (direction) this.faceDirection(direction);
    if (this.mixer) this.mixer.update(dt);
    const wanted = moving ? this.walkAction : this.idleAction;
    if (wanted && wanted !== this.currentAction) {
      this.currentAction?.fadeOut(0.12);
      wanted.reset().fadeIn(0.12).play();
      this.currentAction = wanted;
    }
    if (!this.mixer && this.modelRoot) {
      const t = performance.now() / 1000;
      this.modelRoot.position.y = Math.sin(t * (moving ? 12 : 3)) * (moving ? 1.1 : 0.3);
    }
  }

  private async loadModel(path: string): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(path);
      const root = gltf.scene;
      this.modelRoot = root;
      root.traverse((object) => this.prepareObject(object));
      this.normalizeModel(root);
      this.add(root);
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
      console.warn(`Prototype GLB failed to load: ${path}. Using fallback box.`, error);
      this.addFallbackBox();
    }
  }

  private prepareObject(object: THREE.Object3D): void {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const converted = sourceMaterials.map((material) => {
      const m = material as any;
      const map = m?.map ?? null;
      if (map) {
        map.magFilter = THREE.NearestFilter;
        map.minFilter = THREE.NearestFilter;
        map.generateMipmaps = false;
        map.colorSpace = THREE.SRGBColorSpace;
        map.needsUpdate = true;
      }
      return new THREE.MeshBasicMaterial({
        map,
        color: m?.color instanceof THREE.Color ? m.color : new THREE.Color(0xffffff),
        transparent: Boolean(m?.transparent),
        opacity: typeof m?.opacity === 'number' ? m.opacity : 1,
        alphaTest: 0.01,
        side: THREE.FrontSide
      });
    });
    mesh.material = Array.isArray(mesh.material) ? converted : converted[0];
  }

  private normalizeModel(root: THREE.Object3D): void {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = this.targetHeight / Math.max(1, size.y);
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);
    const scaled = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    scaled.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= scaled.min.y;
  }

  private faceDirection(direction: Direction): void {
    const angles: Record<Direction, number> = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };
    this.rotation.y = angles[direction] + this.rotationOffsetY;
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
    const body = new THREE.Mesh(new THREE.BoxGeometry(18, 36, 10), new THREE.MeshBasicMaterial({ color: 0x5fd8ff }));
    body.position.y = 18;
    const head = new THREE.Mesh(new THREE.BoxGeometry(22, 18, 14), new THREE.MeshBasicMaterial({ color: 0xffd6c7 }));
    head.position.y = 45;
    group.add(body, head);
    this.modelRoot = group;
    this.add(group);
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
