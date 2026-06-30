import type { DoorDef, MapDef } from '../types';
export const westCityMap: MapDef = { id:'west_city', name:'West City', category:'town', theme:0x5f3b2e, width:2048, height:1408, objects:[], colliders:[] };
export const westCityDoors: DoorDef[] = [{id:'west_city_to_town',mapId:'west_city',trigger:{x:448,y:600,w:128,h:36},targetMapId:'town_square',spawn:{x:126,y:350},label:'Exit'}];