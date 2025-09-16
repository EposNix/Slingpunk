import { HUD } from '../ui/HUD';
import type { EnemyKind, HudData, PowerUpType, Vector2 } from './types';
import { add, clamp, distanceSq, length, normalize, randomChoice, scale, subtract } from './utils';
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
import { PowerUp } from './entities/PowerUp';
import { WaveManager } from './waves/WaveManager';

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

const POWERUP_TYPES: PowerUpType[] = ['lightning', 'shield', 'multiball', 'ricochet', 'pierce', 'timewarp'];

export class Game {
  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hud: HUD;

  public width: number;
  public height: number;
  public readonly bottomSafeZone = 180;
  public readonly baseEnemySpeed = 55;

  public orbs: Orb[] = [];
  public enemies: Enemy[] = [];
  public powerUps: PowerUp[] = [];

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
  private lives = 3;
  private heldPowerUp: PowerUpType | undefined;
  private waveId = 'S1-W1';

  private readonly waveManager: WaveManager;

  private timeWarpTimer = 0;

  constructor(canvas: HTMLCanvasElement, hud: HUD) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context failed to initialize');
    this.ctx = context;
    this.hud = hud;

    this.width = canvas.width;
    this.height = canvas.height;
    this.cannonPosition = { x: this.width / 2, y: this.height - this.bottomSafeZone / 2 };

    this.waveManager = new WaveManager(this);

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
    this.updateHud();
  }

  onEnemyKilled(enemy: Enemy, orb: Orb) {
    const baseScore = 100 + enemy.maxHp * 15;
    const tier = Math.floor(this.comboHeat / 5);
    const multiplier = 1 + tier * 0.1;
    const delta = Math.round(baseScore * multiplier);
    this.score += delta;
    this.emitScorePop(enemy.position, delta);

    if (this.waveManager.rollDrop(enemy.type)) {
      const type = randomChoice(POWERUP_TYPES);
      this.powerUps.push(new PowerUp(type, enemy.position));
    }

    this.comboHeat += 1;
    this.comboTimer = 0;
    this.focus = clamp(this.focus + 10, 0, 100);
  }

  onEnemyBreach(_enemy: Enemy) {
    this.lives -= 1;
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

  emitWallHit(position: Vector2) {
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
    const timeScale = this.timeWarpTimer > 0 ? 0.6 : 1;
    const scaledDt = dt * timeScale;
    if (this.timeWarpTimer > 0) {
      this.timeWarpTimer = Math.max(0, this.timeWarpTimer - dt);
    }

    this.launchCooldown = Math.max(0, this.launchCooldown - scaledDt);
    this.waveManager.update(scaledDt);

    if (this.aftertouch.active && this.focus > 0) {
      const force = this.aftertouch.direction * 680 * scaledDt;
      for (const orb of this.orbs) {
        if (!orb.alive) continue;
        orb.velocity.x += force;
      }
      this.focus = clamp(this.focus - 20 * scaledDt, 0, 100);
    }

    for (const orb of this.orbs) {
      orb.update(scaledDt, this);
    }

    for (const enemy of this.enemies) {
      if (enemy.alive) {
        enemy.update(scaledDt, this);
      }
    }

    for (const power of this.powerUps) {
      power.update(scaledDt, this);
    }

    this.handleCollisions();

    this.orbs = this.orbs.filter((orb) => orb.alive);
    this.enemies = this.enemies.filter((enemy) => enemy.alive);
    this.powerUps = this.powerUps.filter((power) => power.alive);

    this.comboTimer += dt;
    if (this.comboTimer > 2 && this.comboHeat > 0) {
      this.comboHeat = Math.max(0, this.comboHeat - dt * 2);
    }

    for (const particle of this.particles) {
      particle.life -= scaledDt;
      if (particle.color.startsWith('#')) {
        particle.position = add(particle.position, scale(particle.velocity, scaledDt));
      } else {
        particle.position = add(particle.position, scale(particle.velocity, scaledDt));
      }
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
        }
      }

      for (const power of this.powerUps) {
        if (!power.alive) continue;
        const range = orb.radius + power.radius;
        if (distanceSq(orb.position, power.position) <= range * range) {
          this.collectPowerUp(power, orb);
        }
      }
    }
  }

  private resolveOrbHit(orb: Orb, enemy: Enemy) {
    enemy.takeDamage(orb.damage, this, orb);
    this.spawnParticles(enemy.position, orb.color, 12, 40, 140);

    if (orb.pendingSplit) {
      orb.pendingSplit = false;
      this.splitOrb(orb);
    }

    if (orb.lightningChains > 0) {
      this.chainLightning(orb, enemy);
      orb.lightningChains = Math.max(0, orb.lightningChains - 2);
    }

    if (orb.pierceLeft > 0) {
      orb.pierceLeft -= 1;
    } else if (orb.shieldHits > 0) {
      orb.shieldHits -= 1;
    } else {
      const relative = subtract(orb.position, enemy.position);
      const dir = normalize(relative);
      const speed = length(orb.velocity) * 0.7 + 320;
      orb.velocity = scale(dir, speed);
    }
  }

  private collectPowerUp(power: PowerUp, orb: Orb) {
    power.alive = false;
    if (this.hasActiveOrbs) {
      orb.applyPowerUp(power.type);
      if (power.type === 'timewarp') {
        this.timeWarpTimer = 2;
      }
      this.hud.showToast(`${this.formatPowerup(power.type)} ready!`);
    } else {
      this.heldPowerUp = power.type;
    }
  }

  private splitOrb(orb: Orb) {
    const speed = length(orb.velocity);
    const baseDir = normalize(orb.velocity);
    const angle = Math.atan2(baseDir.y, baseDir.x);
    const spread = 0.3;
    const velocities = [angle - spread, angle + spread].map((theta) => ({
      x: Math.cos(theta) * speed,
      y: Math.sin(theta) * speed,
    }));
    for (const vel of velocities) {
      const clone = orb.cloneWithVelocity(vel);
      clone.pendingSplit = false;
      this.orbs.push(clone);
    }
  }

  private chainLightning(orb: Orb, primary: Enemy) {
    const maxTargets = 4;
    let remaining = Math.min(maxTargets, Math.floor(orb.lightningChains));
    const struck = new Set<Enemy>([primary]);
    let last = primary;
    while (remaining > 0) {
      let candidate: Enemy | undefined;
      let bestDist = Infinity;
      for (const enemy of this.enemies) {
        if (!enemy.alive || struck.has(enemy)) continue;
        const dist = distanceSq(enemy.position, last.position);
        if (dist < bestDist && dist < 260 * 260) {
          bestDist = dist;
          candidate = enemy;
        }
      }
      if (!candidate) break;
      candidate.takeDamage(orb.damage, this, orb);
      this.spawnParticles(candidate.position, '#87bbff', 14, 60, 160);
      struck.add(candidate);
      last = candidate;
      remaining -= 1;
    }
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
    const speed = 550 + clamp(power, 0, 280) * 3.2;
    const orb = new Orb({ ...this.cannonPosition }, scale(direction, speed));
    if (this.heldPowerUp) {
      orb.applyPowerUp(this.heldPowerUp);
      if (this.heldPowerUp === 'timewarp') {
        this.timeWarpTimer = 2;
      }
      this.heldPowerUp = undefined;
    }
    this.orbs.push(orb);
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

  private reset() {
    this.score = 0;
    this.comboHeat = 0;
    this.comboTimer = 0;
    this.focus = 70;
    this.lives = 3;
    this.heldPowerUp = undefined;
    this.waveId = 'S1-W1';
    this.orbs = [];
    this.enemies = [];
    this.powerUps = [];
    this.particles = [];
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
      powerUp: this.getDisplayedPowerUp(),
    };
    this.hud.update(data);
  }

  private getDisplayedPowerUp(): PowerUpType | undefined {
    if (this.timeWarpTimer > 0) {
      return 'timewarp';
    }
    const orb = this.orbs.find((o) => o.alive);
    if (orb) {
      if (orb.lightningChains > 0) return 'lightning';
      if (orb.pierceLeft > 0) return 'pierce';
      if (orb.pendingSplit) return 'multiball';
      if (orb.shieldHits > 0) return 'shield';
      if (orb.ricochetBuff > 0.1) return 'ricochet';
    }
    return this.heldPowerUp;
  }

  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    this.drawBackground(ctx);
    this.drawAim(ctx);

    for (const enemy of this.enemies) {
      enemy.draw(ctx);
    }

    for (const power of this.powerUps) {
      power.draw(ctx);
    }

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

  private formatPowerup(type: PowerUpType) {
    switch (type) {
      case 'lightning':
        return 'Lightning';
      case 'shield':
        return 'Shield';
      case 'multiball':
        return 'Multiball';
      case 'ricochet':
        return 'Ricochet';
      case 'pierce':
        return 'Pierce';
      case 'timewarp':
        return 'Time Warp';
    }
  }
}
