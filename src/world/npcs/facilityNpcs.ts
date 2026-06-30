import type { NpcDef } from '../types';

export const facilityNpcs: NpcDef[] = [
  { id: 'pekora', name: 'Pekora', mapId: 'arcade', spritePath: '/assets/world/npcs/pekora.png', x: 512, y: 330, w: 32, h: 48, interactionRadius: 64, flag: 'learned_arcade' },
  { id: 'raden', name: 'Raden', mapId: 'furniture_shop', spritePath: '/assets/world/npcs/raden.png', x: 512, y: 330, w: 32, h: 48, interactionRadius: 64, flag: 'learned_furniture_shop' },
  { id: 'noel', name: 'Noel', mapId: 'armor_shop', spritePath: '/assets/world/npcs/noel.png', x: 512, y: 330, w: 32, h: 48, interactionRadius: 64, flag: 'learned_armor_shop' },
  { id: 'fubuki', name: 'Fubuki', mapId: 'card_shop', spritePath: '/assets/world/npcs/fubuki.png', x: 512, y: 330, w: 32, h: 48, interactionRadius: 64, flag: 'learned_card_shop' }
];