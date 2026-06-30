import type { QuestDef } from './questTypes';
export const townFacilityTourQuest: QuestDef = { id:'town_facility_tour', title:'Town Facility Tour', description:'Visit each facility and speak to the guide.', completeFlag:'completed_town_tour', completeMessage:'Return to A-chan in Town Square to unlock your HQ.', incompleteMessage:'Keep exploring the town.', steps:[
  {id:'card_shop',label:'Card Shop - Fubuki',requiredFlag:'learned_card_shop'},
  {id:'arcade',label:'Arcade - Pekora',requiredFlag:'learned_arcade'},
  {id:'furniture_shop',label:'Furniture Shop - Raden',requiredFlag:'learned_furniture_shop'},
  {id:'armor_shop',label:'Armor Shop - Noel',requiredFlag:'learned_armor_shop'}
]};