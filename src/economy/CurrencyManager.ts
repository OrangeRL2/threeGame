import type { GameProfile } from '../types/shared';
export type CurrencyId = 'holoCoins';
export class CurrencyManager {
  static label(currency: CurrencyId): string { return currency === 'holoCoins' ? 'HoloCoins' : currency; }
  static getBalance(profile: GameProfile, currency: CurrencyId = 'holoCoins'): number { return profile.currencies.holoCoins ?? profile.currencies.arcadeCoins ?? 0; }
  static format(amount: number, currency: CurrencyId = 'holoCoins'): string { return `${amount.toLocaleString()} ${this.label(currency)}`; }
}