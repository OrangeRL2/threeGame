import type { DoorDef, MapDef } from '../types';
export const hqRoomMap: MapDef = {
  id:'hq_room', name:'My HQ', category:'hq_room', theme:0x3f3548, width:1024, height:704,
  objects:[], colliders:[], placementZones:[{id:'room_floor',kind:'indoor',rect:{x:112,y:92,w:800,h:540}}]
};
export const hqGardenMap: MapDef = {
  id:'hq_garden', name:'HQ Garden', category:'hq_garden', theme:0x4f7a55, width:1024, height:704,
  objects:[], colliders:[], placementZones:[{id:'garden_area',kind:'garden',rect:{x:64,y:64,w:896,h:580}}]
};
export const hqDoors: DoorDef[] = [
  {id:'hq_room_to_garden',mapId:'hq_room',trigger:{x:448,y:650,w:128,h:36},targetMapId:'hq_garden',spawn:{x:512,y:120},label:'Garden'},
  {id:'hq_garden_to_room',mapId:'hq_garden',trigger:{x:448,y:70,w:128,h:36},targetMapId:'hq_room',spawn:{x:512,y:620},label:'HQ Room'}
];