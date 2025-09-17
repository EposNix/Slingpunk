import type { WaveBlueprint, WaveEnemyConfig } from '../types';
import { clamp, randomRange } from '../utils';

type LaneStrategy = 'random' | 'contiguous' | 'mirrored' | 'center';

interface GroupTemplate {
  id: string;
  minWave: number;
  laneCount: number;
  laneStrategy?: LaneStrategy;
  maxPerWave?: number;
  weight(waveNumber: number): number;
  generate(waveNumber: number, lanes: number[]): WaveEnemyConfig[];
}

const groupTemplates: GroupTemplate[] = [
  {
    id: 'zigzag-stream',
    minWave: 1,
    laneCount: 1,
    laneStrategy: 'random',
    maxPerWave: 2,
    weight: (waveNumber) => Math.max(0.5, 7 - waveNumber * 0.25),
    generate(waveNumber, lanes) {
      const lane = lanes[0] ?? 3;
      const hp = 3 + Math.floor((waveNumber - 1) / 2);
      const count = 4 + Math.floor((waveNumber - 1) / 3) + (Math.random() < 0.35 ? 1 : 0);
      const cadenceBase = 2.8 - waveNumber * 0.05;
      const cadence = clamp(cadenceBase + randomRange(-0.2, 0.2), 1.1, 3.2);
      return [
        {
          type: 'GloobZigzag',
          lane,
          hp,
          count,
          cadence,
        },
      ];
    },
  },
  {
    id: 'zigzag-volley',
    minWave: 2,
    laneCount: 2,
    laneStrategy: 'contiguous',
    weight: (waveNumber) => Math.max(0.6, 5 - waveNumber * 0.15),
    generate(waveNumber, lanes) {
      const hp = 3 + Math.floor(waveNumber / 3);
      const count = 3 + Math.floor(waveNumber / 4);
      const cadenceBase = 2.4 - waveNumber * 0.04;
      const cadence = clamp(cadenceBase + randomRange(-0.15, 0.15), 1, 2.6);
      return lanes.map((lane) => ({ type: 'GloobZigzag', lane, hp, count, cadence }));
    },
  },
  {
    id: 'zigzag-rain',
    minWave: 4,
    laneCount: 3,
    laneStrategy: 'contiguous',
    weight: (waveNumber) => Math.max(0.5, 3.5 - waveNumber * 0.08),
    generate(waveNumber, lanes) {
      const hp = 3 + Math.floor(waveNumber / 3);
      const count = 2 + Math.floor(waveNumber / 5);
      const cadenceBase = 2.1 - waveNumber * 0.03;
      const cadence = clamp(cadenceBase + randomRange(-0.12, 0.12), 0.9, 2.3);
      return lanes.map((lane) => ({ type: 'GloobZigzag', lane, hp, count, cadence }));
    },
  },
  {
    id: 'splitter-column',
    minWave: 2,
    laneCount: 1,
    laneStrategy: 'random',
    maxPerWave: 2,
    weight: (waveNumber) => Math.max(0.6, 4.5 - waveNumber * 0.1),
    generate(waveNumber, lanes) {
      const lane = lanes[0] ?? 4;
      const hp = 4 + Math.floor((waveNumber - 1) / 3);
      const count = 2 + Math.floor((waveNumber - 1) / 4);
      const cadenceBase = 5 - waveNumber * 0.09;
      const cadence = clamp(cadenceBase + randomRange(-0.3, 0.3), 2.5, 6.2);
      return [
        {
          type: 'SplitterGloob',
          lane,
          hp,
          count,
          cadence,
        },
      ];
    },
  },
  {
    id: 'splitter-parade',
    minWave: 4,
    laneCount: 2,
    laneStrategy: 'contiguous',
    weight: (waveNumber) => Math.max(0.5, 3.8 - waveNumber * 0.08),
    generate(waveNumber, lanes) {
      const hp = 4 + Math.floor((waveNumber - 1) / 3);
      const count = 2 + Math.floor((waveNumber - 1) / 5);
      const cadenceBase = 4.6 - waveNumber * 0.07;
      const cadence = clamp(cadenceBase + randomRange(-0.2, 0.2), 2.4, 5.4);
      return lanes.map((lane) => ({ type: 'SplitterGloob', lane, hp, count, cadence }));
    },
  },
  {
    id: 'shield-wall',
    minWave: 3,
    laneCount: 2,
    laneStrategy: 'mirrored',
    weight: (waveNumber) => 1.8 + waveNumber * 0.05,
    generate(waveNumber, lanes) {
      const hp = 6 + Math.floor((waveNumber - 1) / 4);
      const count = 1 + Math.floor((waveNumber - 1) / 6);
      const cadenceBase = 6.2 - waveNumber * 0.1;
      const cadence = clamp(cadenceBase + randomRange(-0.3, 0.3), 3.6, 7);
      return lanes.map((lane) => ({ type: 'ShieldyGloob', lane, hp, count, cadence }));
    },
  },
  {
    id: 'magnet-harrier',
    minWave: 3,
    laneCount: 1,
    laneStrategy: 'random',
    weight: (waveNumber) => 2 + waveNumber * 0.04,
    generate(waveNumber, lanes) {
      const lane = lanes[0] ?? 3;
      const configs: WaveEnemyConfig[] = [];
      const magnetHp = 6 + Math.floor((waveNumber - 1) / 3);
      const magnetCount = 1 + Math.floor((waveNumber - 1) / 7);
      const magnetCadenceBase = 6.4 - waveNumber * 0.1;
      const magnetCadence = clamp(magnetCadenceBase + randomRange(-0.2, 0.2), 3.6, 7.2);
      configs.push({
        type: 'Magnetron',
        lane,
        hp: magnetHp,
        count: Math.max(1, magnetCount),
        cadence: magnetCadence,
      });
      const escortCount = 3 + Math.floor((waveNumber - 1) / 4);
      const escortCadenceBase = 2.5 - waveNumber * 0.04;
      const escortCadence = clamp(escortCadenceBase + randomRange(-0.15, 0.15), 1.2, 2.8);
      const neighborLanes = [lane - 1, lane + 1].filter((value) => value >= 1 && value <= 6);
      for (const neighbor of neighborLanes) {
        configs.push({
          type: 'GloobZigzag',
          lane: neighbor,
          hp: 3 + Math.floor((waveNumber - 1) / 3),
          count: escortCount,
          cadence: escortCadence,
        });
      }
      return configs;
    },
  },
  {
    id: 'spore-cluster',
    minWave: 4,
    laneCount: 2,
    laneStrategy: 'contiguous',
    weight: (waveNumber) => 1.6 + waveNumber * 0.03,
    generate(waveNumber, lanes) {
      const hp = 5 + Math.floor((waveNumber - 1) / 4);
      const count = 2 + Math.floor((waveNumber - 1) / 6);
      const cadenceBase = 5.4 - waveNumber * 0.07;
      const cadence = clamp(cadenceBase + randomRange(-0.2, 0.2), 2.7, 6.2);
      return lanes.map((lane) => ({ type: 'SporePuff', lane, hp, count, cadence }));
    },
  },
  {
    id: 'mixed-skirmish',
    minWave: 5,
    laneCount: 3,
    laneStrategy: 'contiguous',
    weight: (waveNumber) => 2.4 + waveNumber * 0.04,
    generate(waveNumber, lanes) {
      const configs: WaveEnemyConfig[] = [];
      const [laneA, laneB, laneC] = lanes;
      const zigzagHp = 3 + Math.floor((waveNumber - 1) / 3);
      const zigzagCount = 3 + Math.floor((waveNumber - 1) / 4);
      const zigzagCadence = clamp(2.3 - waveNumber * 0.04 + randomRange(-0.15, 0.15), 1.1, 2.6);
      configs.push({
        type: 'GloobZigzag',
        lane: laneA ?? 2,
        hp: zigzagHp,
        count: zigzagCount,
        cadence: zigzagCadence,
      });
      const splitterHp = 5 + Math.floor((waveNumber - 1) / 3);
      const splitterCount = 2 + Math.floor((waveNumber - 1) / 5);
      const splitterCadence = clamp(4.6 - waveNumber * 0.07 + randomRange(-0.25, 0.25), 2.4, 5.2);
      configs.push({
        type: 'SplitterGloob',
        lane: laneB ?? 3,
        hp: splitterHp,
        count: splitterCount,
        cadence: splitterCadence,
      });
      if (laneC !== undefined) {
        const supportHp = 5 + Math.floor((waveNumber - 1) / 5);
        const supportCount = 1 + Math.floor((waveNumber - 1) / 6);
        const supportCadence = clamp(5.8 - waveNumber * 0.08 + randomRange(-0.25, 0.25), 3, 6.5);
        configs.push({
          type: 'ShieldyGloob',
          lane: laneC,
          hp: supportHp,
          count: supportCount,
          cadence: supportCadence,
        });
      }
      return configs;
    },
  },
  {
    id: 'bulwark-advance',
    minWave: 10,
    laneCount: 2,
    laneStrategy: 'contiguous',
    weight: (waveNumber) => 1 + (waveNumber - 9) * 0.08,
    generate(waveNumber, lanes) {
      const hp = 9 + Math.floor((waveNumber - 10) / 2);
      const count = Math.max(1, 1 + Math.floor((waveNumber - 10) / 6));
      const cadenceBase = 6.8 - (waveNumber - 10) * 0.12;
      const cadence = clamp(cadenceBase + randomRange(-0.25, 0.25), 3.4, 7.2);
      return lanes.map((lane) => ({ type: 'BulwarkGloob', lane, hp, count, cadence }));
    },
  },
  {
    id: 'bulwark-escort',
    minWave: 12,
    laneCount: 1,
    laneStrategy: 'random',
    weight: (waveNumber) => 0.9 + (waveNumber - 11) * 0.08,
    generate(waveNumber, lanes) {
      const lane = lanes[0] ?? 3;
      const configs: WaveEnemyConfig[] = [];
      const bulwarkHp = 10 + Math.floor((waveNumber - 12) / 2);
      const bulwarkCount = Math.max(1, 1 + Math.floor((waveNumber - 12) / 7));
      const bulwarkCadence = clamp(6.2 - (waveNumber - 12) * 0.1 + randomRange(-0.2, 0.2), 3.3, 6.8);
      configs.push({
        type: 'BulwarkGloob',
        lane,
        hp: bulwarkHp,
        count: bulwarkCount,
        cadence: bulwarkCadence,
      });
      const flankLanes = shuffle(
        [lane - 1, lane + 1].filter((value) => value >= 1 && value <= 6),
      ).slice(0, 2);
      const stalkerHp = 7 + Math.floor((waveNumber - 12) / 3);
      const stalkerCount = 2 + Math.floor((waveNumber - 12) / 4);
      const stalkerCadence = clamp(3.4 - (waveNumber - 12) * 0.06 + randomRange(-0.15, 0.15), 1.4, 3.6);
      for (const flank of flankLanes) {
        configs.push({
          type: 'WarpStalker',
          lane: flank,
          hp: stalkerHp,
          count: stalkerCount,
          cadence: stalkerCadence,
        });
      }
      return configs;
    },
  },
  {
    id: 'warp-ambush',
    minWave: 13,
    laneCount: 2,
    laneStrategy: 'contiguous',
    weight: (waveNumber) => 1.1 + (waveNumber - 12) * 0.07,
    generate(waveNumber, lanes) {
      const hp = 7 + Math.floor((waveNumber - 12) / 3);
      const count = 2 + Math.floor((waveNumber - 12) / 4);
      const cadenceBase = 3.2 - (waveNumber - 12) * 0.06;
      const cadence = clamp(cadenceBase + randomRange(-0.1, 0.1), 1.3, 3.4);
      return lanes.map((lane) => ({ type: 'WarpStalker', lane, hp, count, cadence }));
    },
  },
  {
    id: 'maelstrom-lattice',
    minWave: 16,
    laneCount: 3,
    laneStrategy: 'center',
    weight: (waveNumber) => 1 + (waveNumber - 15) * 0.06,
    generate(waveNumber, lanes) {
      const ordered = lanes.length === 3 ? lanes : [2, 3, 4];
      const [left, mid, right] = ordered;
      const configs: WaveEnemyConfig[] = [];
      const sporeHp = 6 + Math.floor((waveNumber - 16) / 3);
      const sporeCount = 2 + Math.floor((waveNumber - 16) / 5);
      const sporeCadence = clamp(5.2 - (waveNumber - 16) * 0.06 + randomRange(-0.2, 0.2), 2.6, 5.6);
      configs.push({
        type: 'SporePuff',
        lane: left ?? 2,
        hp: sporeHp,
        count: sporeCount,
        cadence: sporeCadence,
      });
      const magnetHp = 7 + Math.floor((waveNumber - 16) / 2);
      const magnetCount = 1 + Math.floor((waveNumber - 16) / 6);
      const magnetCadence = clamp(5.6 - (waveNumber - 16) * 0.08 + randomRange(-0.2, 0.2), 3.2, 6.2);
      configs.push({
        type: 'Magnetron',
        lane: mid ?? 3,
        hp: magnetHp,
        count: Math.max(1, magnetCount),
        cadence: magnetCadence,
      });
      const stalkerHp = 7 + Math.floor((waveNumber - 16) / 3);
      const stalkerCount = 2 + Math.floor((waveNumber - 16) / 4);
      const stalkerCadence = clamp(3.1 - (waveNumber - 16) * 0.05 + randomRange(-0.15, 0.15), 1.4, 3.2);
      configs.push({
        type: 'WarpStalker',
        lane: right ?? 4,
        hp: stalkerHp,
        count: stalkerCount,
        cadence: stalkerCadence,
      });
      return configs;
    },
  },
  {
    id: 'aegis-phalanx',
    minWave: 20,
    laneCount: 1,
    laneStrategy: 'center',
    weight: (waveNumber) => 1 + (waveNumber - 19) * 0.12,
    generate(waveNumber, lanes) {
      const lane = lanes[0] ?? 3;
      const configs: WaveEnemyConfig[] = [];
      const aegisHp = 18 + Math.floor((waveNumber - 20) / 2);
      const aegisCount = Math.max(1, 1 + Math.floor((waveNumber - 20) / 12));
      const aegisCadence = clamp(7.8 - (waveNumber - 20) * 0.12 + randomRange(-0.25, 0.25), 4.6, 8.4);
      configs.push({
        type: 'AegisSentinel',
        lane,
        hp: aegisHp,
        count: aegisCount,
        cadence: aegisCadence,
      });
      const neighbors = [lane - 1, lane + 1].filter((value) => value >= 1 && value <= 6);
      const bulwarkHp = 11 + Math.floor((waveNumber - 20) / 2);
      const bulwarkCount = Math.max(1, 1 + Math.floor((waveNumber - 20) / 8));
      const bulwarkCadence = clamp(6.4 - (waveNumber - 20) * 0.1 + randomRange(-0.2, 0.2), 3.4, 6.8);
      for (const neighbor of neighbors) {
        configs.push({
          type: 'BulwarkGloob',
          lane: neighbor,
          hp: bulwarkHp,
          count: bulwarkCount,
          cadence: bulwarkCadence,
        });
      }
      return configs;
    },
  },
];

function shuffle<T>(values: T[]): T[] {
  const array = [...values];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function pickLaneSet(count: number, strategy: LaneStrategy = 'random'): number[] {
  switch (strategy) {
    case 'contiguous': {
      const maxStart = Math.max(1, 7 - count);
      const start = Math.floor(Math.random() * maxStart) + 1;
      const lanes = Array.from({ length: count }, (_, index) => start + index);
      return shuffle(lanes);
    }
    case 'mirrored': {
      if (count === 2) {
        const pairs = [
          [1, 6],
          [2, 5],
          [3, 4],
        ];
        return shuffle(pairs[Math.floor(Math.random() * pairs.length)]);
      }
      return pickLaneSet(count, 'random');
    }
    case 'center': {
      if (count === 1) {
        return [Math.random() < 0.5 ? 3 : 4];
      }
      if (count === 3) {
        const center = Math.random() < 0.5 ? 3 : 4;
        const lanes = [center - 1, center, center + 1].filter((lane) => lane >= 1 && lane <= 6);
        if (lanes.length === 3) {
          return shuffle(lanes);
        }
      }
      return pickLaneSet(count, 'contiguous');
    }
    default: {
      const lanes: number[] = [];
      while (lanes.length < count) {
        const lane = Math.floor(Math.random() * 6) + 1;
        if (!lanes.includes(lane)) {
          lanes.push(lane);
        }
      }
      return shuffle(lanes);
    }
  }
}

function selectTemplate(
  waveNumber: number,
  usedCounts: Map<string, number>,
): GroupTemplate | undefined {
  let weighted: Array<{ template: GroupTemplate; weight: number }> = [];

  for (const template of groupTemplates) {
    if (waveNumber < template.minWave) continue;
    const currentCount = usedCounts.get(template.id) ?? 0;
    const maxPerWave = template.maxPerWave ?? 1;
    if (currentCount >= maxPerWave) continue;
    const weight = Math.max(0, template.weight(waveNumber));
    if (weight <= 0) continue;
    weighted.push({ template, weight });
  }

  if (!weighted.length) {
    for (const template of groupTemplates) {
      if (waveNumber < template.minWave) continue;
      const currentCount = usedCounts.get(template.id) ?? 0;
      const maxPerWave = template.maxPerWave ?? 1;
      if (currentCount >= maxPerWave) continue;
      const fallbackWeight = Math.max(0.2, template.weight(waveNumber));
      weighted.push({ template, weight: fallbackWeight });
    }
  }

  if (!weighted.length) {
    weighted = groupTemplates
      .map((template) => ({ template, weight: 1 }))
      .filter((entry) => {
        const currentCount = usedCounts.get(entry.template.id) ?? 0;
        const maxPerWave = entry.template.maxPerWave ?? 1;
        return currentCount < maxPerWave;
      });
  }

  if (!weighted.length) {
    return undefined;
  }

  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.template;
    }
  }
  return weighted[weighted.length - 1]?.template;
}

function shortId(id: string) {
  return id
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('');
}

export function pickWave(index: number): WaveBlueprint {
  const waveNumber = index + 1;
  const stage = Math.floor((waveNumber - 1) / 5) + 1;
  const baseGroupTarget = 2 + Math.floor(waveNumber / 3);
  const bonusGroup = Math.random() < 0.35 ? 1 : 0;
  const targetGroups = clamp(baseGroupTarget + bonusGroup, 2, 6);

  const usedCounts = new Map<string, number>();
  const chosenIds: string[] = [];
  const enemies: WaveEnemyConfig[] = [];

  for (let i = 0; i < targetGroups; i++) {
    const template = selectTemplate(waveNumber, usedCounts);
    if (!template) break;
    const lanes = pickLaneSet(template.laneCount, template.laneStrategy);
    const configs = template.generate(waveNumber, lanes);
    if (!configs.length) continue;
    enemies.push(...configs);
    chosenIds.push(template.id);
    const currentCount = usedCounts.get(template.id) ?? 0;
    usedCounts.set(template.id, currentCount + 1);
  }

  if (!enemies.length) {
    enemies.push({ type: 'GloobZigzag', lane: 3, hp: 3, count: 4, cadence: 2.5 });
  }

  const signature = chosenIds.map(shortId).filter(Boolean).join('') || 'BASE';
  const spawnSeconds = clamp(
    18 + targetGroups * 2.4 + stage * 1.4 + randomRange(-1, 1),
    18,
    42,
  );

  return {
    waveId: `ALG-S${stage}-W${waveNumber}-${signature}`,
    spawnSeconds,
    enemies,
  };
}

