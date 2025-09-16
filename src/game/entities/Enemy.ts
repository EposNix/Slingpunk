import type { Game } from '../Game';
import type { EnemyKind, Vector2 } from '../types';
import type { Orb } from './Orb';

export interface EnemyParams {
  position: Vector2;
  hp: number;
  radius: number;
  speed: number;
}

export abstract class Enemy {
  public readonly type: EnemyKind;
  public position: Vector2;
  public velocity: Vector2 = { x: 0, y: 0 };
  public radius: number;
  public hp: number;
  public maxHp: number;
  public shield = 0;
  public alive = true;
  protected elapsed = 0;
  protected baseSpeed: number;
  private slowTimer = 0;
  private slowFactor = 1;
  private knockback = 0;

  constructor(type: EnemyKind, params: EnemyParams) {
    this.type = type;
    this.position = { ...params.position };
    this.radius = params.radius;
    this.hp = params.hp;
    this.maxHp = params.hp;
    this.baseSpeed = params.speed;
  }

  update(dt: number, game: Game) {
    this.elapsed += dt;
    this.behavior(dt, game);

    if (this.knockback > 0) {
      this.velocity.y -= this.knockback;
      this.knockback = Math.max(0, this.knockback - dt * 240);
    }

    if (this.slowTimer > 0) {
      this.velocity.x *= this.slowFactor;
      this.velocity.y *= this.slowFactor;
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      if (this.slowTimer === 0) {
        this.slowFactor = 1;
      }
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Damp horizontal velocity slightly
    this.velocity.x *= 1 - Math.min(0.12, dt * 2);

    if (this.position.y - this.radius > game.height - game.bottomSafeZone) {
      this.alive = false;
      game.onEnemyBreach(this);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    const ratio = this.hp / this.maxHp;
    const mainColor = this.getColor();
    const gradient = ctx.createRadialGradient(0, 0, this.radius * 0.2, 0, 0, this.radius);
    gradient.addColorStop(0, `rgba(255,255,255,0.8)`);
    gradient.addColorStop(0.4, mainColor);
    gradient.addColorStop(1, `rgba(10,5,35,0.85)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    if (this.shield > 0) {
      ctx.strokeStyle = 'rgba(120, 228, 255, 0.9)';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.slowTimer > 0) {
      const slowRatio = Math.min(1, this.slowTimer);
      ctx.strokeStyle = `rgba(134, 198, 255, ${0.2 + slowRatio * 0.5})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = 'rgba(10, 0, 30, 0.6)';
    ctx.fillRect(-this.radius, this.radius + 6, this.radius * 2, 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(-this.radius, this.radius + 6, this.radius * 2 * ratio, 6);

    ctx.restore();
  }

  takeDamage(amount: number, game: Game, orb: Orb) {
    if (!this.alive) return;

    let remaining = amount;
    if (this.shield > 0) {
      this.shield -= remaining;
      game.emitShieldHit(this.position);
      if (this.shield <= 0) {
        remaining = -this.shield;
        this.shield = 0;
      } else {
        remaining = 0;
      }
    }

    if (remaining > 0) {
      this.hp -= remaining;
      this.onDamaged(game, remaining, orb);
      if (this.hp <= 0) {
        this.alive = false;
        this.onDeath(game, orb);
        game.onEnemyKilled(this, orb);
      }
    }
  }

  protected onDamaged(_game: Game, _amount: number, _orb: Orb) {}

  protected onDeath(_game: Game, _orb: Orb) {}

  public applySlow(duration: number, factor: number) {
    this.slowTimer = Math.max(this.slowTimer, duration);
    this.slowFactor = Math.min(this.slowFactor, Math.max(0.1, factor));
  }

  public applyKnockback(force: number) {
    this.knockback = Math.max(this.knockback, force);
  }

  protected abstract behavior(dt: number, game: Game): void;

  protected abstract getColor(): string;
}
