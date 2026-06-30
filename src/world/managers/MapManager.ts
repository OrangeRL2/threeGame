// apps/web/src/world/managers/MapManager.ts

import { maps } from '../maps';
import type { MapDef, MapId } from '../types';

export class MapManager {
  static getMap(id: MapId): MapDef {
    return maps[id] ?? maps.town_square;
  }

  static isValidMapId(value: string | undefined): value is MapId {
    return Boolean(value && value in maps);
  }

  static safeMapId(value: string | undefined): MapId {
    return this.isValidMapId(value) ? value : 'town_square';
  }
}