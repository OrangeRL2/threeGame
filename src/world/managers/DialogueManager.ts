import type { NpcDef } from '../types';
import { npcDialogues } from '../npcs/dialogues';
import type { NpcDialogueResult } from '../npcs/dialogueTypes';
export interface DialogueManagerContext { flags:string[]; keyItems:string[] }
export class DialogueManager {
  static getNpcDialogue(npc:NpcDef, context:DialogueManagerContext): NpcDialogueResult { const h=npcDialogues[npc.id]; return h ? h({npc,flags:context.flags,keyItems:context.keyItems}) : {lines:[`${npc.name} has nothing to say yet.`],patch:{addFlags:[npc.flag]}}; }
}