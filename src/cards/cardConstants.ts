// apps/web/src/cards/cardConstants.ts

import type { CardColor } from '../types/shared';

export const RARITY_ORDER: Record<string, number> = {
  XMAS: 1, VAL: 2, EAS: 3, C: 4, U: 5, R: 6, S: 7, RR: 8, OC: 9, SR: 10,
  OSR: 11, COL: 12, P: 13, SP: 14, UP: 15, SY: 16, UR: 17, OUR: 18, HR: 19,
  BDAY: 20, SEC: 21, ORI: 22, EV: 23
};

export const COLORS: Array<'all' | CardColor> = [
  'all', 'white', 'green', 'red', 'blue', 'purple', 'yellow', 'grey',
  'support', 'mixed', 'typo', 'none'
];

export const COLOR_ORDER: Record<CardColor, number> = {
  white: 1, green: 2, red: 3, blue: 4, purple: 5, yellow: 6, grey: 7,
  support: 8, mixed: 9, typo: 10, none: 11
};

export const RARITIES = [
  'ALL', 'XMAS', 'VAL', 'EAS', 'C', 'U', 'R', 'S', 'RR', 'OC', 'SR', 'COL',
  'OSR', 'P', 'SP', 'UP', 'SY', 'UR', 'OUR', 'HR', 'BDAY', 'SEC', 'ORI', 'EV'
];