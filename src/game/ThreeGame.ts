import * as THREE from 'three';
import { Input } from './Input';
import { PrototypePlayerModel } from '../entities/PrototypePlayerModel';
import { RotatingWorldModel } from '../entities/RotatingWorldModel';
import { CardWorldPixelPass } from '../effects/CardWorldPixelPass';
import { CardWorldStylizedPass } from '../effects/CardWorldStylizedPass';
import type { GameProfile, OnlinePlayerState, PlacedFurniture } from '../types/shared';
import { normalizeAvatarLoadout, normalizeProfile } from '../types/shared';
import type { MapDef, MapId, NpcDef, Rect } from '../world/types';
import { MapManager } from '../world/managers/MapManager';
import { DoorManager } from '../world/managers/DoorManager';
import { NpcManager } from '../world/managers/NpcManager';
import { CollisionManager } from '../world/managers/CollisionManager';
import { InteractionManager } from '../world/managers/InteractionManager';
import { FurnitureManager } from '../hq/managers/FurnitureManager';
import { PlacementManager } from '../hq/managers/PlacementManager';

const START_WITH_DEBUG_COLLIDERS = true;
const PLAYER_BOUND_LEFT = 24;
const PLAYER_BOUND_RIGHT = 24;
const PLAYER_BOUND_TOP = 12;
const PLAYER_BOUND_BOTTOM = 48;
const PLAYER_START_X = 512;
const PLAYER_START_Y = 390;
const POSITION_SAVE_INTERVAL_MS = 2500;
const MAIN_CAMERA_FOV_DEGREES = 35;
const MAIN_CAMERA_TILT_FROM_VERTICAL_DEGREES = 20;
const MAIN_CAMERA_HEIGHT = 1450;
const MAIN_CAMERA_LATERAL_OFFSET = MAIN_CAMERA_HEIGHT * Math.tan(THREE.MathUtils.degToRad(MAIN_CAMERA_TILT_FROM_VERTICAL_DEGREES));
type BuildMode = 'none' | 'place' | 'delete';
interface PlacementState { furnitureId: string; ghost: THREE.Group | null; rotation: number; }
export interface ThreeGameCallbacks { isInputBlocked: () => boolean; onMenuToggle: () => void; onNpcInteract: (npc: NpcDef) => void; onMapChanged?: (mapId: MapId) => void; onPrompt?: (text: string | null) => void; onCoordinatesChanged?: (x: number, y: number, mapId: MapId) => void; onPositionSave?: (mapId: MapId, x: number, y: number) => void; onFurniturePlaced?: (placedFurniture: PlacedFurniture[]) => void; }
function isHqMap(mapId: MapId): boolean { return mapId === 'hq_room' || mapId === 'hq_garden'; }

export class ThreeGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private floorLayer = new THREE.Group();
  private furnitureLayer = new THREE.Group();
  private placementLayer = new THREE.Group();
  private objectLayer = new THREE.Group();
  private npcLayer = new THREE.Group();
  private debugLayer = new THREE.Group();
  private rotatingModelLayer = new THREE.Group();
  private rotatingModels: RotatingWorldModel[] = [];
  private camera!: THREE.PerspectiveCamera;
  private input = new Input();
  private players = new Map<string, PrototypePlayerModel>();
  private local: OnlinePlayerState;
  private currentMapId: MapId;
  private profile: GameProfile;
  private transitionCooldown = 0;
  private debugColliders = START_WITH_DEBUG_COLLIDERS;
  private placement: PlacementState | null = null;
  private buildMode: BuildMode = 'none';
  private lastPositionSave = 0;
  private clock = new THREE.Clock();
  private loader = new THREE.TextureLoader();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Optional legacy pixel shader. Direct rendering remains available as fallback.
  private usePixelShader = false;
  private pixelSize = 3;
  private normalEdgeCoefficient = 0.35;
  private depthEdgeCoefficient = 0.35;
  private pixelPass: CardWorldPixelPass | null = null;

  // Main experimental style pass. Press F4 to toggle it.
  // This now uses the Earthmover-style depthTexture + normal pass, not the darker old stylized pass.
  private useStylizedShader = true;
  private stylizedPixelSize = 3;
  private stylizedColorLevels = 0;
  private stylizedOutlineStrength = 1.0;
  private stylizedNormalStrength = 1.0;
  private stylizedDitherStrength = 0.0;
  private stylizedPass: CardWorldStylizedPass | null = null;

  // Debug camera controls. Press O to open/close the camera tuning panel.
  private cameraDebugVisible = false;
  private cameraDebugPanel: HTMLDivElement | null = null;
  private cameraFovDegrees = 35;
  private cameraTiltFromVerticalDegrees = 42;
  private cameraYawDegrees = 180;
  private cameraHeight = 900;
  private cameraTargetYOffset = 34;

  constructor(private canvas: HTMLCanvasElement, profile: GameProfile, private callbacks: ThreeGameCallbacks) {
    this.profile = normalizeProfile(profile);
    const mapId = MapManager.safeMapId(this.profile.currentMapId);
    const saved = mapId === this.profile.currentMapId;
    this.currentMapId = mapId;
    this.local = this.createLocalPlayerState(mapId, saved);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false });
  }

  async start(): Promise<void> {
    console.info('[CardWorld] Earthmover overworld/shader v7 CAMERA GUI + STILL AVATAR ThreeGame.ts loaded');
    this.initRenderer();
    this.setupLayers();
    this.installCameraDebugGui();
    this.registerExternalEvents();
    this.registerPlacementEvents();
    this.loadMap(this.currentMapId, { x: this.local.x, y: this.local.y });
    this.createLocalPlayerSprite();
    this.renderer.setAnimationLoop(() => this.update(this.clock.getDelta()));
  }

  private createLocalPlayerState(mapId: MapId, saved: boolean): OnlinePlayerState {
    return { userId: this.profile.userId, displayName: this.profile.displayName?.trim() || 'Orange', mapId, x: saved ? this.profile.position.x : PLAYER_START_X, y: saved ? this.profile.position.y : PLAYER_START_Y, direction: 'down', moving: false, avatar: normalizeAvatarLoadout(this.profile.avatar) };
  }

  private initRenderer(): void {
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(0x5f9cb0, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    this.scene.background = new THREE.Color(0x5f9cb0);
    this.camera = new THREE.PerspectiveCamera(this.cameraFovDegrees, window.innerWidth / window.innerHeight, 1, 5000);
    this.updateCameraForTarget(0, 0);
    this.pixelPass = new CardWorldPixelPass(this.renderer, this.scene, this.camera, { pixelSize: this.pixelSize, normalEdgeCoefficient: this.normalEdgeCoefficient, depthEdgeCoefficient: this.depthEdgeCoefficient });
    this.stylizedPass = new CardWorldStylizedPass(this.renderer, this.scene, this.camera, {
      pixelSize: this.stylizedPixelSize,
      colorLevels: this.stylizedColorLevels,
      ditherStrength: this.stylizedDitherStrength,
      outlineStrength: this.stylizedOutlineStrength,
      normalStrength: this.stylizedNormalStrength,
      outlineThreshold: 0.045,
      normalThreshold: 0.16,
      outlineColor: 0x182238,
      shadowStrength: 0.0,
      normalEdgeStrength: 0.35,
      depthEdgeStrength: 0.35,
      outlineInkStrength: 0.62,
      brightness: 1.05,
      contrast: 1.05,
      saturation: 1.05,
      gamma: 1.0,
      shadowLift: 0.0
    });
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.fov = this.cameraFovDegrees;
    this.camera.updateProjectionMatrix();
    this.pixelPass?.resize(window.innerWidth, window.innerHeight);
    this.stylizedPass?.resize(window.innerWidth, window.innerHeight);
  }

  private setupLayers(): void {
    this.scene.add(this.floorLayer, this.furnitureLayer, this.objectLayer, this.npcLayer, this.placementLayer, this.rotatingModelLayer, this.debugLayer);
    this.scene.add(new THREE.AmbientLight(0x8ea6c4, 1.75));
    const sun = new THREE.DirectionalLight(0xfff0b8, 1.15);
    sun.position.set(450, 900, 350);
    sun.castShadow = false;
    this.scene.add(sun);
  }

  private installCameraDebugGui(): void {
    const panel = document.createElement('div');
    panel.id = 'cardworld-camera-debug-panel';
    panel.style.cssText = [
      'position:fixed',
      'right:16px',
      'top:16px',
      'z-index:120',
      'width:330px',
      'padding:14px',
      'border:2px solid #66d9ff',
      'border-radius:12px',
      'background:rgba(8,12,30,0.94)',
      'color:#f6f7ff',
      'font:12px/1.35 system-ui,sans-serif',
      'box-shadow:0 10px 35px rgba(0,0,0,0.45)',
      'display:none',
      'pointer-events:auto'
    ].join(';');

    const title = document.createElement('div');
    title.innerHTML = '<b>Camera Debug</b> <span style="color:#8fefff">press O to close</span><br><span style="color:#b9c7e9">Tune angle/distance for HD-2D / Octopath-like view.</span>';
    title.style.marginBottom = '10px';
    panel.appendChild(title);

    const addNumberSlider = (
      label: string,
      get: () => number,
      set: (value: number) => void,
      min: number,
      max: number,
      step: number
    ) => {
      const row = document.createElement('label');
      row.style.cssText = 'display:grid;grid-template-columns:95px 1fr 72px;gap:8px;align-items:center;margin:8px 0';

      const name = document.createElement('span');
      name.textContent = label;

      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      range.value = String(get());

      const number = document.createElement('input');
      number.type = 'number';
      number.min = String(min);
      number.max = String(max);
      number.step = String(step);
      number.value = String(get());
      number.style.cssText = 'width:72px;background:#10182f;color:#fff;border:1px solid #66d9ff;border-radius:6px;padding:3px 5px';

      const apply = (raw: string) => {
        const value = Number(raw);
        if (!Number.isFinite(value)) return;
        const clamped = Math.max(min, Math.min(max, value));
        set(clamped);
        range.value = String(clamped);
        number.value = String(clamped);
        this.applyCameraDebugSettings();
      };

      range.addEventListener('input', () => apply(range.value));
      number.addEventListener('change', () => apply(number.value));
      number.addEventListener('keydown', (event) => event.stopPropagation());
      range.addEventListener('keydown', (event) => event.stopPropagation());

      row.append(name, range, number);
      panel.appendChild(row);
    };

    addNumberSlider('FOV', () => this.cameraFovDegrees, (v) => this.cameraFovDegrees = v, 20, 60, 1);
    addNumberSlider('Tilt', () => this.cameraTiltFromVerticalDegrees, (v) => this.cameraTiltFromVerticalDegrees = v, 5, 75, 1);
    addNumberSlider('Yaw', () => this.cameraYawDegrees, (v) => this.cameraYawDegrees = v, 0, 360, 1);
    addNumberSlider('Height', () => this.cameraHeight, (v) => this.cameraHeight = v, 250, 2400, 10);
    addNumberSlider('Target Y', () => this.cameraTargetYOffset, (v) => this.cameraTargetYOffset = v, 0, 220, 1);

    const presets = document.createElement('div');
    presets.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
    const makeButton = (text: string, apply: () => void) => {
      const button = document.createElement('button');
      button.textContent = text;
      button.style.cssText = 'border:1px solid #66d9ff;background:#16304a;color:#fff;border-radius:8px;padding:6px 8px;font-weight:700';
      button.addEventListener('click', () => {
        apply();
        this.refreshCameraDebugGui();
        this.applyCameraDebugSettings();
      });
      return button;
    };
    presets.append(
      makeButton('Octopath-ish', () => { this.cameraFovDegrees = 35; this.cameraTiltFromVerticalDegrees = 42; this.cameraYawDegrees = 180; this.cameraHeight = 900; this.cameraTargetYOffset = 34; }),
      makeButton('Closer', () => { this.cameraFovDegrees = 32; this.cameraTiltFromVerticalDegrees = 48; this.cameraYawDegrees = 180; this.cameraHeight = 650; this.cameraTargetYOffset = 45; }),
      makeButton('Top Down', () => { this.cameraFovDegrees = 35; this.cameraTiltFromVerticalDegrees = 20; this.cameraYawDegrees = 180; this.cameraHeight = 1450; this.cameraTargetYOffset = 0; })
    );
    panel.appendChild(presets);

    document.body.appendChild(panel);
    this.cameraDebugPanel = panel;
  }

  private refreshCameraDebugGui(): void {
    if (!this.cameraDebugPanel) return;
    const inputs = Array.from(this.cameraDebugPanel.querySelectorAll('input'));
    const values = [this.cameraFovDegrees, this.cameraFovDegrees, this.cameraTiltFromVerticalDegrees, this.cameraTiltFromVerticalDegrees, this.cameraYawDegrees, this.cameraYawDegrees, this.cameraHeight, this.cameraHeight, this.cameraTargetYOffset, this.cameraTargetYOffset];
    inputs.forEach((input, index) => { (input as HTMLInputElement).value = String(values[index] ?? (input as HTMLInputElement).value); });
  }

  private toggleCameraDebugGui(): void {
    this.cameraDebugVisible = !this.cameraDebugVisible;
    if (this.cameraDebugPanel) this.cameraDebugPanel.style.display = this.cameraDebugVisible ? 'block' : 'none';
  }

  private applyCameraDebugSettings(): void {
    if (!this.camera) return;
    this.camera.fov = this.cameraFovDegrees;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.updateCameraForTarget(this.local.x, this.local.y);
  }

  private updateCameraForTarget(x: number, y: number): void {
    if (!this.camera) return;
    const tilt = THREE.MathUtils.degToRad(this.cameraTiltFromVerticalDegrees);
    const yaw = THREE.MathUtils.degToRad(this.cameraYawDegrees);
    const lateral = this.cameraHeight * Math.tan(tilt);
    const offsetX = Math.sin(yaw) * lateral;
    const offsetZ = Math.cos(yaw) * lateral;
    this.camera.position.set(x + offsetX, this.cameraHeight, y + offsetZ);
    this.camera.lookAt(x, this.cameraTargetYOffset, y);
  }

  private registerExternalEvents(): void {
    window.addEventListener('cardworld:travel', (event) => { const detail = (event as CustomEvent).detail as { mapId: MapId; x: number; y: number }; this.loadMap(detail.mapId, { x: detail.x, y: detail.y }); });
    window.addEventListener('cardworld:profile-updated', (event) => { this.profile = normalizeProfile((event as CustomEvent).detail.profile); this.redrawFurniture(); });
    window.addEventListener('cardworld:start-placement', (event) => void this.startPlacement((event as CustomEvent).detail.furnitureId));
    window.addEventListener('cardworld:start-furniture-delete', () => this.startDeleteMode());
    window.addEventListener('cardworld:exit-build-mode', () => this.exitBuildMode());
  }

  private registerPlacementEvents(): void {
    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if (key === 'escape' && this.buildMode !== 'none') this.exitBuildMode();
      if (key === 'o') this.toggleCameraDebugGui();
      if (key === 'r' && this.placement) void this.rotatePlacement();
    });
    this.canvas.addEventListener('mousemove', (event) => this.updatePlacementGhost(event));
    this.canvas.addEventListener('click', (event) => this.handleBuildClick(event));
  }

  private setBuildMode(mode: BuildMode): void { this.buildMode = mode; window.dispatchEvent(new CustomEvent('cardworld:build-mode-changed', { detail: { active: mode !== 'none', mode } })); }
  private exitBuildMode(): void { this.cancelPlacement(); this.setBuildMode('none'); this.callbacks.onPrompt?.(null); }
  private clearGroup(group: THREE.Group): void { while (group.children.length) group.remove(group.children[0]); }

  private loadMap(id: MapId, spawn: { x: number; y: number }): void {
    const mapId = MapManager.safeMapId(id);
    const map = MapManager.getMap(mapId);
    this.currentMapId = mapId;
    this.local.mapId = mapId;
    this.local.x = spawn.x;
    this.local.y = spawn.y;
    if (!isHqMap(mapId) && this.buildMode !== 'none') this.exitBuildMode();
    if (this.collidesAt(this.local.x, this.local.y)) {
      this.local.y += 48;
      if (this.collidesAt(this.local.x, this.local.y)) {
        this.local.x = PLAYER_START_X;
        this.local.y = mapId === 'town_square' ? PLAYER_START_Y : Math.min(620, map.height - PLAYER_BOUND_BOTTOM);
      }
    }
    this.clearGroup(this.floorLayer); this.clearGroup(this.furnitureLayer); this.clearGroup(this.placementLayer); this.clearGroup(this.objectLayer); this.clearGroup(this.npcLayer); this.clearGroup(this.rotatingModelLayer); this.clearGroup(this.debugLayer); this.rotatingModels = [];
    this.drawFloor(mapId);
    void this.drawFurniture(mapId);
    void this.drawMapObjects(mapId);
    void this.drawNpcs(mapId);
    this.drawPrototypeDecorations(mapId);
    this.drawDebug(mapId);
    this.callbacks.onMapChanged?.(mapId);
    this.callbacks.onPositionSave?.(mapId, this.local.x, this.local.y);
  }

  private isEarthmoverTerrainMap(map: MapDef): boolean {
    return map.category === 'town';
  }

  private terrainMaterial(color: number): THREE.MeshPhongMaterial {
    return new THREE.MeshPhongMaterial({
      color,
      flatShading: true,
      shininess: 0,
      specular: 0x000000,
      emissive: new THREE.Color(color).multiplyScalar(0.04)
    });
  }

  private addTerrainBlock(parent: THREE.Group, x: number, z: number, w: number, h: number, d: number, color: number): void {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.terrainMaterial(color));
    mesh.position.set(x, h / 2 - 2, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
  }

  private seededNoise(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  }

  private drawEarthmoverTerrain(map: MapDef): void {
    this.scene.background = new THREE.Color(0x5f9cb0);
    this.renderer.setClearColor(0x5f9cb0, 1);
    const terrain = new THREE.Group();
    terrain.name = `EarthmoverTerrain:${map.id}`;
    this.floorLayer.add(terrain);
    const cx = map.width / 2;
    const cz = map.height / 2;
    this.addTerrainBlock(terrain, cx, cz, map.width, 8, map.height, 0x38792d);
    const palette = [0x85b263, 0xa5d773, 0x567b5f, 0x2f6f2b, 0x4f8734, 0x245b31];
    const random = this.seededNoise(map.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) + map.width + map.height);
    const patchCount = Math.max(30, Math.floor((map.width * map.height) / 55000));
    for (let i = 0; i < patchCount; i++) {
      const w = 64 + Math.floor(random() * 144);
      const d = 48 + Math.floor(random() * 128);
      const x = 32 + random() * Math.max(1, map.width - 64);
      const z = 32 + random() * Math.max(1, map.height - 64);
      const h = 5 + Math.floor(random() * 8);
      this.addTerrainBlock(terrain, x, z, w, h, d, palette[i % palette.length]);
    }
    if (map.id === 'town_square') {
      this.addTerrainBlock(terrain, 560, 360, 390, 34, 170, 0xbbae91);
      this.addTerrainBlock(terrain, 560, 425, 280, 58, 105, 0xa89a80);
      this.addTerrainBlock(terrain, 690, 500, 135, 22, 85, 0x8f8374);
      this.addTerrainBlock(terrain, 775, 535, 110, 18, 70, 0x7d7467);
      this.addTerrainBlock(terrain, 260, 340, 82, 120, 82, 0x8f8374);
      this.addTerrainBlock(terrain, 410, 315, 78, 155, 78, 0x6f6974);
      this.addTerrainBlock(terrain, 900, 320, 95, 145, 95, 0x4b4a42);
      this.addTerrainBlock(terrain, 1040, 560, 105, 180, 105, 0x2c2d40);
      this.addTerrainBlock(terrain, 230, 620, 240, 28, 105, 0x1f4f33);
      this.addTerrainBlock(terrain, 880, 700, 220, 28, 105, 0x1f4f33);
      this.addTerrainBlock(terrain, 1110, 780, 180, 30, 92, 0x254d36);
    }
  }

  private drawFloor(id: MapId): void {
    const map = MapManager.getMap(id);
    if (this.isEarthmoverTerrainMap(map)) {
      this.drawEarthmoverTerrain(map);
      return;
    }
    this.scene.background = new THREE.Color('#15202b');
    this.renderer.setClearColor('#15202b', 1);
    if (map.backgroundPath) {
      void this.loadTexture(map.backgroundPath).then((texture) => {
        if (this.currentMapId !== id) return;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(map.width, map.height), new THREE.MeshBasicMaterial({ map: texture }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(map.width / 2, -2, map.height / 2);
        this.floorLayer.add(mesh);
      });
      return;
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(map.width, map.height), new THREE.MeshBasicMaterial({ color: map.theme }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(map.width / 2, -2, map.height / 2);
    this.floorLayer.add(floor);
  }

  private async drawMapObjects(id: MapId): Promise<void> {
    const map = MapManager.getMap(id);
    if (this.isEarthmoverTerrainMap(map)) return;
    const objects = [...(map.objects ?? [])].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    for (const object of objects) {
      const texture = await this.loadTexture(object.spritePath);
      if (this.currentMapId !== id) return;
      const mesh = this.plane(texture, object.w, object.h, 'top-left');
      mesh.position.set(object.x + object.w / 2, object.h / 2, object.y + object.h / 2);
      this.objectLayer.add(mesh);
      if (id === 'town_square') this.objectLayer.add(this.label(object.name, object.x + object.w / 2, object.y - 8));
    }
  }

  private async drawNpcs(id: MapId): Promise<void> {
    for (const npc of NpcManager.getNpcsForMap(id)) {
      const group = new THREE.Group();
      group.position.set(npc.x, 0, npc.y);
      const texture = await this.loadTexture(npc.spritePath);
      if (this.currentMapId !== id) return;
      group.add(this.plane(texture, npc.w, npc.h, 'feet'));
      group.add(this.labelSprite(npc.name, 0, npc.h + 4));
      this.npcLayer.add(group);
    }
  }

  private async drawFurniture(id: MapId): Promise<void> {
    for (const placed of this.profile.placedFurniture.filter((item) => item.mapId === id)) {
      const def = FurnitureManager.getById(placed.furnitureId);
      if (!def) continue;
      const texture = await this.loadTexture(FurnitureManager.getSpritePath(def, placed.rotation));
      if (this.currentMapId !== id) return;
      const group = new THREE.Group();
      group.position.set(placed.x, 0, placed.y);
      group.add(this.plane(texture, def.w, def.h, 'feet'));
      this.furnitureLayer.add(group);
    }
  }


  private drawPrototypeDecorations(mapId: MapId): void {
    if (mapId !== 'town_square') return;

    const shrine = new RotatingWorldModel({
      name: 'Prototype Crystal Shrine',
      path: '/assets/prototype/mmd/crystal_shrine/stylised_crystal_shrine.glb',
      targetHeight: 96,
      spinSpeed: 0.28
    });
    shrine.position.set(690, 0, 500);

    const crystalA = new RotatingWorldModel({
      name: 'Prototype Crystal A',
      path: '/assets/prototype/mmd/crystal/crystal.glb',
      targetHeight: 48,
      spinSpeed: 1.15
    });
    crystalA.position.set(610, 0, 460);

    const crystalB = new RotatingWorldModel({
      name: 'Prototype Crystal B',
      path: '/assets/prototype/mmd/crystal/crystal.glb',
      targetHeight: 36,
      spinSpeed: -0.9
    });
    crystalB.position.set(770, 0, 535);

    const crystalC = new RotatingWorldModel({
      name: 'Prototype Crystal C',
      path: '/assets/prototype/mmd/crystal/crystal.glb',
      targetHeight: 30,
      spinSpeed: 0.75
    });
    crystalC.position.set(650, 0, 585);

    this.rotatingModels.push(shrine, crystalA, crystalB, crystalC);
    this.rotatingModelLayer.add(shrine, crystalA, crystalB, crystalC);
  }

  private updateRotatingModels(dt: number): void {
    for (const model of this.rotatingModels) model.update(dt);
  }

  private redrawFurniture(): void { this.clearGroup(this.furnitureLayer); void this.drawFurniture(this.currentMapId); this.redrawDebug(); }
  private createLocalPlayerSprite(): void { const player = new PrototypePlayerModel(this.local.userId, this.local.displayName, this.local.avatar); this.players.set(this.local.userId, player); this.scene.add(player); }

  private async startPlacement(furnitureId: string): Promise<void> {
    this.cancelPlacement();
    const def = FurnitureManager.getById(furnitureId);
    if (!def) return;
    const map = MapManager.getMap(this.currentMapId);
    if (!FurnitureManager.canPlaceOnMap(def, map)) return console.warn('Cannot place this furniture here');
    const texture = await this.loadTexture(FurnitureManager.getSpritePath(def, 0));
    const group = new THREE.Group();
    const mesh = this.plane(texture, def.w, def.h, 'feet');
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.58;
    (mesh.material as THREE.MeshBasicMaterial).transparent = true;
    group.add(mesh);
    this.placementLayer.add(group);
    this.placement = { furnitureId, ghost: group, rotation: 0 };
    this.setBuildMode('place');
    this.callbacks.onPrompt?.('Build mode: click to place ・ R rotate ・ Esc cancel');
  }

  private cancelPlacement(): void { if (this.placement?.ghost) this.placementLayer.remove(this.placement.ghost); this.placement = null; }
  private async rotatePlacement(): Promise<void> { if (!this.placement?.ghost) return; const pos = this.placement.ghost.position.clone(); const id = this.placement.furnitureId; const next = FurnitureManager.nextRotation(this.placement.rotation); this.cancelPlacement(); await this.startPlacement(id); if (this.placement) { this.placement.rotation = next; this.placement.ghost?.position.copy(pos); } }
  private startDeleteMode(): void { if (!isHqMap(this.currentMapId)) return; this.cancelPlacement(); this.setBuildMode('delete'); this.callbacks.onPrompt?.('Delete mode: click furniture to remove ・ Esc cancel'); }
  private handleBuildClick(event: MouseEvent): void { if (this.buildMode === 'place') this.placeGhost(event); else if (this.buildMode === 'delete') this.deleteFurnitureAtMouse(event); }

  private worldPointFromMouse(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.groundPlane, hit);
    return { x: hit.x, y: hit.z };
  }
  private updatePlacementGhost(event: MouseEvent): void { if (!this.placement?.ghost) return; const point = this.worldPointFromMouse(event); const snapped = PlacementManager.snapPoint(point.x, point.y); this.placement.ghost.position.set(snapped.x, 0, snapped.y); }
  private placeGhost(event: MouseEvent): void { if (!this.placement) return; const point = this.worldPointFromMouse(event); const snapped = PlacementManager.snapPoint(point.x, point.y); const map = MapManager.getMap(this.currentMapId); const check = PlacementManager.canPlace(this.profile, map, this.placement.furnitureId, snapped.x, snapped.y, this.placement.rotation); if (!check.ok) return console.warn(check.reason); const placed: PlacedFurniture = { instanceId: PlacementManager.createInstanceId(), furnitureId: this.placement.furnitureId, mapId: this.currentMapId, x: snapped.x, y: snapped.y, rotation: this.placement.rotation }; this.profile = { ...this.profile, placedFurniture: [...this.profile.placedFurniture, placed] }; this.cancelPlacement(); this.setBuildMode('none'); this.redrawFurniture(); this.callbacks.onFurniturePlaced?.(this.profile.placedFurniture); }
  private deleteFurnitureAtMouse(event: MouseEvent): void { const point = this.worldPointFromMouse(event); const target = this.findFurnitureAtPoint(point.x, point.y); if (!target) return; this.profile = { ...this.profile, placedFurniture: this.profile.placedFurniture.filter((item) => item.instanceId !== target.instanceId) }; this.redrawFurniture(); this.callbacks.onFurniturePlaced?.(this.profile.placedFurniture); }
  private findFurnitureAtPoint(x: number, y: number): PlacedFurniture | null { for (const item of [...this.profile.placedFurniture].filter((i) => i.mapId === this.currentMapId).reverse()) { const def = FurnitureManager.getById(item.furnitureId); if (!def) continue; const rect = { x: item.x - def.w / 2, y: item.y - def.h, w: def.w, h: def.h }; if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return item; } return null; }

  private playerColliderAt(x: number, y: number): Rect { return { x: x - 10, y: y - 40, w: 20, h: 35 }; }
  private getSolidColliders(): Rect[] { return CollisionManager.getSolidColliders(this.currentMapId, this.profile); }
  private collidesAt(x: number, y: number): boolean { return CollisionManager.collides(this.playerColliderAt(x, y), this.getSolidColliders()); }
  private nearestNpc(): NpcDef | null { return InteractionManager.findNearestNpc(this.currentMapId, this.local.x, this.local.y); }
  private checkDoor(): void { if (this.transitionCooldown > 0) return; const door = InteractionManager.findWalkInDoor(this.currentMapId, this.local.x, this.local.y); if (!door) return; this.transitionCooldown = 0.55; this.loadMap(door.targetMapId, door.spawn); }

  private update(dt: number): void {
    this.transitionCooldown = Math.max(0, this.transitionCooldown - dt);
    if (this.input.consume('f2')) { this.debugColliders = !this.debugColliders; this.redrawDebug(); }
    if (this.input.consume('f3')) { this.usePixelShader = !this.usePixelShader; console.info(`Legacy pixel shader ${this.usePixelShader ? 'ON' : 'OFF'}`); }
    if (this.input.consume('f4')) { this.useStylizedShader = !this.useStylizedShader; console.info(`Stylized shader ${this.useStylizedShader ? 'ON' : 'OFF'}`); }
    if (this.input.consume('i')) this.callbacks.onMenuToggle();
    if (this.input.consume('b') && isHqMap(this.currentMapId)) { if (this.buildMode !== 'none') this.exitBuildMode(); else window.dispatchEvent(new CustomEvent('cardworld:open-hq-build-menu')); }
    const blocked = this.callbacks.isInputBlocked() || this.buildMode === 'place' || this.buildMode === 'delete';
    if (!blocked && this.input.consume('e')) { const npc = this.nearestNpc(); if (npc) this.callbacks.onNpcInteract(npc); }
    this.callbacks.onPrompt?.(this.buildMode === 'place' ? 'Build mode: click to place ・ R rotate ・ Esc cancel' : this.buildMode === 'delete' ? 'Delete mode: click furniture to remove ・ Esc cancel' : (!blocked ? InteractionManager.getNpcPrompt(this.nearestNpc()) : null));
    this.updateMovement(blocked, dt);
    this.updateLocalPlayerSprite(dt);
    this.savePositionPeriodically();
    if (this.debugColliders) this.redrawDebug();
    this.updateRotatingModels(dt);
    if (this.useStylizedShader && this.stylizedPass) this.stylizedPass.render();
    else if (this.usePixelShader && this.pixelPass) this.pixelPass.render();
    else this.renderer.render(this.scene, this.camera);
  }

  private updateMovement(blocked: boolean, dt: number): void {
    let dx = 0, dy = 0;
    if (!blocked) { if (this.input.left) { dx--; this.local.direction = 'left'; } if (this.input.right) { dx++; this.local.direction = 'right'; } if (this.input.up) { dy--; this.local.direction = 'up'; } if (this.input.down) { dy++; this.local.direction = 'down'; } }
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    const speed = this.input.running ? 200 : 160;
    this.local.moving = Boolean(dx || dy);
    const map = MapManager.getMap(this.currentMapId);
    const nextX = Math.max(PLAYER_BOUND_LEFT, Math.min(map.width - PLAYER_BOUND_RIGHT, this.local.x + dx * speed * dt));
    const nextY = Math.max(PLAYER_BOUND_TOP, Math.min(map.height - PLAYER_BOUND_BOTTOM, this.local.y + dy * speed * dt));
    if (!this.collidesAt(nextX, this.local.y)) this.local.x = nextX;
    if (!this.collidesAt(this.local.x, nextY)) this.local.y = nextY;
    if (!blocked) this.checkDoor();
    this.callbacks.onCoordinatesChanged?.(this.local.x, this.local.y, this.currentMapId);
  }

  private updateLocalPlayerSprite(dt: number): void {
    const player = this.players.get(this.local.userId);
    if (!player) return;
    player.position.set(this.local.x, 0, this.local.y);
    player.update(this.local.moving, this.local.avatar, dt, this.local.direction);
    this.updateCameraForTarget(this.local.x, this.local.y);
  }
  private savePositionPeriodically(): void { const t = performance.now(); if (t - this.lastPositionSave <= POSITION_SAVE_INTERVAL_MS) return; this.lastPositionSave = t; this.callbacks.onPositionSave?.(this.currentMapId, this.local.x, this.local.y); }
  private redrawDebug(): void { this.clearGroup(this.debugLayer); this.drawDebug(this.currentMapId); }
  private drawDebug(id: MapId): void { if (!this.debugColliders) return; const add = (r: Rect, color: number, y = 2) => { const pts = [new THREE.Vector3(r.x, y, r.y), new THREE.Vector3(r.x + r.w, y, r.y), new THREE.Vector3(r.x + r.w, y, r.y), new THREE.Vector3(r.x + r.w, y, r.y + r.h), new THREE.Vector3(r.x + r.w, y, r.y + r.h), new THREE.Vector3(r.x, y, r.y + r.h), new THREE.Vector3(r.x, y, r.y + r.h), new THREE.Vector3(r.x, y, r.y)]; this.debugLayer.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color }))); }; for (const collider of this.getSolidColliders()) add(collider, 0xff3333); for (const door of DoorManager.getDoorsForMap(id)) add(door.trigger, 0x66ccff, 3); for (const npc of NpcManager.getNpcsForMap(id)) add({ x: npc.x - npc.interactionRadius, y: npc.y - npc.interactionRadius, w: npc.interactionRadius * 2, h: npc.interactionRadius * 2 }, 0x00ff66, 4); add(this.playerColliderAt(this.local.x, this.local.y), 0xffff00, 5); }

  private async loadTexture(path: string): Promise<THREE.Texture> { return new Promise((resolve) => this.loader.load(path, (texture) => { texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.SRGBColorSpace; resolve(texture); }, undefined, () => resolve(this.fallbackTexture()))); }
  private fallbackTexture(): THREE.Texture { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#66ccff'; ctx.fillRect(0, 0, 32, 32); ctx.strokeStyle = '#fff'; ctx.strokeRect(2, 2, 28, 28); const texture = new THREE.CanvasTexture(canvas); texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; return texture; }
  private plane(texture: THREE.Texture, w: number, h: number, anchor: 'feet' | 'top-left'): THREE.Mesh { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.01, depthWrite: false })); if (anchor === 'feet') mesh.position.y = h / 2; return mesh; }
  private label(text: string, x: number, y: number): THREE.Sprite { const sprite = this.labelSprite(text, 0, 0); sprite.position.set(x, 32, y); return sprite; }
  private labelSprite(text: string, x: number, y: number): THREE.Sprite { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d')!; ctx.font = '700 12px sans-serif'; canvas.width = Math.max(80, Math.ceil(ctx.measureText(text).width) + 12); canvas.height = 24; ctx.font = '700 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff'; ctx.strokeText(text, canvas.width / 2, 12); ctx.fillText(text, canvas.width / 2, 12); const texture = new THREE.CanvasTexture(canvas); texture.magFilter = THREE.NearestFilter; const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })); sprite.scale.set(canvas.width, canvas.height, 1); sprite.position.set(x, y, 0); return sprite; }
}