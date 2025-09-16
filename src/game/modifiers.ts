import type { ModifierState, RunModifierDefinition } from './types';

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

export const ALL_MODIFIERS: RunModifierDefinition[] = [
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

export const MODIFIER_MAP = new Map(ALL_MODIFIERS.map((modifier) => [modifier.id, modifier]));
