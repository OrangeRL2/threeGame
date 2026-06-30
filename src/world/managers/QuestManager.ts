import { quests } from '../quests';
import type { QuestDef, QuestViewModel } from '../quests/questTypes';
export class QuestManager {
  static getAllQuests(): QuestDef[] { return quests; }
  static getQuest(id:string): QuestDef|undefined { return quests.find(q=>q.id===id); }
  static isQuestComplete(questId:string, flags:string[]): boolean { const q=this.getQuest(questId); return q ? q.steps.every(s=>flags.includes(s.requiredFlag)) : false; }
  static getQuestViewModels(flags:string[]): QuestViewModel[] { return quests.map(q=>({id:q.id,title:q.title,description:q.description,completeMessage:q.completeMessage,incompleteMessage:q.incompleteMessage,completed:q.steps.every(s=>flags.includes(s.requiredFlag)),steps:q.steps.map(s=>({id:s.id,label:s.label,completed:flags.includes(s.requiredFlag)}))})); }
  static getFacilityFlags(): string[] { const q=this.getQuest('town_facility_tour'); return q?q.steps.map(s=>s.requiredFlag):[]; }
}