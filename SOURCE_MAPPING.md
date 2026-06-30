# Source-of-truth mapping

## Original PixiJS source -> Clean Three project

- `apps/web/src/ui/domUI.ts` -> `src/ui/domUI.ts`: preserved HTML/CSS UI, login/HUD/menu/dialogue/avatar/HQ/furniture shop, event names.
- `apps/web/src/cards/CardManager.ts` -> `src/cards/CardManager.ts`: preserved binder filtering, sorting, pagination, image URL rules.
- `apps/web/src/cards/cardConstants.ts` -> `src/cards/cardConstants.ts`: preserved rarity/color ordering.
- `apps/web/src/world/**` -> `src/world/**`: preserved maps, NPCs, doors, quests, dialogue, collision/interaction managers.
- `apps/web/src/hq/**` -> `src/hq/**`: preserved furniture catalog, shop, placement, rotation, deletion, collision rules.
- `apps/web/src/avatar/AvatarPartsManager.ts` -> `src/avatar/AvatarPartsManager.ts`: preserved avatar creator preview data.
- `apps/web/src/profile/ProfileManager.ts` -> `src/profile/ProfileManager.ts`: preserved progress/position/furniture save flow.
- `apps/web/src/net/api.ts` -> `src/net/api.ts`: preserved client route names.
- `apps/web/src/game/Input.ts` -> `src/game/Input.ts`: preserved keyboard input semantics.
- `apps/web/src/game/PixiGame.ts` -> `src/game/ThreeGame.ts`: gameplay logic ported to Three.js rendering only.
- `apps/web/src/entities/AvatarSprite.ts` -> not in default render path; replaced by `src/entities/PrototypePlayerModel.ts` for GLB visual placeholder.

## Pixel shader repo -> Clean Three project

- `src/RenderPixelatedPass.ts` from `pixel-shader-source-bundle.txt` -> `src/effects/CardWorldPixelPass.ts`: local direct-to-screen pass using low-res color render target, normal render target, depth texture, nearest filtering, and depth/normal edge shader logic.
- The shader is optional and disabled by default. Press `F3` to toggle it.
