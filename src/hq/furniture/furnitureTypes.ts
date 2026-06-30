import type { MapId, Rect } from '../../world/types';

export type FurnitureCategory =
  | 'chairs'
  | 'tables'
  | 'shelves'
  | 'electronics'
  | 'beds'
  | 'plants'
  | 'decor'
  | 'garden';

export type PlacementKind = 'indoor' | 'garden' | 'both';

export type FurnitureDirection =
  | 'south'
  | 'west'
  | 'north'
  | 'east';

export type FurnitureSpriteSet = Partial<Record<FurnitureDirection, string>>;
export type FurnitureCollisionSet = Partial<Record<FurnitureDirection, Rect>>;

export interface FurnitureDef {
  id: string;
  name: string;
  category: FurnitureCategory;

  /**
   * Simple single-sprite mode.
   * Keep this for furniture that does not need directional artwork.
   */
  spritePath?: string;

  /**
   * Directional pixel-art sprite mode.
   * Recommended for chairs, sofas, desks, counters, etc.
   * Rotation values map like this:
   *   0   -> south
   *   90  -> west
   *   180 -> north
   *   270 -> east
   */
  sprites?: FurnitureSpriteSet;

  previewPath: string;

  /** Rendered size in game pixels. */
  w: number;
  h: number;

  /** Optional visual offset if the sprite's base point needs adjustment later. */
  centerOffset?: {
    x: number;
    y: number;
  };

  /**
   * Simple collision mode.
   * Rect is measured from the furniture placement point / center-base point.
   */
  collisionFromCenter?: Rect;

  /**
   * Directional collision mode.
   * Use this when rotated furniture needs different collision dimensions.
   */
  collisions?: FurnitureCollisionSet;

  solid: boolean;
  price?: number;
  placement: PlacementKind;
  questReward?: boolean;
  description?: string;
}

export interface PlacedFurnitureView {
  instanceId: string;
  furnitureId: string;
  mapId: MapId | string;
  x: number;
  y: number;
  rotation: number;
}