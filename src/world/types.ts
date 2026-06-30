export type MapCategory = 'town' | 'facility' | 'hq_room' | 'hq_garden';
export type MapId = 'town_square'|'west_city'|'arcade'|'furniture_shop'|'armor_shop'|'card_shop'|'hq_room'|'hq_garden';
export type NpcId = 'achan'|'hq_achan'|'pekora'|'raden'|'noel'|'fubuki';
export interface Rect { x:number;y:number;w:number;h:number }
export interface SpawnPoint { x:number;y:number }
export interface PlacementZoneDef { id:string; kind:'indoor'|'garden'; rect:Rect }
export interface MapObjectDef { id:string;name:string;spritePath:string;x:number;y:number;w:number;h:number;collider?:Rect;zIndex?:number }
export interface MapColliderDef { id:string;name:string;rect:Rect }
export interface MapDef { id:MapId; name:string; category:MapCategory; theme:number; width:number; height:number; backgroundPath?:string; objects?:MapObjectDef[]; colliders?:MapColliderDef[]; placementZones?:PlacementZoneDef[] }
export interface DoorDef { id:string; mapId:MapId; trigger:Rect; targetMapId:MapId; spawn:SpawnPoint; label:string }
export interface NpcDef { id:NpcId; name:string; mapId:MapId; spritePath:string; x:number; y:number; w:number; h:number; interactionRadius:number; collider?:Rect; flag:string }