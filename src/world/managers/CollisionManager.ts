import type { GameProfile } from '../../types/shared';
import { FurnitureManager } from '../../hq/managers/FurnitureManager';
import { MapManager } from './MapManager';
import { NpcManager } from './NpcManager';
import type { MapId, Rect } from '../types';
export class CollisionManager {
  static rectsOverlap(a: Rect, b: Rect): boolean { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  static getSolidColliders(mapId: MapId, profile?: GameProfile): Rect[] {
    const map = MapManager.getMap(mapId);
    const mapColliders = (map.colliders ?? []).map(c=>c.rect);
    const objectColliders = (map.objects ?? []).filter(o=>Boolean(o.collider)).map(o=>o.collider!);
    const npcColliders = NpcManager.getNpcsForMap(mapId).filter(n=>Boolean(n.collider)).map(n=>n.collider!);
    const furnitureColliders = (profile?.placedFurniture ?? []).filter(p=>p.mapId===mapId).map(p=>FurnitureManager.getPlacedCollision(p)).filter(Boolean) as Rect[];
    return [...mapColliders,...objectColliders,...npcColliders,...furnitureColliders];
  }
  static collides(player: Rect, colliders: Rect[]): boolean { return colliders.some(c=>this.rectsOverlap(player,c)); }
}