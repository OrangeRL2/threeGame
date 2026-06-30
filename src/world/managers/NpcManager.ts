// apps/web/src/world/managers/NpcManager.ts

import { npcs } from '../npcs';
import type { MapId, NpcDef } from '../types';

export class NpcManager {
  static getNpcsForMap(mapId: MapId): NpcDef[] {
    return npcs.filter((npc) => npc.mapId === mapId);
  }

  static findNearestNpc(mapId: MapId, x: number, y: number): NpcDef | null {
    let best: NpcDef | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const npc of this.getNpcsForMap(mapId)) {
      const distance = Math.hypot(npc.x - x, npc.y - y);
      if (distance < npc.interactionRadius && distance < bestDistance) {
        best = npc;
        bestDistance = distance;
      }
    }

    return best;
  }
}