import type { Vector2 } from './types';

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const length = (v: Vector2) => Math.hypot(v.x, v.y);

export const normalize = (v: Vector2): Vector2 => {
  const len = length(v) || 1;
  return { x: v.x / len, y: v.y / len };
};

export const scale = (v: Vector2, scalar: number): Vector2 => ({
  x: v.x * scalar,
  y: v.y * scalar,
});

export const add = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y });

export const subtract = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x - b.x, y: a.y - b.y });

export const distanceSq = (a: Vector2, b: Vector2) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const randomChoice = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export function formatPowerUpName(name?: string) {
  if (!name) return 'None';
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
