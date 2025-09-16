import type { Game } from '../Game';
import { clamp } from '../utils';
import type { PowerUpType, Vector2 } from '../types';

let ORB_ID = 0;

export interface OrbOptions {
  color?: string;
  radius?: number;
  damage?: number;
  inheritedPowerUps?: Partial<Record<PowerUpType, unknown>>;
}

export class Orb {
  public readonly id: number;
  public position: Vector2;
  public velocity: Vector2;
  public radius: number;
  public color: string;
  public damage: number;
  public shieldHits = 0;
  public pierceLeft = 0;
  public pendingSplit = false;
  public lightningChains = 0;
  public ricochetBuff = 0;
  public alive = true;

  constructor(position: Vector2, velocity: Vector2, options: OrbOptions = {}) {
    this.id = ORB_ID++;
    this.position = { ...position };
    this.velocity = { ...velocity };
    this.radius = options.radius ?? 16;
    this.color = options.color ?? '#38f3ff';
    this.damage = options.damage ?? 1;
  }

  cloneWithVelocity(velocity: Vector2) {
    const copy = new Orb(this.position, velocity, {
      color: this.color,
      radius: this.radius,
      damage: this.damage,
    });
    copy.shieldHits = this.shieldHits;
    copy.pierceLeft = this.pierceLeft;
    copy.pendingSplit = this.pendingSplit;
    copy.lightningChains = this.lightningChains;
    copy.ricochetBuff = this.ricochetBuff;
    return copy;
  }

  applyPowerUp(type: PowerUpType) {
    switch (type) {
      case 'shield':
        this.shieldHits = Math.max(this.shieldHits, 1);
        this.color = '#8fffd1';
        break;
      case 'pierce':
        this.pierceLeft = Math.max(this.pierceLeft, 2);
        this.color = '#f1ff7a';
        break;
      case 'multiball':
        this.pendingSplit = true;
        this.color = '#ffc43c';
        break;
      case 'lightning':
        this.lightningChains = Math.max(this.lightningChains, 6);
        this.color = '#80b2ff';
        break;
      case 'ricochet':
        this.ricochetBuff = Math.max(this.ricochetBuff, 4);
        this.color = '#ff6ef2';
        break;
      case 'timewarp':
        // handled at game level - mark with subtle glow
        this.color = '#a2a5ff';
        break;
    }
  }

  update(dt: number, game: Game) {
    if (!this.alive) return;

    // Gravity & slight drag
    this.velocity.y += 1400 * dt;
    this.velocity.x *= 1 - 0.02 * dt;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    const radius = this.radius;
    const { width, height } = game;

    if (this.position.x < radius) {
      this.position.x = radius;
      this.velocity.x = Math.abs(this.velocity.x) * (this.ricochetBuff > 0 ? 1.05 : 0.9);
      this.onWallBounce(game);
    } else if (this.position.x > width - radius) {
      this.position.x = width - radius;
      this.velocity.x = -Math.abs(this.velocity.x) * (this.ricochetBuff > 0 ? 1.05 : 0.9);
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

    if (this.ricochetBuff > 0) {
      this.ricochetBuff = clamp(this.ricochetBuff - dt * 1.2, 0, 4);
    }
  }

  private onWallBounce(game: Game) {
    if (this.ricochetBuff > 0) {
      this.velocity.x *= 1.05;
      this.velocity.y *= 1.05;
    }
    game.emitWallHit(this.position);
  }
}
