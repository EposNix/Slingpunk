import type { Game } from '../Game';
import type { WaveEnemyConfig } from '../types';
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
  }

  private loadWave(index: number) {
    const blueprint = pickWave(index);
    this.spawns = blueprint.enemies.map((config) => ({
      config,
      spawned: 0,
      nextTime: this.elapsed + Math.random() * 2,
    }));
    this.game.onWaveStart(blueprint.waveId);
  }

  private spawnEnemy(config: WaveEnemyConfig) {
    this.game.spawnEnemy(config.type, {
      position: this.game.laneToWorld(config.lane),
      hp: config.hp,
      speed: this.game.baseEnemySpeed,
    });
  }

}
