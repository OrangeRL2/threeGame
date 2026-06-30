import type { NpcDialogueTable } from './dialogueTypes';
export const facilityNpcDialogues: NpcDialogueTable = {
  pekora: ({ flags }) => ({ lines:['Welcome to the Arcade, peko!','Take these starter HoloCoins for when the machines are ready.'], patch:flags.includes('received_arcade_starter_coins') ? {addFlags:['learned_arcade']} : {addFlags:['learned_arcade','received_arcade_starter_coins'], currenciesDelta:{holoCoins:1000}} }),
  raden: () => ({ lines:['Welcome to the Furniture Shop.','I sell room and garden furniture for HoloCoins.'], patch:{addFlags:['learned_furniture_shop']}, choices:[{label:'Open Shop', action:'open_furniture_shop'},{label:'Leave', action:'close'}] }),
  noel: () => ({ lines:['Welcome to the Armor Shop.','Armor will help you prepare for expeditions and tougher battles.'], patch:{addFlags:['learned_armor_shop']} }),
  fubuki: () => ({ lines:['Welcome to the Card Shop!','You will be able to open packs here just like in the Discord bot.'], patch:{addFlags:['learned_card_shop']} })
};