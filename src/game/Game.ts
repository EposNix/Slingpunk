import { HUD } from '../ui/HUD';
import { PowerDraftOverlay } from '../ui/PowerDraftOverlay';
import type { EnemyKind, HudData, ModifierRarity, ModifierState, Vector2 } from './types';
import { add, clamp, distanceSq, distanceToSegmentSq, length, normalize, scale, subtract } from './utils';
import { Orb } from './entities/Orb';
import type { Enemy } from './entities/Enemy';
import {
  GloobZigzag,
  Magnetron,
  ShieldyGloob,
  SplitterGloob,
  Splitterling,
  SporePuff,
} from './entities/EnemyTypes';
import { WaveManager } from './waves/WaveManager';
import { MAJOR_MODIFIERS, UPGRADE_MODIFIERS, type DraftModifier } from './modifiers';

interface PointerState {
  dragging: boolean;
  pointerId: number | null;
  current: Vector2;
}

interface AftertouchState {
  active: boolean;
  pointerId: number | null;
  direction: number;
}

interface Particle {
  position: Vector2;
  velocity: Vector2;
  life: number;
  size: number;
  color: string;
}

export class Game {
  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hud: HUD;
  private readonly draft: PowerDraftOverlay;

  public width: number;
  public height: number;
  public readonly bottomSafeZone = 180;
  public readonly baseEnemySpeed = 55;

  public orbs: Orb[] = [];
  public enemies: Enemy[] = [];

  private particles: Particle[] = [];
  private pointer: PointerState = {
    dragging: false,
    pointerId: null,
    current: { x: 0, y: 0 },
  };
  private aftertouch: AftertouchState = {
    active: false,
    pointerId: null,
    direction: 0,
  };

  private cannonPosition: Vector2;

  private running = false;
  private paused = false;
  private lastTime = 0;
  private launchCooldown = 0;

  private score = 0;
  private comboHeat = 0;
  private comboTimer = 0;
  private focus = 70;
  private readonly maxLives = 3;
  private lives: number;
  private waveId = 'S1-W1';

  private readonly waveManager: WaveManager;
  private availableMajorModifiers: DraftModifier[];
  public modifiers: ModifierState;
  private drafting = false;
  private pauseLocked = false;
  private completedWaves = 0;

  constructor(canvas: HTMLCanvasElement, hud: HUD, draft: PowerDraftOverlay) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context failed to initialize');
    this.ctx = context;
    this.hud = hud;
    this.draft = draft;

    this.width = canvas.width;
    this.height = canvas.height;
    this.cannonPosition = { x: this.width / 2, y: this.height - this.bottomSafeZone / 2 };

    this.waveManager = new WaveManager(this);
    this.availableMajorModifiers = [...MAJOR_MODIFIERS];
    this.modifiers = this.createInitialModifiers();
    this.lives = this.maxLives;

    this.registerEvents();
    this.onResize();
    this.updateHud();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  togglePause() {
    if (this.pauseLocked) return;
    this.paused = !this.paused;
    this.hud.setPaused(this.paused);
    if (!this.paused) {
      this.lastTime = performance.now();
    }
  }

  get hasActiveOrbs() {
    return this.orbs.some((orb) => orb.alive);
  }

  onWaveStart(id: string) {
    this.waveId = id;
    this.hud.showToast(`Wave ${id}`);
  }

  onWaveComplete() {
    this.hud.showToast('Perfect Wave! +500');
    this.score += 500;
    this.focus = clamp(this.focus + 15, 0, 100);
    this.completedWaves += 1;
    this.updateHud();
    void this.beginModifierDraft();
  }

  private async beginModifierDraft() {
    if (this.drafting || this.lives <= 0) {
      return;
    }
    this.drafting = true;
    this.pauseLocked = true;
    this.paused = true;
    this.hud.setPaused(true);

    const upgradeOptions = this.pickUpgradeOptions();
    if (upgradeOptions.length > 0) {
      const choice = await this.draft.present(upgradeOptions, {
        title: 'Choose your enhancement',
        subtitle: 'Stack tuning upgrades or restore a heart between waves.',
      });
      this.applyModifier(choice);
    }

    const shouldOfferMajor =
      this.availableMajorModifiers.length > 0 && this.completedWaves % 3 === 0;
    if (shouldOfferMajor) {
      const majorOptions = this.pickMajorOptions();
      if (majorOptions.length > 0) {
        const choice = await this.draft.present(majorOptions, {
          title: 'Choose a core modifier',
          subtitle: 'Select one of the experimental puck mods.',
        });
        this.applyModifier(choice);
        this.availableMajorModifiers = this.availableMajorModifiers.filter(
          (mod) => mod.id !== choice.id,
        );
      }
    }

    this.drafting = false;
    this.pauseLocked = false;
    this.paused = false;
    this.hud.setPaused(false);
    this.lastTime = performance.now();
  }

  private pickMajorOptions(): DraftModifier[] {
    if (this.availableMajorModifiers.length === 0) {
      return [];
    }
    if (this.availableMajorModifiers.length <= 3) {
      return [...this.availableMajorModifiers];
    }
    const pool = [...this.availableMajorModifiers];
    const selections: DraftModifier[] = [];
    const fallback: Record<ModifierRarity, ModifierRarity[]> = {
      common: ['common', 'uncommon', 'rare'],
      uncommon: ['uncommon', 'rare', 'common'],
      rare: ['rare', 'uncommon', 'common'],
    };
    for (let i = 0; i < 3; i++) {
      if (!pool.length) break;
      const desired = this.rollRarity();
      let candidates: DraftModifier[] = [];
      for (const bucket of fallback[desired]) {
        candidates = pool.filter((mod) => mod.rarity === bucket);
        if (candidates.length) break;
      }
      if (!candidates.length) {
        candidates = pool;
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      selections.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    return selections;
  }

  private pickUpgradeOptions(): DraftModifier[] {
    const context = { lives: this.lives, maxLives: this.maxLives };
    const available = UPGRADE_MODIFIERS.filter(
      (modifier) => !modifier.available || modifier.available(this.modifiers, context),
    );
    if (available.length <= 3) {
      return [...available];
    }
    const pool = [...available];
    const selections: DraftModifier[] = [];
    for (let i = 0; i < 3; i++) {
      if (!pool.length) break;
      const pickIndex = Math.floor(Math.random() * pool.length);
      selections.push(pool[pickIndex]);
      pool.splice(pickIndex, 1);
    }
    return selections;
  }

  private rollRarity(): ModifierRarity {
    const roll = Math.random();
    if (roll < 0.6) return 'common';
    if (roll < 0.9) return 'uncommon';
    return 'rare';
  }

  private applyModifier(definition: DraftModifier) {
    if (definition.id === 'restoreHeart') {
      if (this.lives < this.maxLives) {
        this.lives = Math.min(this.maxLives, this.lives + 1);
        this.modifiers.lastPicked = definition.id;
        this.updateHud();
        this.hud.showToast('Heart restored!', 1600);
      }
      return;
    }
    const previousSize = this.modifiers.orbSizeMultiplier;
    definition.apply(this.modifiers);
    this.modifiers.lastPicked = definition.id;

    if (this.modifiers.orbSizeMultiplier !== previousSize && previousSize > 0) {
      const ratio = this.modifiers.orbSizeMultiplier / previousSize;
      for (const orb of this.orbs) {
        orb.radius *= ratio;
      }
    }

    if (this.modifiers.splitOnImpact) {
      for (const orb of this.orbs) {
        orb.splitOnImpact = true;
      }
    }

    if (this.modifiers.chainLightning) {
      this.modifiers.chainLightning.cooldown = 0;
    }

    this.updateHud();
    this.hud.showToast(`${definition.name} equipped!`, 1600);
  }

  onEnemyKilled(enemy: Enemy, orb: Orb) {
    const baseScore = 100 + enemy.maxHp * 15;
    const tier = Math.floor(this.comboHeat / 5);
    const multiplier = 1 + tier * 0.1;
    const delta = Math.round(baseScore * multiplier);
    this.score += delta;
    this.emitScorePop(enemy.position, delta);

    this.comboHeat += 1;
    this.comboTimer = 0;
    this.focus = clamp(this.focus + 10, 0, 100);
  }

  onEnemyBreach(_enemy: Enemy) {
    this.lives = Math.max(0, this.lives - 1);
    this.comboHeat = 0;
    this.hud.showToast('Breach! -1 Heart');
    if (this.lives <= 0) {
      this.handleGameOver();
    }
    this.updateHud();
  }

  onOrbOutOfBounds(_orb: Orb) {
    if (!this.hasActiveOrbs && this.lives > 0) {
      this.hud.showToast('Reloaded');
    }
  }

  emitWallHit(position: Vector2, orb?: Orb) {
    if (orb) {
      orb.bounceCount += 1;
      if (this.modifiers.wallHitDamageBonusPercent > 0) {
        orb.pendingWallDamageBonus = this.modifiers.wallHitDamageBonusPercent;
      }
    }
    this.spawnParticles(position, '#39d6ff', 5, 40, 120);
  }

  emitShieldHit(position: Vector2) {
    this.spawnParticles(position, '#92f3ff', 8, 30, 80);
  }

  emitShieldBreak(position: Vector2) {
    this.spawnParticles(position, '#e0ffbf', 16, 60, 180);
    this.hud.showToast('Shield Broken!');
  }

  emitSporeCloud(position: Vector2) {
    this.spawnParticles(position, '#c599ff', 20, 50, 140);
  }

  emitScorePop(position: Vector2, score: number) {
    const text = `+${score}`;
    this.spawnParticles(position, '#ffffff', 12, 20, 60);
    this.particles.push({
      position: { ...position },
      velocity: { x: 0, y: -80 },
      life: 0.7,
      size: 18,
      color: text,
    });
  }

  laneToWorld(lane: number): Vector2 {
    const lanes = 6;
    const padding = 120;
    const usableWidth = this.width - padding * 2;
    const step = usableWidth / (lanes - 1);
    return { x: padding + step * (lane - 1), y: -60 };
  }

  spawnEnemy(type: EnemyKind, params: { position: Vector2; hp: number; speed: number }) {
    let enemy: Enemy;
    switch (type) {
      case 'GloobZigzag':
        enemy = new GloobZigzag(params);
        break;
      case 'SplitterGloob':
        enemy = new SplitterGloob(params);
        break;
      case 'ShieldyGloob':
        enemy = new ShieldyGloob(params);
        break;
      case 'Splitterling':
        enemy = new Splitterling(params);
        break;
      case 'Magnetron':
        enemy = new Magnetron(params);
        break;
      case 'SporePuff':
        enemy = new SporePuff(params);
        break;
      default:
        enemy = new GloobZigzag(params);
        break;
    }
    this.enemies.push(enemy);
  }

  private registerEvents() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
  }

  private onPointerDown = (event: PointerEvent) => {
    const point = this.eventToCanvas(event);
    if (!this.pointer.dragging && this.launchCooldown <= 0) {
      this.pointer = {
        dragging: true,
        pointerId: event.pointerId,
        current: point,
      };
      this.canvas.setPointerCapture(event.pointerId);
    } else if (!this.aftertouch.active && this.hasActiveOrbs) {
      this.aftertouch = {
        active: true,
        pointerId: event.pointerId,
        direction: 0,
      };
      this.canvas.setPointerCapture(event.pointerId);
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    const point = this.eventToCanvas(event);
    if (this.pointer.dragging && this.pointer.pointerId === event.pointerId) {
      this.pointer.current = point;
    } else if (this.aftertouch.active && this.aftertouch.pointerId === event.pointerId) {
      const relative = (point.x - this.width / 2) / (this.width / 2);
      this.aftertouch.direction = clamp(relative, -1, 1);
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (this.pointer.dragging && this.pointer.pointerId === event.pointerId) {
      const point = this.eventToCanvas(event);
      this.pointer.dragging = false;
      this.pointer.pointerId = null;
      this.launchOrb(point);
    }
    if (this.aftertouch.active && this.aftertouch.pointerId === event.pointerId) {
      this.aftertouch.active = false;
      this.aftertouch.pointerId = null;
      this.aftertouch.direction = 0;
    }
    this.canvas.releasePointerCapture(event.pointerId);
  };

  private onResize = () => {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = rect.width / this.width;
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    this.width = this.canvas.width / window.devicePixelRatio;
    this.height = this.canvas.height / window.devicePixelRatio;
    this.cannonPosition = { x: this.width / 2, y: this.height - this.bottomSafeZone / 2 };
  };

  private loop = (time: number) => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    if (this.paused) {
      return;
    }
    const delta = (time - this.lastTime) / 1000;
    this.lastTime = time;
    this.update(delta);
    this.render();
  };

  private update(dt: number) {
    this.launchCooldown = Math.max(0, this.launchCooldown - dt);
    this.waveManager.update(dt);

    if (this.aftertouch.active && this.focus > 0) {
      const force = this.aftertouch.direction * 680 * dt;
      for (const orb of this.orbs) {
        if (!orb.alive) continue;
        orb.velocity.x += force;
      }
      this.focus = clamp(this.focus - 20 * dt, 0, 100);
    }

    for (const orb of this.orbs) {
      orb.update(dt, this);
    }

    for (const enemy of this.enemies) {
      if (enemy.alive) {
        enemy.update(dt, this);
      }
    }

    this.handleCollisions();

    const chain = this.modifiers.chainLightning;
    if (chain && this.orbs.filter((o) => o.alive).length > 1) {
      chain.cooldown -= dt;
      if (chain.cooldown <= 0) {
        chain.cooldown = chain.interval;
        this.tickChainLightning(chain.damage, chain.range);
      }
    }

    this.orbs = this.orbs.filter((orb) => orb.alive);
    this.enemies = this.enemies.filter((enemy) => enemy.alive);

    this.comboTimer += dt;
    if (this.comboTimer > 2 && this.comboHeat > 0) {
      this.comboHeat = Math.max(0, this.comboHeat - dt * 2);
    }

    for (const particle of this.particles) {
      particle.life -= dt;
      particle.position = add(particle.position, scale(particle.velocity, dt));
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    this.updateHud();
  }

  private handleCollisions() {
    for (const orb of this.orbs) {
      if (!orb.alive) continue;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const sum = orb.radius + enemy.radius;
        if (distanceSq(orb.position, enemy.position) <= sum * sum) {
          this.resolveOrbHit(orb, enemy);
          if (!orb.alive) {
            break;
          }
        }
      }
    }
  }

  private resolveOrbHit(orb: Orb, enemy: Enemy) {
    const impactPoint = { ...enemy.position };
    const damage = this.computeOrbDamage(orb, enemy);
    enemy.takeDamage(damage, this, orb);
    this.spawnParticles(impactPoint, orb.color, 12, 40, 140);

    if (enemy.alive) {
      if (this.modifiers.slowEffect) {
        enemy.applySlow(this.modifiers.slowEffect.duration, this.modifiers.slowEffect.factor);
      }
      if (this.modifiers.knockbackForce > 0) {
        enemy.applyKnockback(this.modifiers.knockbackForce);
      }
    }

    if (this.modifiers.explosion) {
      this.triggerExplosion(impactPoint, orb);
    }

    if (orb.splitOnImpact) {
      this.splitOrb(orb);
      return;
    }

    const relative = subtract(orb.position, impactPoint);
    const dir = normalize(relative);
    const speed = length(orb.velocity) * 0.7 + 320;
    orb.velocity = scale(dir, speed);
  }

  private splitOrb(orb: Orb) {
    const speed = length(orb.velocity);
    const angle = Math.atan2(orb.velocity.y, orb.velocity.x);
    const spread = 0.28;
    const offsets = [-spread, spread];
    for (const offset of offsets) {
      const theta = angle + offset;
      const vel = { x: Math.cos(theta) * speed, y: Math.sin(theta) * speed };
      const clone = orb.cloneWithVelocity(vel);
      this.orbs.push(clone);
    }
    orb.alive = false;
  }

  private triggerExplosion(center: Vector2, source: Orb) {
    const explosion = this.modifiers.explosion;
    if (!explosion) return;
    this.spawnParticles(center, '#ff9a61', 18, 120, explosion.radius);
    const radiusSq = explosion.radius * explosion.radius;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (distanceSq(enemy.position, center) <= radiusSq) {
        enemy.takeDamage(explosion.damage, this, source);
      }
    }
  }

  private tickChainLightning(damage: number, range: number) {
    const aliveOrbs = this.orbs.filter((orb) => orb.alive);
    if (aliveOrbs.length < 2) return;
    const rangeSq = range * range;
    const affected = new Set<Enemy>();
    for (let i = 0; i < aliveOrbs.length; i++) {
      for (let j = i + 1; j < aliveOrbs.length; j++) {
        const a = aliveOrbs[i];
        const b = aliveOrbs[j];
        for (const enemy of this.enemies) {
          if (!enemy.alive || affected.has(enemy)) continue;
          const distSq = distanceToSegmentSq(enemy.position, a.position, b.position);
          if (distSq <= rangeSq) {
            enemy.takeDamage(damage, this, a);
            this.spawnParticles(enemy.position, '#87bbff', 6, 40, 90);
            affected.add(enemy);
          }
        }
      }
    }
  }

  private computeOrbDamage(orb: Orb, enemy: Enemy) {
    let damage = orb.damage * this.modifiers.damageMultiplier;

    if (this.modifiers.comboHeatDamagePercent > 0) {
      const comboMultiplier =
        1 + Math.max(0, this.comboHeat) * this.modifiers.comboHeatDamagePercent;
      damage *= comboMultiplier;
    }

    if (this.modifiers.bounceDamagePercent > 0 && orb.bounceCount > 0) {
      damage *= 1 + orb.bounceCount * this.modifiers.bounceDamagePercent;
    }

    if (this.isBossOrElite(enemy) && this.modifiers.bossDamageMultiplier > 1) {
      damage *= this.modifiers.bossDamageMultiplier;
    }

    if (orb.pendingWallDamageBonus > 0) {
      damage *= 1 + orb.pendingWallDamageBonus;
      orb.pendingWallDamageBonus = 0;
    }

    const tier = Math.floor(this.comboHeat / 5);
    return damage + tier * this.modifiers.comboDamagePerTier;
  }

  private isBossOrElite(enemy: Enemy) {
    return enemy.isBoss || enemy.isElite;
  }

  private spawnParticles(position: Vector2, color: string, count: number, speed: number, radius: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const magnitude = Math.random() * speed;
      this.particles.push({
        position: { ...position },
        velocity: { x: Math.cos(angle) * magnitude, y: Math.sin(angle) * magnitude },
        life: 0.5 + Math.random() * 0.4,
        size: Math.random() * 6 + 2,
        color,
      });
    }
  }

  private launchOrb(target: Vector2) {
    const drag = subtract(this.cannonPosition, target);
    const power = length(drag);
    if (power < 20 || this.launchCooldown > 0 || this.lives <= 0) {
      return;
    }
    const direction = normalize(drag);
    const speed = (550 + clamp(power, 0, 280) * 3.2) * 3;
    const baseAngle = Math.atan2(direction.y, direction.x);
    const count = this.modifiers.tripleLaunch ? 3 : 1;
    const spread = 0.22;
    const offsets = count === 1 ? [0] : [-spread, 0, spread];
    for (const offset of offsets) {
      const theta = baseAngle + offset;
      const velocity = {
        x: Math.cos(theta) * speed,
        y: Math.sin(theta) * speed,
      };
      const orb = new Orb(
        { ...this.cannonPosition },
        velocity,
        {
          radius: 16 * this.modifiers.orbSizeMultiplier,
          splitOnImpact: this.modifiers.splitOnImpact,
        },
      );
      this.orbs.push(orb);
    }
    this.launchCooldown = 0.35;
    this.focus = clamp(this.focus - 5, 0, 100);
  }

  private handleGameOver() {
    this.hud.showToast('Run Terminated - Tap to reset');
    this.paused = true;
    setTimeout(() => {
      this.reset();
      this.paused = false;
      this.lastTime = performance.now();
    }, 1200);
  }

  private createInitialModifiers(): ModifierState {
    return {
      orbSizeMultiplier: 1,
      comboDamagePerTier: 0,
      knockbackForce: 0,
      homingStrength: 0,
      splitOnImpact: false,
      tripleLaunch: false,
      damageMultiplier: 1,
      comboHeatDamagePercent: 0,
      bounceDamagePercent: 0,
      bossDamageMultiplier: 1,
      wallHitDamageBonusPercent: 0,
    };
  }

  private reset() {
    this.score = 0;
    this.comboHeat = 0;
    this.comboTimer = 0;
    this.focus = 70;
    this.lives = this.maxLives;
    this.waveId = 'S1-W1';
    this.orbs = [];
    this.enemies = [];
    this.particles = [];
    this.availableMajorModifiers = [...MAJOR_MODIFIERS];
    this.modifiers = this.createInitialModifiers();
    this.drafting = false;
    this.pauseLocked = false;
    this.completedWaves = 0;
    this.draft.hide();
    this.waveManager.reset();
    this.updateHud();
  }

  private updateHud() {
    const heat = Math.floor(this.comboHeat);
    const tier = Math.floor(heat / 5);
    const progress = (this.comboHeat % 5) / 5;
    const data: HudData = {
      score: Math.floor(this.score),
      comboHeat: heat,
      comboTier: tier,
      comboProgress: progress,
      focus: this.focus,
      lives: this.lives,
      wave: this.waveManager.waveNumber,
      lastModifier: this.modifiers.lastPicked,
    };
    this.hud.update(data);
  }

  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    this.drawBackground(ctx);
    this.drawAim(ctx);

    for (const enemy of this.enemies) {
      enemy.draw(ctx);
    }

    this.drawChainLinks(ctx);

    for (const orb of this.orbs) {
      if (!orb.alive) continue;
      ctx.save();
      ctx.translate(orb.position.x, orb.position.y);
      ctx.fillStyle = orb.color;
      ctx.shadowColor = orb.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const particle of this.particles) {
      if (particle.color.startsWith('#')) {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.position.x, particle.position.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(particle.position.x, particle.position.y);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `${particle.size}px Rajdhani, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(particle.color, 0, 0);
        ctx.restore();
      }
    }

    this.drawCannon(ctx);
  }

  private drawChainLinks(ctx: CanvasRenderingContext2D) {
    if (!this.modifiers.chainLightning) return;
    const alive = this.orbs.filter((orb) => orb.alive);
    if (alive.length < 2) return;
    ctx.save();
    const intensity = (Math.sin(this.lastTime * 0.012) + 1) * 0.25 + 0.45;
    ctx.globalAlpha = intensity;
    ctx.lineWidth = 3.5;
    ctx.shadowBlur = 18;
    ctx.shadowColor = 'rgba(118, 169, 255, 0.85)';
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i];
        const b = alive[j];
        const gradient = ctx.createLinearGradient(a.position.x, a.position.y, b.position.x, b.position.y);
        gradient.addColorStop(0, 'rgba(118, 169, 255, 1)');
        gradient.addColorStop(1, 'rgba(89, 255, 214, 1)');
        ctx.strokeStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(a.position.x, a.position.y);
        ctx.lineTo(b.position.x, b.position.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#09061b');
    gradient.addColorStop(0.5, '#05020d');
    gradient.addColorStop(1, '#080018');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = 'rgba(79, 168, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let y = this.height - this.bottomSafeZone; y >= 0; y -= 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
  }

  private drawAim(ctx: CanvasRenderingContext2D) {
    if (!this.pointer.dragging) return;
    const drag = subtract(this.cannonPosition, this.pointer.current);
    const dir = normalize(drag);
    const lengthPixels = clamp(length(drag), 0, 280);
    ctx.save();
    ctx.translate(this.cannonPosition.x, this.cannonPosition.y);
    ctx.strokeStyle = 'rgba(0, 255, 213, 0.6)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dir.x * lengthPixels * 0.6, dir.y * lengthPixels * 0.6);
    ctx.stroke();
    ctx.restore();
  }

  private drawCannon(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.cannonPosition.x, this.cannonPosition.y);
    ctx.fillStyle = '#10152f';
    const width = 100;
    const height = 80;
    const radius = 30;
    ctx.beginPath();
    ctx.moveTo(-width / 2 + radius, 0);
    ctx.lineTo(width / 2 - radius, 0);
    ctx.quadraticCurveTo(width / 2, 0, width / 2, radius);
    ctx.lineTo(width / 2, height - radius);
    ctx.quadraticCurveTo(width / 2, height, width / 2 - radius, height);
    ctx.lineTo(-width / 2 + radius, height);
    ctx.quadraticCurveTo(-width / 2, height, -width / 2, height - radius);
    ctx.lineTo(-width / 2, radius);
    ctx.quadraticCurveTo(-width / 2, 0, -width / 2 + radius, 0);
    ctx.fill();

    ctx.fillStyle = 'rgba(56, 243, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, 38, Math.PI, 0, false);
    ctx.fill();

    ctx.fillStyle = 'rgba(120, 255, 196, 0.5)';
    ctx.beginPath();
    ctx.arc(0, 8, 24, Math.PI, 0, false);
    ctx.fill();

    ctx.restore();
  }

  private eventToCanvas(event: PointerEvent): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.width,
      y: ((event.clientY - rect.top) / rect.height) * this.height,
    };
  }

}
