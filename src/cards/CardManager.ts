// apps/web/src/cards/CardManager.ts

import type { CardColor, CardStack } from '../types/shared';
import { COLOR_ORDER, RARITY_ORDER } from './cardConstants';

export interface CardFilterState {
  query: string;
  rarity: string;
  color: 'all' | CardColor;
  sort: string;
  multiOnly: boolean;
  showLocked: boolean;
}

export class CardManager {
  static cardColor(card: CardStack): CardColor {
    return card.color ?? 'none';
  }

  static cardImageUrl(card: CardStack, imageBase: string): string {
    return `${imageBase}/${encodeURIComponent(card.rarity)}/${encodeURIComponent(card.name)}.png`;
  }

  static rarityRank(rarity: string): number {
    return RARITY_ORDER[String(rarity).toUpperCase()] ?? 0;
  }

  static timeValue(value?: string): number {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  static filterAndSort(cards: CardStack[], state: CardFilterState): CardStack[] {
    const query = state.query.toLowerCase().trim();
    const result = cards
      .filter((card) => card.count > 0)
      .filter((card) => !query || card.name.toLowerCase().includes(query))
      .filter((card) => state.rarity === 'ALL' || card.rarity === state.rarity)
      .filter((card) => state.color === 'all' || this.cardColor(card) === state.color)
      .filter((card) => !state.multiOnly || card.count >= 2)
      .filter((card) => state.showLocked || !card.locked);

    result.sort((a, b) => {
      if (state.sort === 'newest') return this.timeValue(b.lastAcquiredAt) - this.timeValue(a.lastAcquiredAt);
      if (state.sort === 'oldest') return this.timeValue(a.firstAcquiredAt) - this.timeValue(b.firstAcquiredAt);
      if (state.sort === 'amount') return b.count - a.count;
      if (state.sort === 'color') return COLOR_ORDER[this.cardColor(a)] - COLOR_ORDER[this.cardColor(b)];
      if (state.sort === 'name') return a.name.localeCompare(b.name);
      return this.rarityRank(b.rarity) - this.rarityRank(a.rarity) || a.name.localeCompare(b.name);
    });

    return result;
  }

  static paginate<T>(items: T[], page: number, pageSize: number): { slice: T[]; pages: number; page: number } {
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.max(0, Math.min(page, pages - 1));
    return {
      slice: items.slice(safePage * pageSize, safePage * pageSize + pageSize),
      pages,
      page: safePage
    };
  }
}