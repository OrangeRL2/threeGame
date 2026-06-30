import type {
  GameProfile,
  PlacedFurniture
} from '../../types/shared';

import type {
  MapDef,
  Rect
} from '../../world/types';

import { furnitureCatalog } from '../furniture/catalog';

import type {
  FurnitureCategory,
  FurnitureDef,
  FurnitureDirection
} from '../furniture/furnitureTypes';

export class FurnitureManager {
  static getCatalog(): FurnitureDef[] {
    return furnitureCatalog;
  }

  static getCategories(): FurnitureCategory[] {
    return [...new Set(furnitureCatalog.map((furniture) => furniture.category))];
  }

  static getById(id: string): FurnitureDef | undefined {
    return furnitureCatalog.find((furniture) => furniture.id === id);
  }

  static getForCategory(category: FurnitureCategory | 'all'): FurnitureDef[] {
    return category === 'all'
      ? furnitureCatalog
      : furnitureCatalog.filter((furniture) => furniture.category === category);
  }

  static getOwnedCount(profile: GameProfile, furnitureId: string): number {
    return profile.ownedFurniture?.find((item) => item.furnitureId === furnitureId)?.count ?? 0;
  }

  static getPlacedCount(profile: GameProfile, furnitureId: string): number {
    return profile.placedFurniture?.filter((item) => item.furnitureId === furnitureId).length ?? 0;
  }

  static getAvailableCount(profile: GameProfile, furnitureId: string): number {
    return Math.max(
      0,
      this.getOwnedCount(profile, furnitureId) - this.getPlacedCount(profile, furnitureId)
    );
  }

  static canBuy(profile: GameProfile, furniture: FurnitureDef): boolean {
    return typeof furniture.price === 'number' && profile.currencies.holoCoins >= furniture.price;
  }

  static canPlaceOnMap(furniture: FurnitureDef, map: MapDef): boolean {
    if (furniture.placement === 'both') {
      return map.category === 'hq_room' || map.category === 'hq_garden';
    }

    if (furniture.placement === 'indoor') {
      return map.category === 'hq_room';
    }

    if (furniture.placement === 'garden') {
      return map.category === 'hq_garden';
    }

    return false;
  }

  static normalizeRotation(rotation: number): number {
    return ((rotation % 360) + 360) % 360;
  }

  static directionFromRotation(rotation: number): FurnitureDirection {
    const normalized = this.normalizeRotation(rotation);

    if (normalized === 90) return 'west';
    if (normalized === 180) return 'north';
    if (normalized === 270) return 'east';

    return 'south';
  }

  static nextRotation(rotation: number): number {
    return (this.normalizeRotation(rotation) + 90) % 360;
  }

  static getSpritePath(furniture: FurnitureDef, rotation = 0): string {
    const direction = this.directionFromRotation(rotation);

    return (
      furniture.sprites?.[direction] ??
      furniture.sprites?.south ??
      furniture.spritePath ??
      furniture.previewPath
    );
  }

  static hasDirectionalSprites(furniture: FurnitureDef): boolean {
    return Boolean(furniture.sprites && Object.keys(furniture.sprites).length > 0);
  }

  static getCollisionRect(
    furniture: FurnitureDef,
    x: number,
    y: number,
    rotation = 0
  ): Rect | null {
    if (!furniture.solid) return null;

    const direction = this.directionFromRotation(rotation);

    const collision =
      furniture.collisions?.[direction] ??
      furniture.collisionFromCenter;

    if (!collision) return null;

    return {
      x: x + collision.x,
      y: y + collision.y,
      w: collision.w,
      h: collision.h
    };
  }

  static getPlacedCollision(placed: PlacedFurniture): Rect | null {
    const furniture = this.getById(placed.furnitureId);

    return furniture
      ? this.getCollisionRect(furniture, placed.x, placed.y, placed.rotation)
      : null;
  }
}