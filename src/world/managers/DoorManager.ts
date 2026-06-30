// apps/web/src/world/managers/DoorManager.ts

import { doors } from '../maps';
import type { DoorDef, MapId } from '../types';

export class DoorManager {
  static getDoorsForMap(mapId: MapId): DoorDef[] {
    return doors.filter((door) => door.mapId === mapId);
  }

  static findDoorAt(mapId: MapId, x: number, y: number): DoorDef | undefined {
    return doors.find((door) =>
      door.mapId === mapId &&
      x >= door.trigger.x &&
      x <= door.trigger.x + door.trigger.w &&
      y >= door.trigger.y &&
      y <= door.trigger.y + door.trigger.h
    );
  }
}