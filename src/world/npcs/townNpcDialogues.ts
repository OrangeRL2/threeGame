import { HQManager } from '../../hq/managers/HQManager';
import { QuestManager } from '../managers/QuestManager';
import type { NpcDialogueTable } from './dialogueTypes';
export const townNpcDialogues: NpcDialogueTable = {
  achan: ({ flags, keyItems, npc }) => {
    if (!flags.includes('talked_to_achan_intro')) return { lines:['Welcome to Town Square!','Visit the Card Shop, Arcade, Furniture Shop, and Armor Shop.','The guides inside each facility will explain what you can do there.'], patch:{addFlags:[npc.flag]} };
    if (QuestManager.isQuestComplete('town_facility_tour', flags) && !keyItems.includes(HQManager.REQUIRED_KEY_ITEM)) return { lines:['You visited all of the town facilities. Excellent work!','Please take this HQ Recommendation Letter. Bring it to me again when you are ready for your own HQ.'], patch:{addFlags:['completed_town_tour'], addKeyItems:[HQManager.REQUIRED_KEY_ITEM]} };
    if (keyItems.includes(HQManager.REQUIRED_KEY_ITEM)) return { lines:['Your HQ is ready. Would you like to go there now?'], patch:{addFlags:['hq_unlocked']}, choices:[{label:'Go to HQ', action:'go_hq', patch:HQManager.entryPatch()},{label:'Stay here', action:'close'}] };
    return { lines:[QuestManager.isQuestComplete('town_facility_tour', flags) ? 'You have completed the town tour.' : 'Keep visiting the facilities around Town Square.'], patch:{addFlags:[npc.flag]} };
  },
  hq_achan: () => ({ lines:['Welcome to your HQ. This is your personal space.','You can decorate your room and garden from here.'], patch:{addFlags:['visited_hq']}, choices:[{label:'Return to Town Square', action:'return_town', patch:HQManager.returnTownPatch()},{label:'Stay in HQ', action:'close'}] })
};