import type { Game } from '../Game';
import type { EnemyWaveScaling, WaveEnemyConfig } from '../types';
import { buildEnemyTuning } from './enemyModifiers';
import { pickWave } from './blueprints';

interface ActiveSpawn {
  config: WaveEnemyConfig;
  spawned: number;
  nextTime: number;
}

export class WaveManager {
  private readonly game: Game;
  private spawns: ActiveSpawn[] = [];
  private elapsed = 0;
  private waveIndex = 0;
  private scaling: EnemyWaveScaling = {
    level: 0,
    hpMultiplier: 1,
    hpBonus: 0,
    speedMultiplier: 1,
    countMultiplier: 1,
    cadenceMultiplier: 1,
  };

  constructor(game: Game) {
    this.game = game;
  }

  get waveNumber() {
    return this.waveIndex + 1;
  }

  update(dt: number) {
    if (!this.spawns.length) {
      this.loadWave(this.waveIndex);
    }

    this.elapsed += dt;
    for (const spawn of this.spawns) {
      if (spawn.spawned >= spawn.config.count) continue;
      if (this.elapsed >= spawn.nextTime) {
        this.spawnEnemy(spawn.config);
        spawn.spawned += 1;
        spawn.nextTime += spawn.config.cadence;
      }
    }

    const allSpawned = this.spawns.every((s) => s.spawned >= s.config.count);
    if (allSpawned && this.game.enemies.length === 0) {
      this.waveIndex += 1;
      this.elapsed = 0;
      this.spawns = [];
      this.game.onWaveComplete();
    }
  }

  reset() {
    this.waveIndex = 0;
    this.elapsed = 0;
    this.spawns = [];
    this.scaling = {
      level: 0,
      hpMultiplier: 1,
      hpBonus: 0,
      speedMultiplier: 1,
      countMultiplier: 1,
      cadenceMultiplier: 1,
    };
  }

  private loadWave(index: number) {
    const waveNumber = this.waveNumber;
    const blueprint = pickWave(index);
    const tuning = buildEnemyTuning(waveNumber);
    this.scaling = tuning.scaling;

    this.spawns = blueprint.enemies.map((config) => {
      const scaledConfig: WaveEnemyConfig = {
        type: config.type,
        hp: config.hp,
        lane: config.lane,
        count: this.scaleCount(config.count),
        cadence: this.scaleCadence(config.cadence),
      };
      return {
        config: scaledConfig,
        spawned: 0,
        nextTime: this.elapsed + Math.random() * Math.min(2, scaledConfig.cadence),
      };
    });

    this.game.onWaveStart({
      blueprintId: blueprint.waveId,
      waveNumber,
      modifiers: tuning.modifiers,
      scaling: tuning.scaling,
    });
  }

  private spawnEnemy(config: WaveEnemyConfig) {
    this.game.spawnEnemy(config.type, {
      position: this.game.laneToWorld(config.lane),
      hp: config.hp,
      speed: this.game.baseEnemySpeed,
    });
  }

  private scaleCount(baseCount: number): number {
    const { countMultiplier, level } = this.scaling;
    const scaled = Math.round(baseCount * countMultiplier);
    const guaranteed = baseCount + Math.floor(level / 4);
    const cap = Math.max(baseCount, Math.round(baseCount * 4));
    return Math.max(1, Math.min(Math.max(baseCount, scaled, guaranteed), cap));
  }

  private scaleCadence(baseCadence: number): number {
    const scaled = baseCadence * this.scaling.cadenceMultiplier;
    return Math.max(0.45, scaled);
  }

}
