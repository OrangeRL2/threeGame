// apps/web/src/avatar/AvatarPartsManager.ts

import type { AvatarLoadout, AvatarPartsManifest } from '../types/shared';
import { normalizeAvatarLoadout } from '../types/shared';

type AvatarPartCategory = 'bodies' | 'faces' | 'hair' | 'outfits' | 'bottoms' | 'accessories';
type AvatarCreatorTab = 'hair' | 'outfits' | 'bottoms' | 'accessories' | 'palettes';

const AVATAR_MANIFEST_URL = '/assets/avatar/manifests/avatar-parts.json';

export class AvatarPartsManager {
  private static manifestPromise: Promise<AvatarPartsManifest> | null = null;

  static loadManifest(): Promise<AvatarPartsManifest> {
    this.manifestPromise ??= fetch(AVATAR_MANIFEST_URL).then((response) => {
      if (!response.ok) throw new Error('Failed to load avatar manifest');
      return response.json() as Promise<AvatarPartsManifest>;
    });
    return this.manifestPromise;
  }

  static normalize(loadout?: Partial<AvatarLoadout> | null): AvatarLoadout {
    return normalizeAvatarLoadout(loadout);
  }

  static getParts(manifest: AvatarPartsManifest, category: AvatarPartCategory) {
    return manifest[category];
  }

  static getPreviewPath(manifest: AvatarPartsManifest, layer: AvatarCreatorTab, id: string): string | null {
    if (layer === 'hair') return manifest.hair.find((part) => part.id === id)?.previewPath ?? null;
    if (layer === 'outfits') return manifest.outfits.find((part) => part.id === id)?.previewPath ?? null;
    if (layer === 'bottoms') return manifest.bottoms.find((part) => part.id === id)?.previewPath ?? null;
    if (layer === 'accessories') return manifest.accessories.find((part) => part.id === id)?.previewPath ?? null;
    return null;
  }

  static getPaletteColor(manifest: AvatarPartsManifest, paletteId: string): string {
    return manifest.palettes.find((palette) => palette.id === paletteId)?.primary ?? '#5fd8ff';
  }

  static getLayerPreviewPaths(manifest: AvatarPartsManifest, avatar: AvatarLoadout): string[] {
    const body = manifest.bodies.find((part) => part.id === avatar.bodyId)?.previewPath;
    const face = manifest.faces.find((part) => part.id === avatar.faceId)?.previewPath;
    const bottom = this.getPreviewPath(manifest, 'bottoms', avatar.bottomId);
    const hair = this.getPreviewPath(manifest, 'hair', avatar.hairId);
    const outfit = this.getPreviewPath(manifest, 'outfits', avatar.outfitId);
    const accessories = avatar.accessoryIds
      .filter((id) => id !== 'none')
      .map((id) => this.getPreviewPath(manifest, 'accessories', id))
      .filter(Boolean) as string[];

    return [body, face, bottom, hair, outfit, ...accessories].filter(Boolean) as string[];
  }
}