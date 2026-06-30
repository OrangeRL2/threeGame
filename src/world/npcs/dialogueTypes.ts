import type { ProgressPatch } from '../../types/shared';
import type { NpcDef, NpcId } from '../types';
export type DialogueAction = 'go_hq'|'return_town'|'open_furniture_shop'|'close';
export interface NpcDialogueChoice { label:string; action:DialogueAction; patch?:ProgressPatch }
export interface NpcDialogueContext { npc:NpcDef; flags:string[]; keyItems:string[] }
export interface NpcDialogueResult { lines:string[]; patch:ProgressPatch; choices?:NpcDialogueChoice[] }
export type NpcDialogueHandler = (context:NpcDialogueContext)=>NpcDialogueResult;
export type NpcDialogueTable = Partial<Record<NpcId,NpcDialogueHandler>>;