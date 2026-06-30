import type { NpcDef } from '../types';

export const townNpcs: NpcDef[] = [
  { id: 'achan', name: 'A-chan', mapId: 'town_square', spritePath: '/assets/world/npcs/achan.png', x: 310, y: 443, w: 32, h: 48, interactionRadius: 48, flag: 'talked_to_achan_intro' },
  { id: 'hq_achan', name: 'A-chan', mapId: 'hq_room', spritePath: '/assets/world/npcs/achan.png', x: 404, y: 638, w: 32, h: 48, interactionRadius: 48, flag: 'talked_to_hq_achan' }
];