import { QuestManager } from '../world/managers/QuestManager';
export type {DoorDef,MapColliderDef,MapDef,MapId,MapObjectDef,NpcDef,NpcId,Rect,SpawnPoint,MapCategory,PlacementZoneDef} from '../world/types';
export {maps,doors} from '../world/maps';
export {npcs} from '../world/npcs';
export const facilityFlags = QuestManager.getFacilityFlags();
export const questComplete = (flags:string[]) => QuestManager.isQuestComplete('town_facility_tour', flags);