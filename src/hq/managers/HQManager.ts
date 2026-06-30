import type { GameProfile, ProgressPatch } from '../../types/shared';
export class HQManager {
  static readonly REQUIRED_KEY_ITEM = 'hq_recommendation_letter';
  static isUnlocked(profile: GameProfile): boolean { return profile.keyItems.includes(this.REQUIRED_KEY_ITEM) || profile.progressFlags.includes('hq_unlocked'); }
  static entryPatch(): ProgressPatch { return { addFlags:['hq_unlocked'], currentMapId:'hq_room', position:{x:512,y:620} }; }
  static returnTownPatch(): ProgressPatch { return { currentMapId:'town_square', position:{x:512,y:390} }; }
}