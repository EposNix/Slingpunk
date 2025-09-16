import type { Game } from '../Game';
import { add, clamp, randomRange } from '../utils';
import type { Vector2 } from '../types';
import type { Orb } from './Orb';
import { Enemy } from './Enemy';

export class GloobZigzag extends Enemy {
  private readonly anchorX: number;
  private readonly amplitude: number;
  private readonly frequency: number;

  constructor(params: { position: Vector2; hp: number; speed: number }) {
    super('GloobZigzag', {
      position: params.position,
      hp: params.hp,
      radius: 30,
      speed: params.speed,
    });
    this.anchorX = params.position.x;
    this.amplitude = randomRange(40, 70);
    this.frequency = randomRange(1.4, 2.2);
  }

  protected behavior(dt: number) {
    this.velocity.y = this.baseSpeed;
    const targetX = this.anchorX + Math.sin(this.elapsed * this.frequency) * this.amplitude;
    const delta = targetX - this.position.x;
    this.velocity.x += clamp(delta * 6 * dt, -180, 180);
  }

  protected getColor(): string {
    return 'rgba(83, 232, 255, 0.85)';
  }
}

export class SplitterGloob extends Enemy {
  private readonly anchorX: number;

  constructor(params: { position: Vector2; hp: number; speed: number }) {
    super('SplitterGloob', {
      position: params.position,
      hp: params.hp,
      radius: 28,
      speed: params.speed,
    });
    this.anchorX = params.position.x;
  }

  protected behavior() {
    this.velocity.y = this.baseSpeed * 0.9;
    const sway = Math.sin(this.elapsed * 1.5) * 30;
    const delta = this.anchorX + sway - this.position.x;
    this.velocity.x += clamp(delta * 5 * 0.016, -120, 120);
  }

  protected getColor(): string {
    return 'rgba(255, 139, 214, 0.9)';
  }

  protected override onDeath(game: Game) {
    const offset = 26;
    for (let i = -1; i <= 1; i += 2) {
      const spawnPos = add(this.position, { x: i * offset, y: 0 });
      game.spawnEnemy('Splitterling', {
        position: spawnPos,
        hp: 1,
        speed: this.baseSpeed * 1.2,
      });
    }
  }
}

export class Splitterling extends Enemy {
  constructor(params: { position: Vector2; hp: number; speed: number }) {
    super('Splitterling', {
      position: params.position,
      hp: params.hp,
      radius: 16,
      speed: params.speed,
    });
  }

  protected behavior() {
    this.velocity.y = this.baseSpeed * 1.3;
    this.velocity.x += Math.sin(this.elapsed * 6) * 10;
  }

  protected getColor(): string {
    return 'rgba(255, 198, 92, 0.9)';
  }
}

export class ShieldyGloob extends Enemy {
  constructor(params: { position: Vector2; hp: number; speed: number }) {
    super('ShieldyGloob', {
      position: params.position,
      hp: params.hp,
      radius: 32,
      speed: params.speed,
    });
    this.shield = 2;
  }

  protected behavior(dt: number) {
    this.velocity.y = this.baseSpeed * 0.8;
    this.velocity.x += Math.sin(this.elapsed * 2.4) * 20 * dt;
  }

  protected getColor(): string {
    return 'rgba(173, 255, 172, 0.9)';
  }

  protected override onDamaged(game: Game, amount: number, orb: Orb) {
    if (this.shield <= 0 && amount > 0) {
      game.emitShieldBreak(this.position, orb);
    }
  }
}

export class Magnetron extends Enemy {
  private readonly pullStrength: number;

  constructor(params: { position: Vector2; hp: number; speed: number }) {
    super('Magnetron', {
      position: params.position,
      hp: params.hp,
      radius: 30,
      speed: params.speed,
    });
    this.pullStrength = randomRange(90, 140);
  }

  protected behavior(dt: number, game: Game) {
    this.velocity.y = this.baseSpeed;
    const orbs = game.orbs;
    for (const orb of orbs) {
      const dx = this.position.x - orb.position.x;
      const dy = this.position.y - orb.position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 200 * 200) {
        const dist = Math.max(Math.sqrt(distSq), 40);
        const force = (this.pullStrength / distSq) * dt * 4000;
        orb.velocity.x += (dx / dist) * force;
        orb.velocity.y += (dy / dist) * force;
      }
    }
  }

  protected getColor(): string {
    return 'rgba(147, 202, 255, 0.9)';
  }
}

export class SporePuff extends Enemy {
  constructor(params: { position: Vector2; hp: number; speed: number }) {
    super('SporePuff', {
      position: params.position,
      hp: params.hp,
      radius: 26,
      speed: params.speed,
    });
  }

  protected behavior(dt: number, game: Game) {
    this.velocity.y = this.baseSpeed * 0.7;
    this.velocity.x += Math.sin(this.elapsed * 1.8) * 14 * dt;

    // Slow nearby enemies slightly to create clusters
    for (const enemy of game.enemies) {
      if (enemy === this || !enemy.alive) continue;
      const dx = enemy.position.x - this.position.x;
      const dy = enemy.position.y - this.position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 140 * 140) {
        enemy.velocity.x *= 0.99;
        enemy.velocity.y *= 0.96;
      }
    }
  }

  protected getColor(): string {
    return 'rgba(189, 126, 255, 0.9)';
  }

  protected override onDeath(game: Game) {
    game.emitSporeCloud(this.position);
  }
}
