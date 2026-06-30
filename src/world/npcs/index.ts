import type { NpcDef } from '../types';
import { facilityNpcs } from './facilityNpcs';
import { townNpcs } from './townNpcs';
export const npcs: NpcDef[] = [...townNpcs,...facilityNpcs];