import type { ModifierState, RunModifierDefinition } from './types';

export interface DraftContext {
  lives: number;
  maxLives: number;
}

export type DraftModifier = RunModifierDefinition & {
  unique?: boolean;
  available?(state: ModifierState, context: DraftContext): boolean;
};

const ensureSlow = (state: ModifierState, duration: number, factor: number) => {
  const existing = state.slowEffect;
  if (!existing) {
    state.slowEffect = { duration, factor };
    return;
  }
  state.slowEffect = {
    duration: Math.max(existing.duration, duration),
    factor: Math.min(existing.factor, factor),
  };
};

const ensureExplosion = (state: ModifierState, radius: number, damage: number) => {
  const existing = state.explosion;
  if (!existing) {
    state.explosion = { radius, damage };
    return;
  }
  state.explosion = {
    radius: Math.max(existing.radius, radius),
    damage: Math.max(existing.damage, damage),
  };
};

const ensureChain = (state: ModifierState, range: number, damage: number, interval: number) => {
  const existing = state.chainLightning;
  if (!existing) {
    state.chainLightning = { range, damage, interval, cooldown: 0 };
    return;
  }
  state.chainLightning = {
    range: Math.max(existing.range, range),
    damage: existing.damage + damage,
    interval: Math.min(existing.interval, interval),
    cooldown: existing.cooldown,
  };
};

export const MAJOR_MODIFIERS: DraftModifier[] = [
  {
    id: 'bulwarkCore',
    name: 'Bulwark Core',
    description: 'Puck radius is increased by 25%.',
    rarity: 'common',
    apply(state) {
      const prev = state.orbSizeMultiplier;
      state.orbSizeMultiplier = prev * 1.25;
    },
  },
  {
    id: 'cryoCoating',
    name: 'Cryo Coating',
    description: 'Hits chill targets, slowing them for a moment.',
    rarity: 'common',
    apply(state) {
      ensureSlow(state, 1.4, 0.45);
    },
  },
  {
    id: 'comboDrive',
    name: 'Combo Drive',
    description: 'Damage increases with combo tier (+0.5 per tier).',
    rarity: 'common',
    apply(state) {
      state.comboDamagePerTier += 0.5;
    },
  },
  {
    id: 'repulsorBurst',
    name: 'Repulsor Burst',
    description: 'Striking an enemy knocks it back toward the top.',
    rarity: 'uncommon',
    apply(state) {
      state.knockbackForce = Math.max(state.knockbackForce, 320);
    },
  },
  {
    id: 'seekerFletching',
    name: 'Seeker Fletching',
    description: 'Pucks subtly steer toward the nearest target.',
    rarity: 'uncommon',
    apply(state) {
      state.homingStrength += 220;
    },
  },
  {
    id: 'volatileCore',
    name: 'Volatile Core',
    description: 'Collisions trigger an explosive blast of AOE damage.',
    rarity: 'uncommon',
    apply(state) {
      ensureExplosion(state, 140, 1.2);
    },
  },
  {
    id: 'fractalSplinters',
    name: 'Fractal Splinters',
    description: 'On hit the puck divides into twin projectiles.',
    rarity: 'rare',
    apply(state) {
      state.splitOnImpact = true;
    },
  },
  {
    id: 'stormLattice',
    name: 'Storm Lattice',
    description: 'Pucks link with crackling arcs that scorch nearby foes.',
    rarity: 'rare',
    apply(state) {
      ensureChain(state, 220, 0.5, 0.18);
    },
  },
  {
    id: 'triVolley',
    name: 'Tri-Volley',
    description: 'Launching fires three pucks in a fanning spread.',
    rarity: 'rare',
    apply(state) {
      state.tripleLaunch = true;
    },
  },
];

export const UPGRADE_MODIFIERS: DraftModifier[] = [
  {
    id: 'damageBoost',
    name: 'Damage Amplifier',
    description: '+5% damage.',
    rarity: 'common',
    apply(state) {
      state.damageMultiplier += 0.05;
    },
  },
  {
    id: 'comboHeatDamageBoost',
    name: 'Combo Flux',
    description: '+0.4% damage per Combo Heat.',
    rarity: 'common',
    apply(state) {
      state.comboHeatDamagePercent += 0.004;
    },
  },
  {
    id: 'bounceDamageBoost',
    name: 'Ricochet Matrix',
    description: '+5% damage per wall bounce.',
    rarity: 'common',
    apply(state) {
      state.bounceDamagePercent += 0.05;
    },
  },
  {
    id: 'bossDamageBoost',
    name: 'Predator Lock',
    description: '+10% damage vs bosses & elites.',
    rarity: 'uncommon',
    apply(state) {
      state.bossDamageMultiplier += 0.1;
    },
  },
  {
    id: 'wallHitDamageBoost',
    name: 'Impact Condenser',
    description: '+15% damage after a wall hit (next hit).',
    rarity: 'uncommon',
    apply(state) {
      state.wallHitDamageBonusPercent += 0.15;
    },
  },
  {
    id: 'restoreHeart',
    name: 'Restore Heart',
    description: 'Recover one lost heart.',
    rarity: 'common',
    apply(_state) {},
    available(_state, context) {
      return context.lives < context.maxLives;
    },
  },
  {
    id: 'seekerHomingBoost',
    name: 'Seeker Calibration',
    description: '+15% homing strength if Seeker Fletching is equipped.',
    rarity: 'uncommon',
    apply(state) {
      if (state.homingStrength > 0) {
        state.homingStrength *= 1.15;
      }
    },
    available(state) {
      return state.homingStrength > 0;
    },
  },
];

export const ALL_DRAFT_MODIFIERS: DraftModifier[] = [...MAJOR_MODIFIERS, ...UPGRADE_MODIFIERS];

export const MODIFIER_MAP = new Map(
  ALL_DRAFT_MODIFIERS.map((modifier) => [modifier.id, modifier]),
);
