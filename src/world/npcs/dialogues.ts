import type { NpcDialogueTable } from './dialogueTypes';
import { facilityNpcDialogues } from './facilityNpcDialogues';
import { townNpcDialogues } from './townNpcDialogues';
export const npcDialogues: NpcDialogueTable = {...townNpcDialogues,...facilityNpcDialogues};