import type { DoorDef, MapDef } from '../types';
export const townSquareMap: MapDef = {
  id:'town_square', name:'Town Square', category:'town', theme:0x718285, width:2048, height:1408, backgroundPath:'/assets/world/maps/town_square.png',
  objects:[
    {id:'arcade_building',name:'Arcade',spritePath:'/assets/world/buildings/arcade.png',x:120,y:126,w:160,h:120,collider:{x:150,y:126,w:100,h:100},zIndex:10},
    {id:'furniture_shop_building',name:'Furniture Shop',spritePath:'/assets/world/buildings/furniture-shop.png',x:360,y:126,w:170,h:120,collider:{x:390,y:126,w:100,h:100},zIndex:10},
    {id:'armor_shop_building',name:'Armor Shop',spritePath:'/assets/world/buildings/armor-shop.png',x:610,y:126,w:170,h:120,collider:{x:640,y:126,w:100,h:100},zIndex:10},
    {id:'card_shop_building',name:'Card Shop',spritePath:'/assets/world/buildings/card-shop.png',x:820,y:126,w:160,h:120,collider:{x:850,y:126,w:100,h:100},zIndex:10},
    {id:'town_signpost',name:'Town Signpost',spritePath:'/assets/world/props/signpost.png',x:1000,y:40,w:64,h:96,collider:{x:484,y:510,w:16,h:34},zIndex:20}
  ],
  colliders:[
    {id:'center_fountain',name:'Center Fountain',rect:{x:513,y:100,w:95,h:82}},
    {id:'parked_car_01',name:'Parked Car',rect:{x:160,y:355,w:125,h:42}},
    {id:'bench_01',name:'Bench',rect:{x:330,y:470,w:72,h:24}}
  ]
};
export const townSquareDoors: DoorDef[] = [
  {id:'town_to_west_city',mapId:'town_square',trigger:{x:24,y:225,w:48,h:1400},targetMapId:'west_city',spawn:{x:510,y:542},label:'West City'},
  {id:'town_to_arcade',mapId:'town_square',trigger:{x:175,y:225,w:50,h:50},targetMapId:'arcade',spawn:{x:512,y:620},label:'Arcade'},
  {id:'town_to_furniture_shop',mapId:'town_square',trigger:{x:420,y:225,w:52,h:50},targetMapId:'furniture_shop',spawn:{x:512,y:620},label:'Furniture Shop'},
  {id:'town_to_armor_shop',mapId:'town_square',trigger:{x:668,y:225,w:52,h:50},targetMapId:'armor_shop',spawn:{x:512,y:620},label:'Armor Shop'},
  {id:'town_to_card_shop',mapId:'town_square',trigger:{x:875,y:225,w:50,h:50},targetMapId:'card_shop',spawn:{x:512,y:620},label:'Card Shop'}
];