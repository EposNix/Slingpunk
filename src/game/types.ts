export interface Vector2 {
  x: number;
  y: number;
}

export type ModifierRarity = 'common' | 'uncommon' | 'rare';

export type RunModifierId =
  | 'bulwarkCore'
  | 'cryoCoating'
  | 'comboDrive'
  | 'repulsorBurst'
  | 'seekerFletching'
  | 'volatileCore'
  | 'fractalSplinters'
  | 'stormLattice'
  | 'triVolley';

export interface ModifierState {
  orbSizeMultiplier: number;
  slowEffect?: { duration: number; factor: number };
  comboDamagePerTier: number;
  knockbackForce: number;
  homingStrength: number;
  explosion?: { radius: number; damage: number };
  splitOnImpact: boolean;
  chainLightning?: { range: number; damage: number; interval: number; cooldown: number };
  tripleLaunch: boolean;
  lastPicked?: RunModifierId;
}

export interface RunModifierDefinition {
  id: RunModifierId;
  name: string;
  description: string;
  rarity: ModifierRarity;
  apply(state: ModifierState): void;
}

export interface HudData {
  score: number;
  comboHeat: number;
  comboTier: number;
  comboProgress: number; // 0 - 1 progress toward next tier
  focus: number;
  lives: number;
  wave: number;
  lastModifier?: RunModifierId;
}

export type EnemyKind =
  | 'GloobZigzag'
  | 'SplitterGloob'
  | 'ShieldyGloob'
  | 'Splitterling'
  | 'Magnetron'
  | 'SporePuff';

export interface WaveEnemyConfig {
  type: EnemyKind;
  hp: number;
  lane: number;
  count: number;
  cadence: number;
}

export interface WaveBlueprint {
  waveId: string;
  spawnSeconds: number;
  enemies: WaveEnemyConfig[];
  bumpers?: Array<{ shape: 'triangle'; x: number; y: number }>;
}
