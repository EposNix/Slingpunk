export interface Vector2 {
  x: number;
  y: number;
}

export type PowerUpType =
  | 'lightning'
  | 'shield'
  | 'multiball'
  | 'timewarp'
  | 'ricochet'
  | 'pierce';

export interface HudData {
  score: number;
  comboHeat: number;
  comboTier: number;
  comboProgress: number; // 0 - 1 progress toward next tier
  focus: number;
  lives: number;
  wave: number;
  powerUp?: PowerUpType;
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
  powerupDropChance: number;
}
