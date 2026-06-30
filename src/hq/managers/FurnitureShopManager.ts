import type { GameProfile, ProgressPatch } from '../../types/shared';
import type { FurnitureDef } from '../furniture/furnitureTypes';
import { FurnitureManager } from './FurnitureManager';
export class FurnitureShopManager {
  static buyPatch(profile: GameProfile, furniture: FurnitureDef): ProgressPatch | null {
    if (!FurnitureManager.canBuy(profile, furniture) || typeof furniture.price !== 'number') return null;
    return { currenciesDelta:{holoCoins:-furniture.price}, addFurniture:[{furnitureId:furniture.id,count:1}] };
  }
}