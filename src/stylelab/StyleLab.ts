import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type StyleMode = 1 | 2 | 3 | 4 | 5;

interface LoadedModel {
  root: THREE.Group;
  name: string;
  spinSpeed: number;
}

const MODEL_PATHS = {
  korone: '/assets/prototype/mmd/korone_256fes/inugami_korone_for_256fes.glb',
  crystal: '/assets/prototype/mmd/crystal/crystal.glb',
  shrine: '/assets/prototype/mmd/crystal_shrine/stylised_crystal_shrine.glb'
};

const canvas = document.querySelector<HTMLCanvasElement>('#stylelab-canvas');
if (!canvas) throw new Error('Missing #stylelab-canvas');

const modeLabel = document.querySelector<HTMLSpanElement>('#stylelab-mode');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x101827, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x93c5fd);

const camera = new THREE.OrthographicCamera(-420, 420, 240, -240, 0.1, 3000);
let cameraAngle = Math.PI / 4;
let cameraDistance = 920;
const cameraTarget = new THREE.Vector3(0, 30, 0);

const models: LoadedModel[] = [];
const labRoot = new THREE.Group();
scene.add(labRoot);

const ambient = new THREE.AmbientLight(0xffffff, 1.25);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff1b8, 0.75);
sun.position.set(350, 650, 420);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x9bdcff, 0.3);
fill.position.set(-400, 300, -300);
scene.add(fill);

let mode: StyleMode = 3;
let flatMaterialsEnabled = false;
let localOutlinesEnabled = true;
let postProcessEnabled = false;
let pixelUpscaleEnabled = false;

class StyleLabPostProcess {
  private colorTarget!: THREE.WebGLRenderTarget;
  private normalTarget!: THREE.WebGLRenderTarget;
  private depthTarget!: THREE.WebGLRenderTarget;
  private normalMaterial = new THREE.MeshNormalMaterial();
  private depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking });
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private width = 1;
  private height = 1;

  constructor(private pixelSize: number) {
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.createMaterial());
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.resize(window.innerWidth, window.innerHeight, pixelSize);
  }

  resize(width: number, height: number, pixelSize = this.pixelSize): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.pixelSize = pixelSize;
    const w = Math.max(1, Math.floor(this.width / this.pixelSize));
    const h = Math.max(1, Math.floor(this.height / this.pixelSize));
    this.colorTarget?.dispose();
    this.normalTarget?.dispose();
    this.depthTarget?.dispose();
    this.colorTarget = this.target(w, h, true);
    this.normalTarget = this.target(w, h, false);
    this.depthTarget = this.target(w, h, false);
    this.quad.material.uniforms.resolution.value.set(w, h, 1 / w, 1 / h);
  }

  render(): void {
    renderer.setRenderTarget(this.colorTarget);
    renderer.clear();
    renderer.render(scene, camera);

    const oldOverride = scene.overrideMaterial;
    scene.overrideMaterial = this.normalMaterial;
    renderer.setRenderTarget(this.normalTarget);
    renderer.clear();
    renderer.render(scene, camera);

    scene.overrideMaterial = this.depthMaterial;
    renderer.setRenderTarget(this.depthTarget);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = oldOverride;

    this.quad.material.uniforms.tColor.value = this.colorTarget.texture;
    this.quad.material.uniforms.tNormal.value = this.normalTarget.texture;
    this.quad.material.uniforms.tDepth.value = this.depthTarget.texture;
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(this.quadScene, this.quadCamera);
  }

  private target(width: number, height: number, depthBuffer: boolean): THREE.WebGLRenderTarget {
    const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer, stencilBuffer: false });
    target.texture.magFilter = THREE.NearestFilter;
    target.texture.minFilter = THREE.NearestFilter;
    target.texture.generateMipmaps = false;
    return target;
  }

  private createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tNormal: { value: null },
        tDepth: { value: null },
        resolution: { value: new THREE.Vector4(1, 1, 1, 1) },
        outlineColor: { value: new THREE.Color(0x182238) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tColor;
        uniform sampler2D tNormal;
        uniform sampler2D tDepth;
        uniform vec4 resolution;
        uniform vec3 outlineColor;
        varying vec2 vUv;

        float bayer4(vec2 p) {
          int x = int(mod(p.x, 4.0));
          int y = int(mod(p.y, 4.0));
          int i = x + y * 4;
          if (i == 0) return 0.0 / 16.0;
          if (i == 1) return 8.0 / 16.0;
          if (i == 2) return 2.0 / 16.0;
          if (i == 3) return 10.0 / 16.0;
          if (i == 4) return 12.0 / 16.0;
          if (i == 5) return 4.0 / 16.0;
          if (i == 6) return 14.0 / 16.0;
          if (i == 7) return 6.0 / 16.0;
          if (i == 8) return 3.0 / 16.0;
          if (i == 9) return 11.0 / 16.0;
          if (i == 10) return 1.0 / 16.0;
          if (i == 11) return 9.0 / 16.0;
          if (i == 12) return 15.0 / 16.0;
          if (i == 13) return 7.0 / 16.0;
          if (i == 14) return 13.0 / 16.0;
          return 5.0 / 16.0;
        }

        float depthAt(int x, int y) {
          return texture2D(tDepth, vUv + vec2(float(x), float(y)) * resolution.zw).r;
        }

        vec3 normalAt(int x, int y) {
          return texture2D(tNormal, vUv + vec2(float(x), float(y)) * resolution.zw).rgb * 2.0 - 1.0;
        }

        float edgeDepth() {
          float c = depthAt(0, 0);
          float d = 0.0;
          d += abs(c - depthAt(1, 0));
          d += abs(c - depthAt(-1, 0));
          d += abs(c - depthAt(0, 1));
          d += abs(c - depthAt(0, -1));
          return smoothstep(0.025, 0.07, d * 8.0);
        }

        float edgeNormal() {
          vec3 c = normalAt(0, 0);
          float n = 0.0;
          n += distance(c, normalAt(1, 0));
          n += distance(c, normalAt(-1, 0));
          n += distance(c, normalAt(0, 1));
          n += distance(c, normalAt(0, -1));
          return smoothstep(0.18, 0.42, n * 0.95);
        }

        vec3 quantize(vec3 color, float dither) {
          float levels = 7.0;
          color += (dither - 0.5) * 0.035;
          return floor(clamp(color, 0.0, 1.0) * levels + 0.5) / levels;
        }

        void main() {
          vec4 source = texture2D(tColor, vUv);
          float dither = bayer4(gl_FragCoord.xy);
          vec3 color = quantize(source.rgb, dither);
          float edge = clamp(max(edgeDepth(), edgeNormal() * 0.65), 0.0, 1.0);
          color = mix(color, outlineColor, edge * 0.55);
          gl_FragColor = vec4(color, source.a);
        }
      `
    });
  }
}

const post = new StyleLabPostProcess(2);

function makeGround(): void {
  const colors = [0x7bbf5b, 0x95d36c, 0xb7e887, 0x5b9f58, 0x416f6a];
  for (let i = 0; i < 42; i++) {
    const w = 80 + Math.random() * 80;
    const h = 40 + Math.random() * 80;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 8, h),
      new THREE.MeshBasicMaterial({ color: colors[i % colors.length] })
    );
    mesh.position.set((Math.random() - 0.5) * 760, -4, (Math.random() - 0.5) * 420);
    mesh.rotation.y = Math.round(Math.random() * 3) * Math.PI / 2;
    labRoot.add(mesh);
  }

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(860, 8, 520),
    new THREE.MeshBasicMaterial({ color: 0x6ba656 })
  );
  base.position.y = -10;
  labRoot.add(base);
}

function makeBlocks(): void {
  const colors = [0xb8aa90, 0x928676, 0x6c6872, 0xc7b99d];
  const positions = [
    [-280, 35, -130], [-250, 90, -130], [280, 50, -120], [310, 105, -120],
    [-350, 42, 125], [-320, 96, 125], [340, 36, 125], [365, 86, 125]
  ];
  positions.forEach((p, i) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(58, 70 + (i % 2) * 42, 58),
      new THREE.MeshBasicMaterial({ color: colors[i % colors.length] })
    );
    mesh.position.set(p[0], p[1], p[2]);
    addLocalOutline(mesh, 1.045, 0x1c2438);
    labRoot.add(mesh);
  });
}

async function loadModel(path: string, name: string, position: THREE.Vector3, targetHeight: number, spinSpeed = 0): Promise<void> {
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(path);
    const root = gltf.scene;
    root.name = name;
    root.traverse((object) => prepareMesh(object));
    normalize(root, targetHeight);
    root.position.copy(position);
    labRoot.add(root);
    models.push({ root, name, spinSpeed });
  } catch (error) {
    console.warn(`Failed to load ${path}`, error);
    const fallback = new THREE.Mesh(
      new THREE.OctahedronGeometry(targetHeight / 2, 0),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
    );
    fallback.position.copy(position).add(new THREE.Vector3(0, targetHeight / 2, 0));
    addLocalOutline(fallback, 1.08, 0x182238);
    labRoot.add(fallback);
  }
}

function prepareMesh(object: THREE.Object3D): void {
  const mesh = object as THREE.Mesh;
  if (!mesh.isMesh) return;
  mesh.frustumCulled = false;

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const converted = materials.map((source) => {
    const anyMaterial = source as any;
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
      alphaTest: 0.01
    });
  });
  mesh.material = Array.isArray(mesh.material) ? converted : converted[0];
  addLocalOutline(mesh, 1.035, 0x172033);
}

function addLocalOutline(mesh: THREE.Mesh, scale: number, color: THREE.ColorRepresentation): void {
  if (mesh.children.some((child) => child.name === 'stylelab_local_outline')) return;
  const outline = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
  );
  outline.name = 'stylelab_local_outline';
  outline.scale.setScalar(scale);
  outline.renderOrder = -1;
  mesh.add(outline);
}

function normalize(root: THREE.Object3D, targetHeight: number): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  root.scale.setScalar(targetHeight / Math.max(1, size.y));
  root.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  scaled.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= scaled.min.y;
}

function setFlatMaterialEnabled(enabled: boolean): void {
  flatMaterialsEnabled = enabled;
  labRoot.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as any;
    if (mat?.isMeshBasicMaterial) {
      mat.needsUpdate = true;
    }
  });
}

function setLocalOutlinesEnabled(enabled: boolean): void {
  localOutlinesEnabled = enabled;
  labRoot.traverse((object) => {
    if (object.name === 'stylelab_local_outline') object.visible = enabled;
  });
}

function applyMode(next: StyleMode): void {
  mode = next;
  flatMaterialsEnabled = mode >= 2;
  localOutlinesEnabled = mode >= 3;
  postProcessEnabled = mode >= 4;
  pixelUpscaleEnabled = mode >= 5;
  setFlatMaterialEnabled(flatMaterialsEnabled);
  setLocalOutlinesEnabled(localOutlinesEnabled);
  renderer.domElement.style.imageRendering = pixelUpscaleEnabled ? 'pixelated' : 'auto';
  post.resize(window.innerWidth, window.innerHeight, pixelUpscaleEnabled ? 2 : 1);
  if (modeLabel) {
    modeLabel.textContent = `${mode} - ${['', 'direct', 'flat materials', 'local outlines', 'postprocess', 'pixel upscale'][mode]}`;
  }
}

function updateCamera(): void {
  const x = Math.cos(cameraAngle) * cameraDistance;
  const z = Math.sin(cameraAngle) * cameraDistance;
  camera.position.set(x, 560, z);
  camera.lookAt(cameraTarget);
}

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const aspect = window.innerWidth / window.innerHeight;
  const view = 540;
  camera.left = -view * aspect;
  camera.right = view * aspect;
  camera.top = view;
  camera.bottom = -view;
  camera.updateProjectionMatrix();
  post.resize(window.innerWidth, window.innerHeight, pixelUpscaleEnabled ? 2 : 1);
}

window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (event.key >= '1' && event.key <= '5') applyMode(Number(event.key) as StyleMode);
  if (event.key.toLowerCase() === 'q') cameraAngle -= 0.12;
  if (event.key.toLowerCase() === 'e') cameraAngle += 0.12;
  if (event.key.toLowerCase() === 'w') cameraDistance = Math.max(420, cameraDistance - 60);
  if (event.key.toLowerCase() === 's') cameraDistance = Math.min(1300, cameraDistance + 60);
  if (event.key.toLowerCase() === 'r') {
    cameraAngle = Math.PI / 4;
    cameraDistance = 920;
  }
  updateCamera();
});

async function boot(): Promise<void> {
  makeGround();
  makeBlocks();
  await Promise.all([
    loadModel(MODEL_PATHS.shrine, 'crystal shrine', new THREE.Vector3(-70, 0, 10), 125, 0.25),
    loadModel(MODEL_PATHS.crystal, 'crystal A', new THREE.Vector3(115, 0, -20), 58, 1.1),
    loadModel(MODEL_PATHS.crystal, 'crystal B', new THREE.Vector3(-190, 0, 105), 42, -0.8),
    loadModel(MODEL_PATHS.korone, 'korone placeholder', new THREE.Vector3(185, 0, 95), 70, 0)
  ]);
  applyMode(3);
  updateCamera();
  resize();
  renderer.setAnimationLoop(render);
}

function render(): void {
  const dt = 1 / 60;
  for (const model of models) model.root.rotation.y += model.spinSpeed * dt;
  if (postProcessEnabled) post.render();
  else renderer.render(scene, camera);
}

void boot();
