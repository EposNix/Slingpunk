import { HUD } from '../ui/HUD';
import { PauseOverlay, type PauseOverlayPlayerModifier } from '../ui/PauseOverlay';
import { PowerDraftOverlay } from '../ui/PowerDraftOverlay';
import type {
  DifficultyDefinition,
  EnemyKind,
  EnemyWaveScaling,
  HudData,
  ModifierRarity,
  ModifierState,
  RunModifierId,
  Vector2,
  WaveStartAnnouncement,
} from './types';
import {
  add,
  clamp,
  distanceSq,
  distanceToSegmentSq,
  length,
  normalize,
  randomRange,
  scale,
  subtract,
} from './utils';
import { Orb } from './entities/Orb';
import type { Enemy } from './entities/Enemy';
import {
  AegisSentinel,
  BulwarkGloob,
  GloobZigzag,
  Magnetron,
  ShieldyGloob,
  SplitterGloob,
  Splitterling,
  SporePuff,
  WarpStalker,
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

type ParticleKind = 'spark' | 'ember' | 'shard';

interface Particle {
  position: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  glow: string;
  rotation: number;
  rotationSpeed: number;
  stretch: number;
  drag: number;
  type: ParticleKind;
  target?: Vector2;
  attraction?: number;
}

interface FloatingText {
  position: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  value: string;
  size: number;
  color: string;
  stroke?: string;
  weight: number;
  pop: number;
}

interface ImpactWave {
  position: Vector2;
  life: number;
  maxLife: number;
  maxRadius: number;
  color: string;
}

interface BackgroundStar {
  xPercent: number;
  yPercent: number;
  radius: number;
  twinkleSpeed: number;
  twinklePhase: number;
  parallax: number;
  color: string;
}

interface EnergyRibbon {
  offset: number;
  amplitude: number;
  frequency: number;
  speed: number;
  thickness: number;
  color: string;
  glow: string;
  phase: number;
}

export class Game {
  public readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hud: HUD;
  private readonly draft: PowerDraftOverlay;
  private readonly pauseOverlay: PauseOverlay;

  public width: number;
  public height: number;
  public readonly bottomSafeZone = 180;
  public readonly baseEnemySpeed = 55;
  private readonly floatingTextLimit = 80;
  private readonly minDamageForFloatingText = 1;

  public orbs: Orb[] = [];
  public enemies: Enemy[] = [];

  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private impactWaves: ImpactWave[] = [];
  private backgroundStars: BackgroundStar[] = [];
  private backgroundRibbons: EnergyRibbon[] = [];
  private novaAnchor: Vector2 = { x: 0, y: 0 };
  private novaCharge = 0;
  private readonly novaChargeMax = 100;
  private readonly novaChargePerKill = 20;
  private readonly novaName = 'Nova Pulse';
  private screenShakeOffset: Vector2 = { x: 0, y: 0 };
  private screenShakeTimer = 0;
  private screenShakeDuration = 0;
  private screenShakeIntensity = 0;
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
  private enemyScaling: EnemyWaveScaling;
  private playerModifierCounts = new Map<RunModifierId, number>();
  private difficulty: DifficultyDefinition;

  constructor(
    canvas: HTMLCanvasElement,
    hud: HUD,
    draft: PowerDraftOverlay,
    pauseOverlay: PauseOverlay,
    difficulty: DifficultyDefinition,
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context failed to initialize');
    this.ctx = context;
    this.hud = hud;
    this.draft = draft;
    this.pauseOverlay = pauseOverlay;

    this.width = canvas.width;
    this.height = canvas.height;
    this.cannonPosition = { x: this.width / 2, y: this.height - this.bottomSafeZone / 2 };
    this.novaAnchor = { x: this.width / 2, y: this.height - this.bottomSafeZone / 2 };

    this.waveManager = new WaveManager(this);
    this.availableMajorModifiers = [...MAJOR_MODIFIERS];
    this.modifiers = this.createInitialModifiers();
    this.lives = this.maxLives;
    this.enemyScaling = this.createDefaultEnemyScaling();
    this.difficulty = difficulty;

    this.seedBackdrop();

    this.hud.onSpecialRequested(() => {
      this.tryActivateNovaPulse();
    });

    this.pauseOverlay.onResumeRequested(() => {
      if (this.paused && !this.pauseLocked) {
        this.togglePause();
      }
    });

    this.registerEvents();
    this.onResize();
    this.updateHud();
    this.syncPlayerModifiersOverlay();
    this.pauseOverlay.setEnemyModifiers([]);
  }

  start() {
    if (this.running) return;
    this.reset();
    this.running = true;
    this.paused = false;
    this.hud.setPaused(false);
    this.pauseOverlay.setVisible(false);
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  togglePause() {
    if (!this.running) return;
    if (this.pauseLocked) return;
    this.paused = !this.paused;
    this.hud.setPaused(this.paused);
    this.syncPlayerModifiersOverlay();
    this.pauseOverlay.setVisible(this.paused);
    if (!this.paused) {
      this.lastTime = performance.now();
    }
  }

  dispose() {
    this.running = false;
    this.paused = false;
    this.hud.setPaused(false);
    this.pauseOverlay.setVisible(false);
    this.reset();
    this.pauseOverlay.onResumeRequested(() => {});
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
  }

  get hasActiveOrbs() {
    return this.orbs.some((orb) => orb.alive);
  }

  onWaveStart(info: WaveStartAnnouncement) {
    this.waveId = info.blueprintId;
    this.enemyScaling = { ...info.scaling };

    const statParts: string[] = [];
    const hpPercent = Math.round((info.scaling.hpMultiplier - 1) * 100);
    const countPercent = Math.round((info.scaling.countMultiplier - 1) * 100);
    const speedPercent = Math.round((info.scaling.speedMultiplier - 1) * 100);
    if (hpPercent > 0) {
      statParts.push(`+${hpPercent}% HP`);
    }
    if (countPercent > 0) {
      statParts.push(`+${countPercent}% swarm`);
    }
    if (speedPercent > 0) {
      statParts.push(`+${speedPercent}% speed`);
    }
    if (info.scaling.hpBonus >= 1) {
      statParts.push(`+${Math.round(info.scaling.hpBonus)} flat HP`);
    }

    const messageParts = [`Wave ${info.waveNumber}`];
    if (statParts.length) {
      messageParts.push(statParts.join(', '));
    }
    if (info.modifiers.length) {
      const names = info.modifiers.map((mod) => mod.name).join(', ');
      messageParts.push(`Mutations: ${names}`);
    }

    const duration = 2200 + info.modifiers.length * 350;
    this.hud.showToast(messageParts.join(' · '), duration);
    this.pauseOverlay.setEnemyModifiers(info.modifiers);
    this.updateHud();
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
    const previousCount = this.playerModifierCounts.get(definition.id) ?? 0;
    this.playerModifierCounts.set(definition.id, previousCount + 1);

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

    this.syncPlayerModifiersOverlay();
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
    const impactRadius = enemy.isBoss || enemy.isElite ? 220 : 150;
    this.spawnImpactWave(enemy.position, impactRadius);

    this.comboHeat += 1;
    this.comboTimer = 0;
    this.focus = clamp(this.focus + 10, 0, 100);
    this.chargeNovaPulse(enemy.position);
  }

  private chargeNovaPulse(origin: Vector2) {
    const wasReady = this.isNovaPulseReady();
    this.novaCharge = clamp(this.novaCharge + this.novaChargePerKill, 0, this.novaChargeMax);
    this.spawnNovaShards(origin);
    if (!wasReady && this.isNovaPulseReady()) {
      this.spawnNovaReadyPulse();
    }
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
    this.spawnImpactWave(position, 180, 0.4, 'rgba(224, 255, 191, 0.9)');
    this.addScreenShake(4, 0.3);
  }

  emitSporeCloud(position: Vector2) {
    this.spawnParticles(position, '#c599ff', 20, 50, 140);
  }

  emitScorePop(position: Vector2, score: number) {
    this.spawnParticles(position, '#ffffff', 12, 20, 60);
    const formatted = `+${score.toLocaleString()}`;
    this.spawnFloatingText(formatted, position, {
      color: '#ffe898',
      stroke: 'rgba(80, 18, 0, 0.7)',
      size: 38,
      life: 1.1,
      pop: 0.65,
      velocity: { x: (Math.random() - 0.5) * 50, y: -150 - Math.random() * 40 },
    });
    if (score >= 400) {
      const magnitude = Math.min(24, 6 + score / 70);
      this.addScreenShake(magnitude, 0.45);
    }
  }

  emitDamageNumber(
    position: Vector2,
    amount: number,
    options: { critical?: boolean; shield?: boolean } = {},
  ) {
    if (amount <= 0 || !Number.isFinite(amount)) {
      return;
    }
    if (amount < this.minDamageForFloatingText) {
      return;
    }
    const formatted = this.formatDamageNumber(amount);
    const magnitude = Math.sqrt(Math.max(amount, 1));
    const baseSize = options.shield ? 22 : 26;
    const size = baseSize + Math.min(20, magnitude * 4.2);
    const color = options.shield
      ? '#9cf5ff'
      : options.critical
        ? '#ffef9d'
        : '#f5f3ff';
    const stroke = options.shield
      ? 'rgba(12, 30, 50, 0.75)'
      : 'rgba(32, 4, 54, 0.75)';
    const velocity = {
      x: (Math.random() - 0.5) * (options.critical ? 70 : 40),
      y: -120 - Math.random() * 50,
    };
    this.spawnFloatingText(formatted, position, {
      color,
      stroke,
      size,
      life: options.critical ? 1.1 : 0.85,
      pop: options.critical ? 0.75 : 0.45,
      weight: options.critical ? 800 : 700,
      velocity,
    });
  }

  private spawnFloatingText(
    value: string,
    origin: Vector2,
    options: {
      velocity?: Vector2;
      color?: string;
      stroke?: string;
      size?: number;
      life?: number;
      pop?: number;
      weight?: number;
    } = {},
  ) {
    const life = options.life ?? 0.8;
    const jitter = {
      x: (Math.random() - 0.5) * 22,
      y: (Math.random() - 0.5) * 16,
    };
    const text: FloatingText = {
      position: { x: origin.x + jitter.x, y: origin.y + jitter.y },
      velocity: options.velocity ? { ...options.velocity } : { x: 0, y: -120 },
      life,
      maxLife: life,
      value,
      size: options.size ?? 26,
      color: options.color ?? '#ffffff',
      stroke: options.stroke,
      weight: options.weight ?? 700,
      pop: options.pop ?? 0.4,
    };
    if (this.floatingTexts.length >= this.floatingTextLimit) {
      const overflow = this.floatingTexts.length - this.floatingTextLimit + 1;
      this.floatingTexts.splice(0, overflow);
    }
    this.floatingTexts.push(text);
  }

  private spawnImpactWave(
    position: Vector2,
    maxRadius = 140,
    duration = 0.45,
    color = 'rgba(255, 189, 128, 0.9)',
  ) {
    this.impactWaves.push({
      position: { ...position },
      life: duration,
      maxLife: duration,
      maxRadius,
      color,
    });
  }

  private addScreenShake(intensity: number, duration = 0.35) {
    if (intensity <= 0 || duration <= 0) return;
    this.screenShakeIntensity = Math.min(28, this.screenShakeIntensity + intensity);
    this.screenShakeDuration = Math.max(this.screenShakeDuration, duration);
    this.screenShakeTimer = Math.max(this.screenShakeTimer, duration);
  }

  private formatDamageNumber(amount: number) {
    if (amount >= 1000) {
      return Math.round(amount).toLocaleString();
    }
    if (amount >= 100) {
      return Math.round(amount).toString();
    }
    if (amount >= 10) {
      return amount.toFixed(1).replace(/\.0$/, '');
    }
    if (amount >= 1) {
      return amount.toFixed(1).replace(/\.0$/, '');
    }
    return amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  laneToWorld(lane: number): Vector2 {
    const lanes = 6;
    const padding = 120;
    const usableWidth = this.width - padding * 2;
    const step = usableWidth / (lanes - 1);
    return { x: padding + step * (lane - 1), y: -60 };
  }

  spawnEnemy(type: EnemyKind, params: { position: Vector2; hp: number; speed: number }) {
    const scaling = this.enemyScaling;
    const scaledHpValue = params.hp * scaling.hpMultiplier + scaling.hpBonus;
    const minimumHp = params.hp + Math.floor(scaling.level / 3);
    const baseHp = Math.max(1, Math.max(Math.round(scaledHpValue), minimumHp));
    const hp = Math.max(1, Math.round(baseHp * this.difficulty.enemyHpMultiplier));
    const speed = params.speed * scaling.speedMultiplier;
    const spawnParams = { position: params.position, hp, speed };

    let enemy: Enemy;
    switch (type) {
      case 'GloobZigzag':
        enemy = new GloobZigzag(spawnParams);
        break;
      case 'SplitterGloob':
        enemy = new SplitterGloob(spawnParams);
        break;
      case 'ShieldyGloob':
        enemy = new ShieldyGloob(spawnParams);
        break;
      case 'Splitterling':
        enemy = new Splitterling(spawnParams);
        break;
      case 'Magnetron':
        enemy = new Magnetron(spawnParams);
        break;
      case 'SporePuff':
        enemy = new SporePuff(spawnParams);
        break;
      case 'BulwarkGloob':
        enemy = new BulwarkGloob(spawnParams);
        break;
      case 'WarpStalker':
        enemy = new WarpStalker(spawnParams);
        break;
      case 'AegisSentinel':
        enemy = new AegisSentinel(spawnParams);
        break;
      default:
        enemy = new GloobZigzag(spawnParams);
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
    if (!this.running || this.paused || this.drafting) {
      return;
    }
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
    if (!this.running || this.paused) {
      return;
    }
    const point = this.eventToCanvas(event);
    if (this.pointer.dragging && this.pointer.pointerId === event.pointerId) {
      this.pointer.current = point;
    } else if (this.aftertouch.active && this.aftertouch.pointerId === event.pointerId) {
      const relative = (point.x - this.width / 2) / (this.width / 2);
      this.aftertouch.direction = clamp(relative, -1, 1);
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.running || this.paused) {
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
      return;
    }
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
    this.novaAnchor = { x: this.width / 2, y: this.height - this.bottomSafeZone / 2 };
    for (const particle of this.particles) {
      if (particle.type === 'shard') {
        particle.target = { ...this.novaAnchor };
      }
    }
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
      if (particle.type === 'shard' && particle.target) {
        const toTarget = subtract(particle.target, particle.position);
        const distance = length(toTarget);
        if (distance > 0.001) {
          const direction = scale(toTarget, 1 / distance);
          const pull = (particle.attraction ?? 240) * dt;
          particle.velocity.x += direction.x * pull;
          particle.velocity.y += direction.y * pull;
          if (distance < 38) {
            particle.life -= dt * 1.5;
            particle.rotationSpeed *= 1.02;
          }
        }
      }

      particle.life -= dt;
      particle.position = add(particle.position, scale(particle.velocity, dt));
      const drag = Math.pow(particle.drag, dt * 60);
      particle.velocity.x *= drag;
      particle.velocity.y *= drag;
      if (particle.type === 'ember') {
        particle.velocity.y += 40 * dt;
      } else if (particle.type === 'shard') {
        particle.velocity.x *= 0.96;
        particle.velocity.y *= 0.96;
      }
      particle.rotation += particle.rotationSpeed * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const text of this.floatingTexts) {
      text.life -= dt;
      text.position = add(text.position, scale(text.velocity, dt));
      text.velocity.x *= 0.92;
      text.velocity.y *= 0.92;
    }
    this.floatingTexts = this.floatingTexts.filter((text) => text.life > 0);

    for (const wave of this.impactWaves) {
      wave.life -= dt;
    }
    this.impactWaves = this.impactWaves.filter((wave) => wave.life > 0);

    if (this.screenShakeTimer > 0) {
      this.screenShakeTimer = Math.max(0, this.screenShakeTimer - dt);
      const ratio = this.screenShakeDuration > 0 ? this.screenShakeTimer / this.screenShakeDuration : 0;
      const falloff = ratio * ratio;
      const magnitude = this.screenShakeIntensity * falloff;
      this.screenShakeOffset = {
        x: (Math.random() - 0.5) * 2 * magnitude,
        y: (Math.random() - 0.5) * 2 * magnitude,
      };
      if (this.screenShakeTimer <= 0.0001) {
        this.screenShakeOffset = { x: 0, y: 0 };
        this.screenShakeIntensity = 0;
        this.screenShakeDuration = 0;
      }
    } else if (this.screenShakeIntensity !== 0) {
      this.screenShakeOffset = { x: 0, y: 0 };
      this.screenShakeIntensity = 0;
      this.screenShakeDuration = 0;
    }

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
    this.spawnImpactWave(center, explosion.radius * 1.4, 0.5, 'rgba(255, 170, 120, 0.9)');
    this.addScreenShake(8, 0.35);
    const radiusSq = explosion.radius * explosion.radius;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (distanceSq(enemy.position, center) <= radiusSq) {
        enemy.takeDamage(this.scalePlayerDamage(explosion.damage), this, source);
      }
    }
  }

  private tickChainLightning(damage: number, range: number) {
    const aliveOrbs = this.orbs.filter((orb) => orb.alive);
    if (aliveOrbs.length < 2) return;
    const rangeSq = range * range;
    const affected = new Set<Enemy>();
    const scaledDamage = this.scalePlayerDamage(damage);
    for (let i = 0; i < aliveOrbs.length; i++) {
      for (let j = i + 1; j < aliveOrbs.length; j++) {
        const a = aliveOrbs[i];
        const b = aliveOrbs[j];
        for (const enemy of this.enemies) {
          if (!enemy.alive || affected.has(enemy)) continue;
          const distSq = distanceToSegmentSq(enemy.position, a.position, b.position);
          if (distSq <= rangeSq) {
            enemy.takeDamage(scaledDamage, this, a);
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
    damage += tier * this.modifiers.comboDamagePerTier;
    return this.scalePlayerDamage(damage);
  }

  private scalePlayerDamage(amount: number) {
    return amount * this.difficulty.playerDamageMultiplier;
  }

  private isBossOrElite(enemy: Enemy) {
    return enemy.isBoss || enemy.isElite;
  }

  private spawnParticles(position: Vector2, color: string, count: number, speed: number, radius: number) {
    for (let i = 0; i < count; i++) {
      const type: ParticleKind = Math.random() < 0.65 ? 'spark' : 'ember';
      const baseAngle = Math.random() * Math.PI * 2;
      const spawnRadius = Math.random() * radius * 0.4;
      const spawn = {
        x: position.x + Math.cos(baseAngle) * spawnRadius,
        y: position.y + Math.sin(baseAngle) * spawnRadius,
      };
      const life = randomRange(0.4, 0.85);
      const magnitude = speed * (type === 'spark' ? randomRange(0.45, 1) : randomRange(0.2, 0.55));
      const velocity = {
        x: Math.cos(baseAngle) * magnitude,
        y: Math.sin(baseAngle) * magnitude,
      };
      const glow =
        type === 'spark'
          ? 'rgba(255, 255, 255, 0.65)'
          : 'rgba(255, 255, 255, 0.28)';
      const particle: Particle = {
        position: spawn,
        velocity,
        life,
        maxLife: life,
        size: type === 'spark' ? randomRange(14, 26) : randomRange(5, 11),
        color,
        glow,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: type === 'spark' ? randomRange(-8, 8) : randomRange(-2, 2),
        stretch: type === 'spark' ? randomRange(1.3, 2.8) : randomRange(0.3, 1),
        drag: type === 'spark' ? 0.82 : 0.9,
        type,
      };
      this.particles.push(particle);
    }
  }

  private spawnNovaShards(origin: Vector2, count = 10) {
    const target = { ...this.novaAnchor };
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const offset = randomRange(6, 42);
      const start = {
        x: origin.x + Math.cos(angle) * offset,
        y: origin.y + Math.sin(angle) * offset,
      };
      const launchSpeed = randomRange(110, 220);
      const velocity = {
        x: Math.cos(angle) * launchSpeed,
        y: Math.sin(angle) * launchSpeed - randomRange(70, 160),
      };
      const life = randomRange(0.9, 1.6);
      const shard: Particle = {
        position: start,
        velocity,
        life,
        maxLife: life,
        size: randomRange(18, 26),
        color: '#a0fff0',
        glow: 'rgba(126, 255, 226, 0.95)',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: randomRange(-5, 5),
        stretch: randomRange(0.5, 1.05),
        drag: 0.9,
        type: 'shard',
        target: { ...target },
        attraction: randomRange(240, 360),
      };
      this.particles.push(shard);
    }
  }

  private spawnNovaReadyPulse() {
    this.spawnImpactWave(this.novaAnchor, 220, 0.6, 'rgba(120, 255, 230, 0.82)');
    this.spawnParticles(this.novaAnchor, '#74ffe6', 18, 180, 140);
  }

  private spawnNovaBurst() {
    this.spawnImpactWave(this.novaAnchor, 280, 0.75, 'rgba(136, 255, 236, 0.9)');
    this.spawnImpactWave(this.novaAnchor, 180, 0.55, 'rgba(82, 255, 236, 0.9)');
    this.spawnParticles(this.novaAnchor, '#7effe8', 26, 260, 220);
    this.spawnParticles(this.novaAnchor, '#b2fff6', 14, 160, 140);
  }

  private tryActivateNovaPulse() {
    if (!this.running || this.paused || this.drafting || this.lives <= 0) {
      return;
    }
    if (!this.isNovaPulseReady()) {
      return;
    }
    this.activateNovaPulse();
  }

  private activateNovaPulse() {
    this.spawnNovaBurst();
    this.novaCharge = 0;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const capped = Math.min(enemy.position.y, this.height - this.bottomSafeZone - 80);
      enemy.position.y = Math.max(40, capped - 200);
      enemy.velocity.y = Math.min(enemy.velocity.y, -420);
      enemy.applyKnockback(620);
      enemy.applySlow(3.8, 0.4);
      this.spawnParticles(enemy.position, '#80ffe8', 6, 160, 120);
    }
    this.addScreenShake(9, 0.55);
    this.spawnNovaShards(this.novaAnchor, 14);
    this.updateHud();
  }

  private isNovaPulseReady() {
    return this.novaCharge >= this.novaChargeMax - 0.01;
  }

  private launchOrb(target: Vector2) {
    const drag = subtract(this.cannonPosition, target);
    const power = length(drag);
    if (power < 20 || this.launchCooldown > 0 || this.lives <= 0) {
      return;
    }
    this.spawnParticles(this.cannonPosition, '#38f3ff', 10, 200, 70);
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

  private createDefaultEnemyScaling(): EnemyWaveScaling {
    return {
      level: 0,
      hpMultiplier: 1,
      hpBonus: 0,
      speedMultiplier: 1,
      countMultiplier: 1,
      cadenceMultiplier: 1,
    };
  }

  private seedBackdrop() {
    const starCount = 96;
    this.backgroundStars = Array.from({ length: starCount }, () => ({
      xPercent: Math.random(),
      yPercent: Math.random(),
      radius: randomRange(1.1, 2.6),
      twinkleSpeed: randomRange(0.35, 1.15),
      twinklePhase: Math.random() * Math.PI * 2,
      parallax: randomRange(0.3, 1),
      color:
        Math.random() < 0.35
          ? 'rgba(88, 196, 255, 1)'
          : Math.random() < 0.55
            ? 'rgba(255, 131, 201, 1)'
            : 'rgba(124, 255, 205, 1)',
    }));

    this.backgroundRibbons = [
      {
        offset: 0.28,
        amplitude: 0.08,
        frequency: 2.1,
        speed: 0.32,
        thickness: 90,
        color: 'rgba(57, 116, 255, 0.18)',
        glow: 'rgba(107, 196, 255, 0.45)',
        phase: Math.random() * Math.PI * 2,
      },
      {
        offset: 0.52,
        amplitude: 0.06,
        frequency: 2.8,
        speed: 0.46,
        thickness: 72,
        color: 'rgba(255, 96, 188, 0.14)',
        glow: 'rgba(255, 149, 231, 0.42)',
        phase: Math.random() * Math.PI * 2,
      },
      {
        offset: 0.74,
        amplitude: 0.05,
        frequency: 2.35,
        speed: 0.38,
        thickness: 58,
        color: 'rgba(82, 255, 214, 0.12)',
        glow: 'rgba(140, 255, 223, 0.38)',
        phase: Math.random() * Math.PI * 2,
      },
    ];
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
    this.floatingTexts = [];
    this.impactWaves = [];
    this.screenShakeOffset = { x: 0, y: 0 };
    this.screenShakeTimer = 0;
    this.screenShakeDuration = 0;
    this.screenShakeIntensity = 0;
    this.novaCharge = 0;
    this.availableMajorModifiers = [...MAJOR_MODIFIERS];
    this.modifiers = this.createInitialModifiers();
    this.playerModifierCounts.clear();
    this.drafting = false;
    this.pauseLocked = false;
    this.completedWaves = 0;
    this.enemyScaling = this.createDefaultEnemyScaling();
    this.pauseOverlay.setVisible(false);
    this.syncPlayerModifiersOverlay();
    this.pauseOverlay.setEnemyModifiers([]);
    this.draft.hide();
    this.waveManager.reset();
    this.updateHud();
  }

  private syncPlayerModifiersOverlay() {
    const modifiers: PauseOverlayPlayerModifier[] = [];
    for (const [id, count] of this.playerModifierCounts) {
      modifiers.push({ id, count });
    }
    this.pauseOverlay.setPlayerModifiers(modifiers);
  }

  private updateHud() {
    const heat = Math.floor(this.comboHeat);
    const tier = Math.floor(heat / 5);
    const progress = (this.comboHeat % 5) / 5;
    const specialReady = this.isNovaPulseReady();
    const data: HudData = {
      score: Math.floor(this.score),
      comboHeat: heat,
      comboTier: tier,
      comboProgress: progress,
      focus: this.focus,
      lives: this.lives,
      wave: this.waveManager.waveNumber,
      lastModifier: this.modifiers.lastPicked,
      specialCharge: this.novaCharge,
      specialMax: this.novaChargeMax,
      specialReady,
      specialName: this.novaName,
    };
    this.hud.update(data);
  }

  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(this.screenShakeOffset.x, this.screenShakeOffset.y);

    this.drawBackground(ctx);
    this.drawAim(ctx);

    for (const enemy of this.enemies) {
      enemy.draw(ctx);
    }

    for (const wave of this.impactWaves) {
      const progress = 1 - wave.life / wave.maxLife;
      const alpha = Math.max(0, wave.life / wave.maxLife);
      const radius = wave.maxRadius * progress;
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = 6 * (1 - progress) + 2;
      ctx.strokeStyle = wave.color;
      ctx.beginPath();
      ctx.arc(wave.position.x, wave.position.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    this.drawChainLinks(ctx);

    for (const orb of this.orbs) {
      if (!orb.alive) continue;
      ctx.save();
      ctx.translate(orb.position.x, orb.position.y);
      const speed = length(orb.velocity);
      const momentum = clamp(speed / 1600, 0, 1);
      const heading = Math.atan2(orb.velocity.y, orb.velocity.x);
      const tailLength = orb.radius * (2.2 + momentum * 5.2);
      const tailWidth = orb.radius * (0.8 + momentum * 0.35);

      ctx.rotate(heading);
      const tailGradient = ctx.createLinearGradient(-tailLength, 0, orb.radius * 0.8, 0);
      tailGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      tailGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
      tailGradient.addColorStop(1, orb.color);
      ctx.fillStyle = tailGradient;
      ctx.globalAlpha = 0.45 + momentum * 0.4;
      ctx.shadowColor = orb.color;
      ctx.shadowBlur = 24 + momentum * 30;
      ctx.beginPath();
      ctx.moveTo(-tailLength, -tailWidth * 0.6);
      ctx.quadraticCurveTo(-tailLength * 0.3, 0, -tailLength, tailWidth * 0.6);
      ctx.lineTo(orb.radius, tailWidth);
      ctx.quadraticCurveTo(orb.radius + tailWidth * 0.7, 0, orb.radius, -tailWidth);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1;
      const coreGradient = ctx.createRadialGradient(0, 0, orb.radius * 0.1, 0, 0, orb.radius * 1.05);
      coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      coreGradient.addColorStop(0.4, orb.color);
      coreGradient.addColorStop(1, 'rgba(12, 8, 30, 0.65)');
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 + momentum * 0.45;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.ellipse(orb.radius * 0.15, -orb.radius * 0.2, orb.radius * 0.65, orb.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const particle of this.particles) {
      const ratio = Math.max(0, particle.life / particle.maxLife);
      ctx.save();
      ctx.translate(particle.position.x, particle.position.y);
      if (particle.type === 'spark') {
        ctx.rotate(particle.rotation);
        const length = particle.size * particle.stretch * (0.5 + ratio);
        const width = Math.max(1.2, particle.size * 0.12);
        const gradient = ctx.createLinearGradient(-length, 0, length, 0);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.3, particle.glow);
        gradient.addColorStop(0.55, particle.color);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.globalAlpha = Math.pow(ratio, 0.55);
        ctx.lineWidth = width;
        ctx.strokeStyle = gradient;
        ctx.shadowColor = particle.glow;
        ctx.shadowBlur = 18 * ratio;
        ctx.beginPath();
        ctx.moveTo(-length, 0);
        ctx.lineTo(length, 0);
        ctx.stroke();
      } else if (particle.type === 'ember') {
        const radius = particle.size * (0.6 + particle.stretch * 0.4 * ratio);
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, particle.glow);
        gradient.addColorStop(0.55, particle.color);
        gradient.addColorStop(1, 'rgba(12, 10, 30, 0)');
        ctx.globalAlpha = Math.pow(ratio, 0.7);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.rotate(particle.rotation);
        const length = particle.size * (1.1 + (1 - ratio) * 0.6);
        const width = particle.size * 0.55;
        const gradient = ctx.createLinearGradient(0, -length, 0, length);
        gradient.addColorStop(0, 'rgba(56, 243, 255, 0)');
        gradient.addColorStop(0.45, particle.glow);
        gradient.addColorStop(1, particle.color);
        ctx.globalAlpha = Math.pow(Math.max(ratio, 0.2), 0.8);
        ctx.fillStyle = gradient;
        ctx.shadowColor = particle.glow;
        ctx.shadowBlur = 20 * ratio + 6;
        ctx.beginPath();
        ctx.moveTo(0, -length);
        ctx.lineTo(width, 0);
        ctx.lineTo(0, length);
        ctx.lineTo(-width, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    for (const text of this.floatingTexts) {
      const ratio = Math.max(0, text.life / text.maxLife);
      const scale = 1 + text.pop * (1 - ratio);
      ctx.save();
      ctx.translate(text.position.x, text.position.y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.pow(ratio, 0.7);
      ctx.font = `${text.weight} ${text.size}px Rajdhani, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = text.color;
      if (text.stroke) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = text.stroke;
        ctx.strokeText(text.value, 0, 0);
      }
      ctx.fillText(text.value, 0, 0);
      ctx.restore();
    }

    this.drawCannon(ctx);
    ctx.restore();
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
    ctx.save();
    const base = ctx.createLinearGradient(0, 0, 0, this.height);
    base.addColorStop(0, '#06061b');
    base.addColorStop(0.45, '#07041a');
    base.addColorStop(1, '#100024');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, this.width, this.height);

    const apex = ctx.createLinearGradient(0, 0, 0, this.height);
    apex.addColorStop(0, 'rgba(96, 167, 255, 0.18)');
    apex.addColorStop(0.4, 'rgba(41, 12, 64, 0)');
    apex.addColorStop(1, 'rgba(255, 87, 167, 0.12)');
    ctx.fillStyle = apex;
    ctx.fillRect(0, 0, this.width, this.height);

    const time = this.lastTime * 0.001;
    ctx.lineJoin = 'round';
    for (const ribbon of this.backgroundRibbons) {
      const baseY = this.height * ribbon.offset;
      const amplitude = this.height * ribbon.amplitude * (1 + Math.sin(time * 0.6 + ribbon.phase) * 0.2);
      const frequency = ribbon.frequency;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = ribbon.color;
      ctx.lineWidth = ribbon.thickness;
      ctx.shadowColor = ribbon.glow;
      ctx.shadowBlur = 120;
      ctx.beginPath();
      for (let x = -200; x <= this.width + 200; x += 28) {
        const progress = (x / this.width) * Math.PI * frequency;
        const y = baseY + Math.sin(progress + time * ribbon.speed + ribbon.phase) * amplitude;
        if (x === -200) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const star of this.backgroundStars) {
      const twinkle = (Math.sin(time * star.twinkleSpeed + star.twinklePhase) + 1) * 0.5;
      const x = star.xPercent * this.width - this.screenShakeOffset.x * (1 - star.parallax);
      const yRange = this.height - this.bottomSafeZone * 0.4;
      const y = star.yPercent * yRange - this.screenShakeOffset.y * (1 - star.parallax);
      const radius = star.radius * (0.6 + twinkle * 0.7);
      ctx.globalAlpha = 0.25 + twinkle * 0.65;
      ctx.fillStyle = star.color;
      ctx.shadowColor = star.color;
      ctx.shadowBlur = 14 * (0.3 + twinkle);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(79, 168, 255, 0.08)';
    ctx.lineWidth = 1;
    const gridBottom = this.height - this.bottomSafeZone;
    for (let y = gridBottom; y >= 0; y -= 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    const comboGlow = clamp(this.comboHeat / 18, 0, 1);
    if (comboGlow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.14 + comboGlow * 0.32;
      const pulse = ctx.createRadialGradient(
        this.width / 2,
        this.height - this.bottomSafeZone,
        this.width * 0.1,
        this.width / 2,
        this.height - this.bottomSafeZone,
        this.width * 0.85,
      );
      pulse.addColorStop(0, 'rgba(255, 86, 177, 1)');
      pulse.addColorStop(0.45, 'rgba(255, 124, 92, 0.6)');
      pulse.addColorStop(1, 'rgba(255, 86, 177, 0)');
      ctx.fillStyle = pulse;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
    ctx.restore();
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
