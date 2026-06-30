import type { FurnitureDef } from '../furnitureTypes';
export const woodenChair1: FurnitureDef = {
  id: 'wooden_chair_1', name: 'Wooden Chair', category: 'chairs',
  sprites: {
    south: '/assets/hq/furniture/chairs/wooden-chair-1-south.png',
    west: '/assets/hq/furniture/chairs/wooden-chair-1-west.png',
    north: '/assets/hq/furniture/chairs/wooden-chair-1-north.png',
    east: '/assets/hq/furniture/chairs/wooden-chair-1-east.png'
  },
  previewPath: '/assets/hq/furniture/chairs/wooden-chair-1-south.png',
  w: 32, h: 40, solid: true,
  collisions: {
    south: { x: -12, y: -20, w: 24, h: 20 },
    north: { x: -12, y: -30, w: 24, h: 20 },
    west: { x: -10, y: -19, w: 20, h: 20 },
    east: { x: -10, y: -19, w: 20, h: 20 }
  },
  price: 150, placement: 'indoor', description: 'A simple wooden chair.'
};