import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface RotatingWorldModelOptions {
  path: string;
  targetHeight: number;
  spinSpeed?: number;
  yOffset?: number;
  name?: string;
}

export class RotatingWorldModel extends THREE.Group {
  private loader = new GLTFLoader();
  private root: THREE.Group | null = null;
  private spinSpeed: number;
  private targetHeight: number;
  private yOffset: number;

  constructor(options: RotatingWorldModelOptions) {
    super();
    this.name = options.name ?? 'RotatingWorldModel';
    this.spinSpeed = options.spinSpeed ?? 0.8;
    this.targetHeight = options.targetHeight;
    this.yOffset = options.yOffset ?? 0;
    void this.load(options.path);
  }

  update(dt: number): void {
    this.rotation.y += this.spinSpeed * dt;
  }

  private async load(path: string): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(path);
      const root = gltf.scene;
      this.root = root;
      root.traverse((object) => this.prepareObject(object));
      this.normalize(root);
      this.add(root);
    } catch (error) {
      console.warn(`Failed to load rotating world model: ${path}`, error);
      this.addFallbackCrystal();
    }
  }

  private prepareObject(object: THREE.Object3D): void {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;

    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const converted = sourceMaterials.map((material) => {
      const anyMaterial = material as any;
      const map = anyMaterial?.map ?? null;
      if (map) {
        map.magFilter = THREE.NearestFilter;
        map.minFilter = THREE.NearestFilter;
        map.generateMipmaps = false;
        map.colorSpace = THREE.SRGBColorSpace;
        map.needsUpdate = true;
      }
      return new THREE.MeshBasicMaterial({
        map,
        color: anyMaterial?.color instanceof THREE.Color ? anyMaterial.color : new THREE.Color(0xffffff),
        transparent: Boolean(anyMaterial?.transparent),
        opacity: typeof anyMaterial?.opacity === 'number' ? anyMaterial.opacity : 1,
        alphaTest: 0.01,
        side: THREE.FrontSide
      });
    });

    mesh.material = Array.isArray(mesh.material) ? converted : converted[0];
  }

  private normalize(root: THREE.Object3D): void {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    root.scale.setScalar(this.targetHeight / Math.max(1, size.y));

    root.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y += -scaledBox.min.y + this.yOffset;
  }

  private addFallbackCrystal(): void {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(this.targetHeight / 2, 0),
      new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.9 })
    );
    mesh.position.y = this.targetHeight / 2 + this.yOffset;
    this.root = new THREE.Group();
    this.root.add(mesh);
    this.add(this.root);
  }
}
