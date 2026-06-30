import type { DoorDef, MapDef } from '../types';

export const facilityMaps: MapDef[] = [
  { id: 'arcade', name: 'Arcade', category: 'facility', theme: 0x2f2555, width: 1024, height: 704, objects: [], colliders: [] },
  { id: 'furniture_shop', name: 'Furniture Shop', category: 'facility', theme: 0x5d4631, width: 1024, height: 704, objects: [], colliders: [] },
  { id: 'armor_shop', name: 'Armor Shop', category: 'facility', theme: 0x3f4656, width: 1024, height: 704, objects: [], colliders: [] },
  { id: 'card_shop', name: 'Card Shop', category: 'facility', theme: 0x285656, width: 1024, height: 704, objects: [], colliders: [] }
];

export const facilityDoors: DoorDef[] = [
  { id: 'arcade_to_town', mapId: 'arcade', trigger: { x: 450, y: 650, w: 100, h: 18 }, targetMapId: 'town_square', spawn: { x: 197, y: 308 }, label: 'Exit' },
  { id: 'furniture_shop_to_town', mapId: 'furniture_shop', trigger: { x: 450, y: 650, w: 100, h: 18 }, targetMapId: 'town_square', spawn: { x: 223, y: 144 }, label: 'Exit' },
  { id: 'armor_shop_to_town', mapId: 'armor_shop', trigger: { x: 450, y: 650, w: 100, h: 18 }, targetMapId: 'town_square', spawn: { x: 347, y: 144 }, label: 'Exit' },
  { id: 'card_shop_to_town', mapId: 'card_shop', trigger: { x: 450, y: 650, w: 100, h: 18 }, targetMapId: 'town_square', spawn: { x: 450, y: 144 }, label: 'Exit' }
];