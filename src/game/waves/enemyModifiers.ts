import type { EnemyModifierSummary, EnemyWaveScaling } from '../types';

export type EnemyModifierId =
  | 'overclocked'
  | 'reinforcedCarapace'
  | 'broodSwarm'
  | 'rapidIncubation'
  | 'feralSurge'
  | 'ironcladHosts';

interface EnemyModifierDefinition extends EnemyModifierSummary {
  id: EnemyModifierId;
  apply(scaling: EnemyWaveScaling): void;
}

const ENEMY_MODIFIERS: EnemyModifierDefinition[] = [
  {
    id: 'overclocked',
    name: 'Overclocked',
    description: 'Enemies move 25% faster.',
    apply(scaling) {
      scaling.speedMultiplier *= 1.25;
    },
  },
  {
    id: 'reinforcedCarapace',
    name: 'Reinforced Carapace',
    description: '+30% enemy HP and +1 flat HP.',
    apply(scaling) {
      scaling.hpMultiplier *= 1.3;
      scaling.hpBonus += 1;
    },
  },
  {
    id: 'broodSwarm',
    name: 'Brood Swarm',
    description: 'Adds 45% more enemies and tighter waves.',
    apply(scaling) {
      scaling.countMultiplier *= 1.45;
      scaling.cadenceMultiplier *= 0.9;
    },
  },
  {
    id: 'rapidIncubation',
    name: 'Rapid Incubation',
    description: 'Spawn cadence improves by 30% and enemies move 12% faster.',
    apply(scaling) {
      scaling.cadenceMultiplier *= 0.7;
      scaling.speedMultiplier *= 1.12;
    },
  },
  {
    id: 'feralSurge',
    name: 'Feral Surge',
    description: '+15% HP and +20% speed.',
    apply(scaling) {
      scaling.hpMultiplier *= 1.15;
      scaling.speedMultiplier *= 1.2;
    },
  },
  {
    id: 'ironcladHosts',
    name: 'Ironclad Hosts',
    description: 'Adds +2 flat HP and 15% more bodies.',
    apply(scaling) {
      scaling.hpBonus += 2;
      scaling.countMultiplier *= 1.15;
    },
  },
];

export interface EnemyTuningResult {
  scaling: EnemyWaveScaling;
  modifiers: EnemyModifierSummary[];
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function buildEnemyTuning(waveNumber: number): EnemyTuningResult {
  const level = Math.max(0, waveNumber - 1);
  const scaling: EnemyWaveScaling = {
    level,
    hpMultiplier: 1 + level * 0.07,
    hpBonus: 0,
    speedMultiplier: 1 + level * 0.006,
    countMultiplier: 1 + level * 0.05,
    cadenceMultiplier: 1 / (1 + level * 0.025),
  };

  const modifierSlots = Math.floor(level / 5);
  const picks: EnemyModifierDefinition[] = [];
  let pool = [...ENEMY_MODIFIERS];
  for (let i = 0; i < modifierSlots; i++) {
    if (pool.length === 0) {
      pool = [...ENEMY_MODIFIERS];
    }
    const pickIndex = Math.floor(Math.random() * pool.length);
    const [pick] = pool.splice(pickIndex, 1);
    picks.push(pick);
  }

  for (const modifier of picks) {
    modifier.apply(scaling);
  }

  scaling.hpMultiplier = clamp(scaling.hpMultiplier, 1, 5);
  scaling.speedMultiplier = clamp(scaling.speedMultiplier, 0.5, 3);
  scaling.countMultiplier = clamp(scaling.countMultiplier, 1, 3.5);
  scaling.cadenceMultiplier = clamp(scaling.cadenceMultiplier, 0.35, 1);
  scaling.hpBonus = Math.max(0, scaling.hpBonus);

  const modifiers = picks.map(({ id, name, description }) => ({ id, name, description }));

  return { scaling, modifiers };
}
