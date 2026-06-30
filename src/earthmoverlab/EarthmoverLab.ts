import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { EarthmoverRenderPixelatedPass } from './EarthmoverRenderPixelatedPass';
import { EarthmoverPixelatePass } from './EarthmoverPixelatePass';

const canvas = document.querySelector<HTMLCanvasElement>('#earthmover-canvas');
if (!canvas) throw new Error('Missing canvas');
const stats = document.querySelector<HTMLParagraphElement>('#stats');

const controls = {
  pixelSize: document.querySelector<HTMLInputElement>('#pixelSize')!,
  normalEdgeStrength: document.querySelector<HTMLInputElement>('#normalEdgeStrength')!,
  depthEdgeStrength: document.querySelector<HTMLInputElement>('#depthEdgeStrength')!,
  outlineInkStrength: document.querySelector<HTMLInputElement>('#outlineInkStrength')!,
  brightness: document.querySelector<HTMLInputElement>('#brightness')!,
  contrast: document.querySelector<HTMLInputElement>('#contrast')!,
  saturation: document.querySelector<HTMLInputElement>('#saturation')!,
  gamma: document.querySelector<HTMLInputElement>('#gamma')!,
  shadowLift: document.querySelector<HTMLInputElement>('#shadowLift')!,
  pixelAlignedPanning: document.querySelector<HTMLInputElement>('#pixelAlignedPanning')!,
};
const values = {
  pixelSize: document.querySelector<HTMLSpanElement>('#pixelSizeValue')!,
  normalEdgeStrength: document.querySelector<HTMLSpanElement>('#normalEdgeStrengthValue')!,
  depthEdgeStrength: document.querySelector<HTMLSpanElement>('#depthEdgeStrengthValue')!,
  outlineInkStrength: document.querySelector<HTMLSpanElement>('#outlineInkStrengthValue')!,
  brightness: document.querySelector<HTMLSpanElement>('#brightnessValue')!,
  contrast: document.querySelector<HTMLSpanElement>('#contrastValue')!,
  saturation: document.querySelector<HTMLSpanElement>('#saturationValue')!,
  gamma: document.querySelector<HTMLSpanElement>('#gammaValue')!,
  shadowLift: document.querySelector<HTMLSpanElement>('#shadowLiftValue')!,
};

let useShader = true;
let cameraAngle = Math.PI / 4;
let cameraDistance = 8.8;
let cameraModeFollowPlayer = true;
let cameraPitch = 5.8;
let cameraPanX = 0;
let cameraPanZ = 0;
const mouseState = {
  dragging: false,
  button: -1,
  lastX: 0,
  lastY: 0,
};
let player: THREE.Object3D | null = null;
let playerFacing: 'north' | 'south' | 'west' | 'east' = 'south';
const keys = new Set<string>();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x5f9cb0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 80);
const target = new THREE.Vector3(0, 0.6, 0);
const renderResolution = new THREE.Vector2(1, 1);
const composerTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  depthTexture: new THREE.DepthTexture(window.innerWidth, window.innerHeight),
  depthBuffer: true
});
composerTarget.texture.minFilter = THREE.NearestFilter;
composerTarget.texture.magFilter = THREE.NearestFilter;
composerTarget.texture.colorSpace = THREE.SRGBColorSpace;
const composer = new EffectComposer(renderer, composerTarget);
const renderPass = new RenderPass(scene, camera);
const renderPixelatedPass = new EarthmoverRenderPixelatedPass(renderResolution, scene, camera);
const pixelatePass = new EarthmoverPixelatePass(renderResolution);
const outputPass = new OutputPass();
composer.addPass(renderPass);
composer.addPass(renderPixelatedPass);
composer.addPass(pixelatePass);
composer.addPass(outputPass);
const orbitControls = new OrbitControls(camera, canvas);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.enablePan = true;
orbitControls.enableZoom = true;
orbitControls.zoomSpeed = 1.0;
orbitControls.panSpeed = 0.8;
orbitControls.rotateSpeed = 0.55;
orbitControls.screenSpacePanning = false;
orbitControls.minZoom = 0.45;
orbitControls.maxZoom = 3.8;
orbitControls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN,
};
orbitControls.target.copy(target);
orbitControls.update();


const models: THREE.Object3D[] = [];
const clock = new THREE.Clock();

function numberValue(input: HTMLInputElement): number { return Number(input.value); }
function setControl(id: keyof typeof controls, value: number | boolean): void {
  const input = controls[id];
  if (typeof value === 'boolean') input.checked = value;
  else input.value = String(value);
}
function refreshControlLabels(): void {
  values.pixelSize.textContent = String(numberValue(controls.pixelSize));
  values.normalEdgeStrength.textContent = numberValue(controls.normalEdgeStrength).toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  values.depthEdgeStrength.textContent = numberValue(controls.depthEdgeStrength).toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  values.outlineInkStrength.textContent = numberValue(controls.outlineInkStrength).toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  values.brightness.textContent = numberValue(controls.brightness).toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  values.contrast.textContent = numberValue(controls.contrast).toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  values.saturation.textContent = numberValue(controls.saturation).toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  values.gamma.textContent = numberValue(controls.gamma).toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
  values.shadowLift.textContent = numberValue(controls.shadowLift).toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}
function applyShaderControls(): void {
  refreshControlLabels();
  renderPixelatedPass.setUniforms({
    normalEdgeStrength: numberValue(controls.normalEdgeStrength),
    depthEdgeStrength: numberValue(controls.depthEdgeStrength),
    outlineInkStrength: numberValue(controls.outlineInkStrength),
    brightness: numberValue(controls.brightness),
    contrast: numberValue(controls.contrast),
    saturation: numberValue(controls.saturation),
    gamma: numberValue(controls.gamma),
    shadowLift: numberValue(controls.shadowLift),
  });
  updateResolution();
}

function updateResolution(): void {
  const pixelSize = numberValue(controls.pixelSize);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  composer.setSize(window.innerWidth, window.innerHeight);
  renderResolution.set(
    Math.max(1, Math.floor(window.innerWidth / pixelSize)),
    Math.max(1, Math.floor(window.innerHeight / pixelSize))
  );
  renderPixelatedPass.setResolution(renderResolution);
  pixelatePass.setResolution(renderResolution);
  const aspect = window.innerWidth / window.innerHeight;
  const size = 5.0;
  camera.left = -size * aspect;
  camera.right = size * aspect;
  camera.top = size;
  camera.bottom = -size;
  camera.updateProjectionMatrix();
  updateStats();
}

function updateStats(): void {
  if (!stats) return;
  stats.textContent = `mode: ${useShader ? 'shader' : 'direct'} | pixelSize: ${numberValue(controls.pixelSize)} | facing: ${playerFacing} | render: ${renderResolution.x}x${renderResolution.y}`;
}

function snapped(v: number): number {
  if (!controls.pixelAlignedPanning.checked) return v;
  const grid = 1 / Math.max(1, numberValue(controls.pixelSize));
  return Math.round(v / grid) * grid;
}
function updateCamera(): void {
  if (cameraModeFollowPlayer && player) {
    orbitControls.target.set(
      snapped(player.position.x + cameraPanX),
      0.75,
      snapped(player.position.z + cameraPanZ)
    );
  }
  orbitControls.update();
  target.copy(orbitControls.target);
}

function pixelTexture(tex: THREE.Texture): THREE.Texture {
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function toPhongMaterial(source: any, fallback: THREE.ColorRepresentation): THREE.MeshPhongMaterial {
  const map = source?.map ? pixelTexture(source.map) : null;
  const color = source?.color instanceof THREE.Color ? source.color : new THREE.Color(fallback);
  return new THREE.MeshPhongMaterial({
    map,
    color,
    shininess: 0,
    specular: 0x000000,
    emissive: color.clone().multiplyScalar(0.08),
    flatShading: true,
    transparent: Boolean(source?.transparent),
    opacity: typeof source?.opacity === 'number' ? source.opacity : 1,
    alphaTest: 0.02
  });
}
function prepModel(root: THREE.Object3D, fallback: THREE.ColorRepresentation): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    if (mesh.geometry) mesh.geometry.computeVertexNormals();
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((m) => toPhongMaterial(m as any, fallback));
    else mesh.material = toPhongMaterial(mesh.material as any, fallback);
  });
}
function normalize(root: THREE.Object3D, targetHeight: number): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  root.scale.setScalar(targetHeight / Math.max(0.001, size.y));
  root.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  b2.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= b2.min.y;
}

async function loadModel(path: string, fallback: THREE.ColorRepresentation, height: number, position: THREE.Vector3, spin = 0, isPlayer = false): Promise<void> {
  try {
    const gltf = await new GLTFLoader().loadAsync(path);
    const root = gltf.scene;
    prepModel(root, fallback);
    normalize(root, height);
    root.position.copy(position);
    root.userData.spin = spin;
    scene.add(root);
    models.push(root);
    if (isPlayer) {
      player = root;
      setPlayerFacing('south');
    }
  } catch (e) {
    console.warn('Failed to load model', path, e);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(height * 0.5, height, height * 0.5), new THREE.MeshPhongMaterial({ color: fallback, flatShading: true }));
    mesh.position.copy(position).add(new THREE.Vector3(0, height / 2, 0));
    mesh.userData.spin = spin;
    scene.add(mesh);
    models.push(mesh);
    if (isPlayer) player = mesh;
  }
}

function setPlayerFacing(direction: 'north' | 'south' | 'west' | 'east'): void {
  if (!player) return;
  playerFacing = direction;
  const angles = { south: 0, north: Math.PI, west: -Math.PI / 2, east: Math.PI / 2 };
  player.rotation.y = angles[direction];
  updateStats();
}

function updatePlayerMovement(dt: number): void {
  if (!player) return;
  const speed = keys.has('shift') ? 2.8 : 1.75;
  let dx = 0;
  let dz = 0;
  if (keys.has('w')) dz -= 1;
  if (keys.has('s')) dz += 1;
  if (keys.has('a')) dx -= 1;
  if (keys.has('d')) dx += 1;
  if (dx !== 0 || dz !== 0) {
    if (Math.abs(dx) > Math.abs(dz)) setPlayerFacing(dx < 0 ? 'west' : 'east');
    else setPlayerFacing(dz < 0 ? 'north' : 'south');
    const len = Math.hypot(dx, dz);
    player.position.x += (dx / len) * speed * dt;
    player.position.z += (dz / len) * speed * dt;
  }
}

function addBlock(x: number, z: number, w: number, h: number, d: number, color: number): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshPhongMaterial({ color, flatShading: true, shininess: 0, specular: 0x000000 }));
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}
function buildWorld(): void {
  scene.add(new THREE.AmbientLight(0x8ea6c4, 1.75));
  const sun = new THREE.DirectionalLight(0xfff0b8, 1.15);
  sun.position.set(4.5, 8, 3.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), new THREE.MeshPhongMaterial({ color: 0x6ea85d, flatShading: true }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const palette = [0x85b263, 0xa5d773, 0x567b5f, 0xbdad8e, 0x8a8176];
  for (let i = 0; i < 34; i++) {
    addBlock((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 7.5, 0.45 + Math.random() * 0.9, 0.08, 0.45 + Math.random() * 0.9, palette[i % palette.length]);
  }
  addBlock(-3.8, -1.7, 0.75, 2.6, 0.75, 0x8f8374);
  addBlock(3.7, -1.2, 0.75, 2.9, 0.75, 0x8f8374);
  addBlock(-4.2, 1.9, 0.65, 1.8, 0.65, 0x6f6974);
  addBlock(4.4, 1.7, 0.65, 1.8, 0.65, 0x6f6974);
  addBlock(0, 0.15, 3.8, 0.55, 2.3, 0xbbae91);
  addBlock(0, -0.05, 2.4, 1.0, 1.2, 0xa89a80);
}


function panCameraByScreenDelta(dx: number, dy: number): void {
  cameraModeFollowPlayer = false;
  const panSpeed = cameraDistance * 0.0018;
  const rightX = Math.cos(cameraAngle + Math.PI / 2);
  const rightZ = Math.sin(cameraAngle + Math.PI / 2);
  const forwardX = Math.cos(cameraAngle);
  const forwardZ = Math.sin(cameraAngle);
  target.x += (-dx * rightX + dy * forwardX) * panSpeed;
  target.z += (-dx * rightZ + dy * forwardZ) * panSpeed;
  updateCamera();
}

function zoomCamera(deltaY: number): void {
  const zoomFactor = Math.exp(deltaY * 0.0011);
  cameraDistance = Math.max(3.8, Math.min(18.0, cameraDistance * zoomFactor));
  updateCamera();
  updateStats();
}

function orbitCameraByScreenDelta(dx: number, dy: number): void {
  cameraModeFollowPlayer = false;
  cameraAngle -= dx * 0.006;
  cameraPitch = Math.max(3.2, Math.min(10.5, cameraPitch + dy * 0.018));
  updateCamera();
}

function installMouseCameraControls(): void {
  // Disabled: OrbitControls handles wheel/orbit/pan now.
}

function currentPlayerBasePosition(): THREE.Vector3 {
  if (player) return new THREE.Vector3(player.position.x, 0.75, player.position.z);
  return new THREE.Vector3(0, 0.75, 0);
}

function facingVector(direction: typeof playerFacing): THREE.Vector3 {
  if (direction === 'north') return new THREE.Vector3(0, 0, -1);
  if (direction === 'south') return new THREE.Vector3(0, 0, 1);
  if (direction === 'east') return new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3(-1, 0, 0);
}

function setCameraView(view: 'iso' | 'front' | 'back' | 'left' | 'right'): void {
  const base = currentPlayerBasePosition();
  let dir = new THREE.Vector3(1, 0, 1).normalize();
  if (view !== 'iso') {
    const forward = facingVector(playerFacing);
    if (view === 'front') dir = forward.clone();
    if (view === 'back') dir = forward.clone().multiplyScalar(-1);
    if (view === 'left') dir = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
    if (view === 'right') dir = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
  }
  cameraModeFollowPlayer = view === 'iso';
  cameraPanX = 0;
  cameraPanZ = 0;
  camera.position.set(
    base.x + dir.x * cameraDistance,
    view === 'iso' ? cameraPitch : 2.2,
    base.z + dir.z * cameraDistance
  );
  orbitControls.target.copy(base);
  camera.lookAt(base);
  orbitControls.update();
  target.copy(orbitControls.target);
}

function resetOrbitCamera(): void {
  cameraDistance = 8.8;
  cameraPitch = 5.8;
  cameraPanX = 0;
  cameraPanZ = 0;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  cameraModeFollowPlayer = true;
  setCameraView('iso');
}
function installControls(): void {
  Object.values(controls).forEach((input) => input.addEventListener('input', applyShaderControls));
  document.querySelector<HTMLButtonElement>('#presetSoft')?.addEventListener('click', () => {
    setControl('pixelSize', 3); setControl('normalEdgeStrength', 0.35); setControl('depthEdgeStrength', 0.75); setControl('outlineInkStrength', 0.55); setControl('brightness', 1.02); setControl('contrast', 1.2); setControl('saturation', 1.1); setControl('gamma', 0.96); setControl('shadowLift', -0.03); applyShaderControls();
  });
  document.querySelector<HTMLButtonElement>('#presetInk')?.addEventListener('click', () => {
    setControl('pixelSize', 5); setControl('normalEdgeStrength', 0.65); setControl('depthEdgeStrength', 1.15); setControl('outlineInkStrength', 0.92); setControl('brightness', 1.0); setControl('contrast', 1.45); setControl('saturation', 1.35); setControl('gamma', 0.9); setControl('shadowLift', -0.08); applyShaderControls();
  });
  document.querySelector<HTMLButtonElement>('#presetChunky')?.addEventListener('click', () => {
    setControl('pixelSize', 7); setControl('normalEdgeStrength', 0.9); setControl('depthEdgeStrength', 1.45); setControl('outlineInkStrength', 1.0); setControl('brightness', 0.96); setControl('contrast', 1.6); setControl('saturation', 1.48); setControl('gamma', 0.88); setControl('shadowLift', -0.11); applyShaderControls();
  });
  document.querySelector<HTMLButtonElement>('#cameraIso')?.addEventListener('click', () => setCameraView('iso'));
  document.querySelector<HTMLButtonElement>('#cameraFront')?.addEventListener('click', () => setCameraView('front'));
  document.querySelector<HTMLButtonElement>('#cameraBack')?.addEventListener('click', () => setCameraView('back'));
  document.querySelector<HTMLButtonElement>('#cameraLeft')?.addEventListener('click', () => setCameraView('left'));
  document.querySelector<HTMLButtonElement>('#cameraRight')?.addEventListener('click', () => setCameraView('right'));
  document.querySelector<HTMLButtonElement>('#cameraFollow')?.addEventListener('click', () => { cameraModeFollowPlayer = true; updateCamera(); });
}

async function boot(): Promise<void> {
  installControls();
  buildWorld();
  await Promise.all([
    loadModel('/assets/prototype/mmd/crystal_shrine/stylised_crystal_shrine.glb', 0x9b8f78, 1.75, new THREE.Vector3(-0.65, 0, 0.15), 0.18),
    loadModel('/assets/prototype/mmd/crystal/crystal.glb', 0x3fb7ff, 0.75, new THREE.Vector3(0.95, 0.58, -0.38), 1.1),
    loadModel('/assets/prototype/mmd/korone_256fes/inugami_korone_for_256fes.glb', 0xffc8a8, 1.05, new THREE.Vector3(2.1, 0, 1.2), 0, true)
  ]);
  applyShaderControls();
  resetOrbitCamera();
  renderer.setAnimationLoop(render);
}

function render(): void {
  const dt = Math.min(0.05, clock.getDelta());
  updatePlayerMovement(dt);
  for (const model of models) {
    if (model === player) continue;
    model.rotation.y += (model.userData.spin || 0) * dt;
  }
  updateCamera();
  if (useShader) composer.render();
  else renderer.render(scene, camera);
}

window.addEventListener('resize', updateResolution);
window.addEventListener('keydown', (event) => {
  const k = event.key.toLowerCase();
  keys.add(k);
  if (event.key === '1') useShader = false;
  if (event.key === '2') useShader = true;
  if (k === 'q') { cameraAngle -= 0.12; cameraModeFollowPlayer = false; }
  if (k === 'e') { cameraAngle += 0.12; cameraModeFollowPlayer = false; }
  if (k === 'z') zoomCamera(-120);
  if (k === 'x') zoomCamera(120);
  if (k === 'v') setCameraView('front');
  if (k === 'b') setCameraView('back');
  if (k === 'i') setCameraView('iso');
  if (k === 'q') setCameraView('left');
  if (k === 'e') setCameraView('right');
  if (k === 'f') { cameraModeFollowPlayer = !cameraModeFollowPlayer; cameraPanX = 0; cameraPanZ = 0; }
  if (k === 'r') { useShader = true; resetOrbitCamera(); }
  updateStats();
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

void boot();
