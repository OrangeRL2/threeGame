import { DoorManager } from './DoorManager';
import { NpcManager } from './NpcManager';
import type { DoorDef, MapId, NpcDef } from '../types';
export class InteractionManager {
  static findWalkInDoor(mapId: MapId, x:number, y:number): DoorDef|undefined { return DoorManager.findDoorAt(mapId,x,y); }
  static findNearestNpc(mapId: MapId, x:number, y:number): NpcDef|null { return NpcManager.findNearestNpc(mapId,x,y); }
  static getNpcPrompt(npc:NpcDef|null): string|null { return npc ? `Press E: Talk to ${npc.name}` : null; }
}