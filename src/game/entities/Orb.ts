import type { Game } from '../Game';
import { normalize } from '../utils';
import type { Vector2 } from '../types';

let ORB_ID = 0;

export interface OrbOptions {
  color?: string;
  radius?: number;
  damage?: number;
  splitOnImpact?: boolean;
}

export class Orb {
  public readonly id: number;
  public position: Vector2;
  public velocity: Vector2;
  public radius: number;
  public color: string;
  public damage: number;
  public splitOnImpact: boolean;
  public alive = true;

  constructor(position: Vector2, velocity: Vector2, options: OrbOptions = {}) {
    this.id = ORB_ID++;
    this.position = { ...position };
    this.velocity = { ...velocity };
    this.radius = options.radius ?? 16;
    this.color = options.color ?? '#38f3ff';
    this.damage = options.damage ?? 1;
    this.splitOnImpact = options.splitOnImpact ?? false;
  }

  cloneWithVelocity(velocity: Vector2) {
    const copy = new Orb(this.position, velocity, {
      color: this.color,
      radius: this.radius,
      damage: this.damage,
      splitOnImpact: this.splitOnImpact,
    });
    return copy;
  }

  update(dt: number, game: Game) {
    if (!this.alive) return;

    const homing = game.modifiers.homingStrength;
    if (homing > 0) {
      let nearest: Vector2 | undefined;
      let closest = Infinity;
      for (const enemy of game.enemies) {
        if (!enemy.alive) continue;
        const dx = enemy.position.x - this.position.x;
        const dy = enemy.position.y - this.position.y;
        const dist = dx * dx + dy * dy;
        if (dist < closest) {
          closest = dist;
          nearest = { x: dx, y: dy };
        }
      }
      if (nearest) {
        const dir = normalize(nearest);
        this.velocity.x += dir.x * homing * dt;
        this.velocity.y += dir.y * homing * dt;
      }
    }

    // Gravity & slight drag
    this.velocity.y += 1400 * dt;
    this.velocity.x *= 1 - 0.02 * dt;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    const radius = this.radius;
    const { width, height } = game;

    if (this.position.x < radius) {
      this.position.x = radius;
      this.velocity.x = Math.abs(this.velocity.x) * 0.9;
      this.onWallBounce(game);
    } else if (this.position.x > width - radius) {
      this.position.x = width - radius;
      this.velocity.x = -Math.abs(this.velocity.x) * 0.9;
      this.onWallBounce(game);
    }

    if (this.position.y < radius + 40) {
      this.position.y = radius + 40;
      this.velocity.y = Math.abs(this.velocity.y) * 0.85;
      this.onWallBounce(game);
    }

    if (this.position.y - radius > height + 120) {
      this.alive = false;
      game.onOrbOutOfBounds(this);
    }
  }

  private onWallBounce(game: Game) {
    game.emitWallHit(this.position);
  }
}
