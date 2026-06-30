from pathlib import Path

p = Path('src/game/ThreeGame.ts')
s = p.read_text(encoding='utf-8')

if "../entities/RotatingWorldModel" not in s:
    s = s.replace(
        "import { PrototypePlayerModel } from '../entities/PrototypePlayerModel';",
        "import { PrototypePlayerModel } from '../entities/PrototypePlayerModel';\nimport { RotatingWorldModel } from '../entities/RotatingWorldModel';",
        1
    )

if 'private rotatingModelLayer = new THREE.Group();' not in s:
    s = s.replace(
        'private debugLayer = new THREE.Group();',
        'private debugLayer = new THREE.Group();\n  private rotatingModelLayer = new THREE.Group();\n  private rotatingModels: RotatingWorldModel[] = [];',
        1
    )

s = s.replace(
    'this.scene.add(this.floorLayer, this.furnitureLayer, this.objectLayer, this.npcLayer, this.placementLayer, this.debugLayer);',
    'this.scene.add(this.floorLayer, this.furnitureLayer, this.objectLayer, this.npcLayer, this.placementLayer, this.rotatingModelLayer, this.debugLayer);',
    1
)

old_clear = 'this.clearGroup(this.floorLayer); this.clearGroup(this.furnitureLayer); this.clearGroup(this.placementLayer); this.clearGroup(this.objectLayer); this.clearGroup(this.npcLayer); this.clearGroup(this.debugLayer);\n    this.drawFloor(mapId);'
new_clear = 'this.clearGroup(this.floorLayer); this.clearGroup(this.furnitureLayer); this.clearGroup(this.placementLayer); this.clearGroup(this.objectLayer); this.clearGroup(this.npcLayer); this.clearGroup(this.rotatingModelLayer); this.clearGroup(this.debugLayer); this.rotatingModels = [];\n    this.drawFloor(mapId);'
if old_clear in s:
    s = s.replace(old_clear, new_clear, 1)
else:
    print('WARNING: clearGroup block did not match. Decorations can still render, but may persist if map reload clearing differs.')

if 'this.drawPrototypeDecorations(mapId);' not in s:
    s = s.replace(
        'void this.drawNpcs(mapId);\n    this.drawDebug(mapId);',
        'void this.drawNpcs(mapId);\n    this.drawPrototypeDecorations(mapId);\n    this.drawDebug(mapId);',
        1
    )

if 'this.updateRotatingModels(dt);' not in s:
    s = s.replace(
        'if (this.debugColliders) this.redrawDebug();\n    if (this.usePixelShader && this.pixelPass) this.pixelPass.render();',
        'if (this.debugColliders) this.redrawDebug();\n    this.updateRotatingModels(dt);\n    if (this.usePixelShader && this.pixelPass) this.pixelPass.render();',
        1
    )

if 'private drawPrototypeDecorations' not in s:
    methods = """
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

"""
    marker = '  private redrawFurniture(): void'
    if marker not in s:
        raise SystemExit('Could not find insertion point: private redrawFurniture(): void')
    s = s.replace(marker, methods + marker, 1)

p.write_text(s, encoding='utf-8')
print('Added rotating crystal/shrine prototype models to town_square.')
print('Backup saved as src/game/ThreeGame.ts.bak-rotating-crystals')
