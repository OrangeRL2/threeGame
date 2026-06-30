import { updateProgress } from '../net/api';
import type { GameProfile, PlacedFurniture, ProgressPatch } from '../types/shared';
import { normalizeProfile } from '../types/shared';
export class ProfileManager {
  static normalize(profile: GameProfile): GameProfile { return normalizeProfile(profile); }
  static async applyProgress(patch: ProgressPatch): Promise<GameProfile> { return normalizeProfile(await updateProgress(patch)); }
  static async savePosition(mapId:string, x:number, y:number): Promise<GameProfile> { return this.applyProgress({currentMapId:mapId,position:{x:Math.round(x),y:Math.round(y)}}); }
  static async savePlacedFurniture(placedFurniture: PlacedFurniture[]): Promise<GameProfile> { return this.applyProgress({setPlacedFurniture:placedFurniture}); }
}