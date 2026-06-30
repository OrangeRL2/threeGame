import type { DoorDef, MapDef, MapId } from '../types';
import { facilityDoors, facilityMaps } from './facilities';
import { hqDoors, hqGardenMap, hqRoomMap } from './hq';
import { townSquareDoors, townSquareMap } from './townSquare';
import { westCityDoors, westCityMap } from './westCity';
const mapList: MapDef[] = [townSquareMap, westCityMap, hqRoomMap, hqGardenMap, ...facilityMaps];
export const maps: Record<MapId, MapDef> = Object.fromEntries(mapList.map((map)=>[map.id,map])) as Record<MapId, MapDef>;
export const doors: DoorDef[] = [...townSquareDoors, ...westCityDoors, ...hqDoors, ...facilityDoors];