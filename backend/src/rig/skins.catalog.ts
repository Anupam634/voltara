/**
 * Cosmetic chassis skins. Purely visual: a skin changes nothing about what a
 * rig makes, only how it looks on the rig screen and the shareable rig card.
 * Priced in whole VOLTS; the stock chassis is free and owned by everyone.
 */
export interface SkinDef {
  id: string;
  name: string;
  priceVolts: number;
  description: string;
  /** Hex accent the UI paints the chassis with. */
  accent: string;
}

export const STOCK_SKIN = 'stock';

export const SKIN_CATALOG: readonly SkinDef[] = [
  {
    id: STOCK_SKIN,
    name: 'Stock chassis',
    priceVolts: 0,
    description: 'The chassis every miner starts on. Obsidian and violet.',
    accent: '#7c3aed',
  },
  {
    id: 'neon',
    name: 'Neon',
    priceVolts: 150,
    description: 'Lime edge lighting that runs the length of every slot.',
    accent: '#a3e635',
  },
  {
    id: 'carbon',
    name: 'Carbon',
    priceVolts: 200,
    description: 'Matte graphite plating. Quiet, no glow.',
    accent: '#9a93ac',
  },
  {
    id: 'overheat',
    name: 'Overheat',
    priceVolts: 250,
    description: 'The thermal-warning skin, worn on purpose.',
    accent: '#f43f5e',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    priceVolts: 400,
    description: 'A violet-to-lime gradient that drifts across the board.',
    accent: '#c084fc',
  },
  {
    id: 'gold',
    name: 'Gold',
    priceVolts: 800,
    description: 'Gold plating. Everyone on the leaderboard will know.',
    accent: '#fbbf24',
  },
];

export function findSkin(id: string): SkinDef | undefined {
  return SKIN_CATALOG.find((s) => s.id === id);
}
