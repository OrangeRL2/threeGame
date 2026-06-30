import type { GameProfile } from '../../types/shared';
import type { MapDef, Rect } from '../../world/types';
import { CollisionManager } from '../../world/managers/CollisionManager';
import { FurnitureManager } from './FurnitureManager';

const GRID_SIZE = 16;

export class PlacementManager {
  static snap(value: number): number {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  static snapPoint(x: number, y: number): { x: number; y: number } {
    return { x: this.snap(x), y: this.snap(y) };
  }

  static createInstanceId(): string {
    return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  static isInsideZone(map: MapDef, x: number, y: number, kind: 'indoor' | 'garden' | 'both'): boolean {
    const zones = map.placementZones ?? [];
    if (!zones.length) return map.category === 'hq_room' || map.category === 'hq_garden';

    return zones.some((zone) =>
      (kind === 'both' || zone.kind === kind) &&
      x >= zone.rect.x &&
      x <= zone.rect.x + zone.rect.w &&
      y >= zone.rect.y &&
      y <= zone.rect.y + zone.rect.h
    );
  }

  static canPlace(
    profile: GameProfile,
    map: MapDef,
    furnitureId: string,
    x: number,
    y: number,
    rotation = 0
  ): { ok: boolean; reason?: string } {
    const def = FurnitureManager.getById(furnitureId);
    if (!def) return { ok: false, reason: 'Unknown furniture' };
    if (!FurnitureManager.canPlaceOnMap(def, map)) return { ok: false, reason: 'Cannot place this furniture here' };
    if (FurnitureManager.getAvailableCount(profile, furnitureId) <= 0) return { ok: false, reason: 'No available copies' };
    if (!this.isInsideZone(map, x, y, def.placement)) return { ok: false, reason: 'Outside placement zone' };

    const rect = FurnitureManager.getCollisionRect(def, x, y, rotation);
    if (rect) {
      const placedRects = (profile.placedFurniture ?? [])
        .filter((placed) => placed.mapId === map.id)
        .map((placed) => FurnitureManager.getPlacedCollision(placed))
        .filter(Boolean) as Rect[];

      if (placedRects.some((collider) => CollisionManager.rectsOverlap(rect, collider))) {
        return { ok: false, reason: 'Furniture overlaps another solid furniture item' };
      }
    }

    return { ok: true };
  }
}