import type { WaveBlueprint } from '../types';

export const waveBlueprints: WaveBlueprint[] = [
  {
    waveId: 'S1-W1',
    spawnSeconds: 18,
    powerupDropChance: 0.08,
    enemies: [
      { type: 'GloobZigzag', hp: 3, lane: 2, count: 4, cadence: 2.5 },
      { type: 'GloobZigzag', hp: 3, lane: 5, count: 4, cadence: 2.5 },
    ],
  },
  {
    waveId: 'S1-W2',
    spawnSeconds: 22,
    powerupDropChance: 0.1,
    enemies: [
      { type: 'GloobZigzag', hp: 4, lane: 1, count: 5, cadence: 2.2 },
      { type: 'SplitterGloob', hp: 3, lane: 3, count: 3, cadence: 4.1 },
      { type: 'ShieldyGloob', hp: 5, lane: 5, count: 2, cadence: 6.5 },
    ],
  },
  {
    waveId: 'S1-W3',
    spawnSeconds: 24,
    powerupDropChance: 0.11,
    enemies: [
      { type: 'SplitterGloob', hp: 4, lane: 2, count: 3, cadence: 5 },
      { type: 'Magnetron', hp: 6, lane: 4, count: 2, cadence: 7 },
      { type: 'SporePuff', hp: 5, lane: 6, count: 2, cadence: 6 },
    ],
  },
  {
    waveId: 'S2-W1',
    spawnSeconds: 26,
    powerupDropChance: 0.12,
    enemies: [
      { type: 'GloobZigzag', hp: 5, lane: 1, count: 4, cadence: 2.1 },
      { type: 'SplitterGloob', hp: 4, lane: 3, count: 4, cadence: 3.5 },
      { type: 'Magnetron', hp: 7, lane: 5, count: 3, cadence: 5 },
      { type: 'SporePuff', hp: 6, lane: 6, count: 3, cadence: 5.5 },
    ],
  },
];

export function pickWave(index: number) {
  return waveBlueprints[index % waveBlueprints.length];
}
