import type { Game } from '../Game';
import type { EnemyKind, Vector2 } from '../types';
import type { Orb } from './Orb';

type EnemyVisualKind = 'organic' | 'mechanical' | 'crystal';

interface EnemyVisualProfile {
  kind: EnemyVisualKind;
  accent: string;
  secondary: string;
  core: string;
  spikes?: number;
  sides?: number;
}

const ENEMY_VISUALS: Record<EnemyKind, EnemyVisualProfile> = {
  GloobZigzag: {
    kind: 'organic',
    accent: '#58f7ff',
    secondary: 'rgba(10, 22, 44, 0.95)',
    core: '#d7fbff',
    spikes: 6,
  },
  SplitterGloob: {
    kind: 'organic',
    accent: '#ff8fe9',
    secondary: 'rgba(38, 6, 41, 0.92)',
    core: '#ffe0f9',
    spikes: 6,
  },
  ShieldyGloob: {
    kind: 'organic',
    accent: '#c2ffd6',
    secondary: 'rgba(8, 46, 34, 0.92)',
    core: '#f6fff9',
    spikes: 5,
  },
  Splitterling: {
    kind: 'crystal',
    accent: '#ffc86f',
    secondary: 'rgba(50, 18, 0, 0.92)',
    core: '#fff2c1',
    spikes: 4,
  },
  Magnetron: {
    kind: 'mechanical',
    accent: '#9ed1ff',
    secondary: 'rgba(8, 20, 48, 0.92)',
    core: '#d4efff',
    sides: 6,
  },
  SporePuff: {
    kind: 'organic',
    accent: '#d5a8ff',
    secondary: 'rgba(22, 4, 38, 0.92)',
    core: '#f5e6ff',
    spikes: 8,
  },
  BulwarkGloob: {
    kind: 'mechanical',
    accent: '#84d7ff',
    secondary: 'rgba(12, 34, 52, 0.92)',
    core: '#d9f5ff',
    sides: 8,
  },
  WarpStalker: {
    kind: 'crystal',
    accent: '#ff84d7',
    secondary: 'rgba(30, 0, 44, 0.92)',
    core: '#ffe4fb',
    spikes: 5,
  },
  AegisSentinel: {
    kind: 'mechanical',
    accent: '#ffe57d',
    secondary: 'rgba(44, 28, 0, 0.92)',
    core: '#fff5cb',
    sides: 5,
  },
};

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
  public isElite = false;
  public isBoss = false;
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
    const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    const mainColor = this.getColor();
    const visual = ENEMY_VISUALS[this.type];
    const accent = visual?.accent ?? mainColor;
    const secondary = visual?.secondary ?? 'rgba(10, 5, 35, 0.9)';
    const core = visual?.core ?? 'rgba(255, 255, 255, 0.85)';
    const radius = this.radius;

    if (this.isElite || this.isBoss) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.isBoss ? 0.4 : 0.28;
      ctx.fillStyle = this.isBoss
        ? 'rgba(255, 153, 94, 0.45)'
        : 'rgba(255, 214, 132, 0.32)';
      ctx.beginPath();
      ctx.arc(0, 0, radius * (this.isBoss ? 1.8 : 1.55), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (visual?.kind === 'organic') {
      const spikes = (visual.spikes ?? 6) * 2;
      const wobble = 0.16 + (1 - hpRatio) * 0.08;
      const gradient = ctx.createRadialGradient(0, 0, radius * 0.25, 0, 0, radius * 1.05);
      gradient.addColorStop(0, core);
      gradient.addColorStop(0.45, mainColor);
      gradient.addColorStop(1, secondary);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      for (let i = 0; i <= spikes; i++) {
        const angle = (i / spikes) * Math.PI * 2;
        const sway = Math.sin(angle * (spikes * 0.4) + this.elapsed * 2.2);
        const r = radius * (0.75 + wobble + sway * 0.12);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = accent;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = accent;
      const pulse = radius * (0.32 + Math.sin(this.elapsed * 3.4) * 0.08);
      ctx.beginPath();
      ctx.arc(0, 0, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (visual?.kind === 'mechanical') {
      const sides = visual.sides ?? 6;
      const rotation = this.elapsed * 0.8;
      ctx.save();
      ctx.rotate(rotation * 0.5);
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      const shell = ctx.createLinearGradient(-radius, -radius, radius, radius);
      shell.addColorStop(0, secondary);
      shell.addColorStop(0.45, mainColor);
      shell.addColorStop(1, accent);
      ctx.fillStyle = shell;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.stroke();

      const innerRadius = radius * 0.55;
      ctx.beginPath();
      ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
      const coreGradient = ctx.createRadialGradient(0, 0, innerRadius * 0.2, 0, 0, innerRadius);
      coreGradient.addColorStop(0, core);
      coreGradient.addColorStop(0.65, mainColor);
      coreGradient.addColorStop(1, secondary);
      ctx.fillStyle = coreGradient;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      const arm = radius * 0.78;
      ctx.beginPath();
      ctx.moveTo(-arm, 0);
      ctx.lineTo(arm, 0);
      ctx.moveTo(0, -arm);
      ctx.lineTo(0, arm);
      ctx.stroke();
      ctx.restore();
    } else {
      const spikes = (visual?.spikes ?? 5) * 2;
      const rotation = this.elapsed * 0.7;
      ctx.save();
      ctx.rotate(rotation);
      ctx.beginPath();
      for (let i = 0; i < spikes; i++) {
        const angle = (i / spikes) * Math.PI * 2;
        const outer = i % 2 === 0;
        const pulse = Math.sin(this.elapsed * 3.1 + i) * 0.06;
        const r = radius * (outer ? 1.05 + pulse : 0.45 + pulse * 0.5);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      const crystal = ctx.createLinearGradient(-radius, -radius, radius, radius);
      crystal.addColorStop(0, secondary);
      crystal.addColorStop(0.6, mainColor);
      crystal.addColorStop(1, accent);
      ctx.fillStyle = crystal;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
      ctx.stroke();

      const innerRadius = radius * 0.46;
      const inner = ctx.createRadialGradient(0, 0, innerRadius * 0.1, 0, 0, innerRadius);
      inner.addColorStop(0, core);
      inner.addColorStop(0.8, mainColor);
      inner.addColorStop(1, 'rgba(10, 8, 26, 0.85)');
      ctx.beginPath();
      ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
      ctx.fillStyle = inner;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.7, this.elapsed * 1.2, this.elapsed * 1.2 + Math.PI * 1.1);
      ctx.stroke();
      ctx.restore();
    }

    const ringRadius = radius + 10;
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = 'rgba(18, 16, 40, 0.6)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio, false);
    ctx.stroke();
    ctx.lineCap = 'butt';

    if (this.shield > 0) {
      ctx.save();
      ctx.lineWidth = 4 + Math.sin(this.elapsed * 6) * 0.6;
      ctx.strokeStyle = `rgba(140, 236, 255, ${0.4 + Math.min(1, this.shield / 6) * 0.5})`;
      ctx.setLineDash([6 + Math.sin(this.elapsed * 3.4) * 1.5, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (this.slowTimer > 0) {
      const slowRatio = Math.min(1, this.slowTimer);
      ctx.save();
      ctx.strokeStyle = `rgba(134, 198, 255, ${0.2 + slowRatio * 0.45})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.restore();
  }

  takeDamage(amount: number, game: Game, orb: Orb) {
    if (!this.alive) return;

    let remaining = amount;
    let shieldAbsorbed = 0;
    if (this.shield > 0) {
      const shieldBefore = this.shield;
      this.shield -= remaining;
      game.emitShieldHit(this.position);
      shieldAbsorbed = Math.min(shieldBefore, remaining);
      if (this.shield <= 0) {
        remaining = -this.shield;
        this.shield = 0;
      } else {
        remaining = 0;
      }
    }

    if (shieldAbsorbed > 0) {
      game.emitDamageNumber(this.position, shieldAbsorbed, { shield: true });
    }

    if (remaining > 0) {
      const before = this.hp;
      this.hp -= remaining;
      const dealt = Math.min(before, remaining);
      this.onDamaged(game, dealt, orb);
      if (this.hp <= 0) {
        this.alive = false;
        this.onDeath(game, orb);
        game.onEnemyKilled(this, orb);
      }
      if (dealt > 0) {
        game.emitDamageNumber(this.position, dealt, { critical: !this.alive });
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
