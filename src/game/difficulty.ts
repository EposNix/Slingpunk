import type { DifficultyDefinition } from './types';

export const DIFFICULTIES: DifficultyDefinition[] = [
  {
    id: 'rookie',
    name: 'Rookie Protocol',
    tagline: 'For new operatives.',
    description:
      'Amplified cannon output and softened hostiles give you breathing room to learn the sling.',
    playerDamageMultiplier: 1.25,
    enemyHpMultiplier: 0.75,
  },
  {
    id: 'vanguard',
    name: 'Vanguard Run',
    tagline: 'Standard threat profile.',
    description:
      'Baseline Slingpunk tuning where enemy resilience and cannon output are evenly matched.',
    playerDamageMultiplier: 1,
    enemyHpMultiplier: 1,
    isDefault: true,
  },
  {
    id: 'overclocked',
    name: 'Overclocked Siege',
    tagline: 'For hardened agents.',
    description:
      'Outnumbered and outgunned—hostiles surge with reinforced plating while your cannon is throttled.',
    playerDamageMultiplier: 0.85,
    enemyHpMultiplier: 1.35,
  },
];

export const DEFAULT_DIFFICULTY =
  DIFFICULTIES.find((difficulty) => difficulty.isDefault) ?? DIFFICULTIES[0];

export function getDifficultyById(id: string): DifficultyDefinition | undefined {
  return DIFFICULTIES.find((difficulty) => difficulty.id === id);
}
