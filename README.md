# CardWorld Three Clean

A clean, fresh Three.js CardWorld project generated from the original PixiJS source bundle and the provided pixel shader repository bundle.

## Key guarantees

- This is a fresh project, not a patch.
- The stable default render path is normal Three.js direct rendering.
- The pixel shader is optional and disabled by default.
- Press `F3` to toggle the pixel shader.
- `users` is read-only and remains the binder/card inventory source of truth.
- Three.js profile/world/HQ state is stored in `gameprofiles_three`.
- Binder/card UI, filters, sorting, pagination, NPC/dialogue/quest systems, maps, doors, collision, HQ build mode, furniture shop, and placement/delete/rotate logic are preserved from the PixiJS source.

## Install

```bash
cd ~/pixiJS
rm -rf three-clean
mkdir three-clean
unzip /path/to/cardworld-three-clean.zip -d three-clean
cd three-clean
cp .env.example .env
nano .env
npm install
npm run dev
```

## Copy existing assets

Binary assets are not embedded in the source bundle. Copy them from your PixiJS project:

```bash
mkdir -p public
cp -r ~/pixiJS/cardworld/cardworld/apps/web/public/assets ./public/
```

Copy the prototype GLB model:

```bash
mkdir -p public/assets/prototype/mmd/korone_256fes
cp ~/pixiJS/three-web/public/assets/prototype/mmd/korone_256fes/inugami_korone_for_256fes.glb   public/assets/prototype/mmd/korone_256fes/
```

The game loads:

```text
/assets/prototype/mmd/korone_256fes/inugami_korone_for_256fes.glb
```

## Controls

- WASD / arrows: move
- Shift: run
- I: menu
- E: interact
- B: HQ build menu / exit build mode in HQ
- R: rotate placement ghost
- Esc: cancel placement/delete mode
- F2: debug colliders
- F3: toggle optional repo-based pixel shader

## Pixel shader settings

Open:

```text
src/game/ThreeGame.ts
```

Tune:

```ts
private usePixelShader = false;
private pixelSize = 2;
private normalEdgeCoefficient = 0.18;
private depthEdgeCoefficient = 0.26;
```

The direct render fallback is always available:

```ts
if (this.usePixelShader && this.pixelPass) this.pixelPass.render();
else this.renderer.render(this.scene, this.camera);
```

## Source mapping

See `SOURCE_MAPPING.md`.
