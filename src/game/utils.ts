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

export const distanceToSegmentSq = (point: Vector2, a: Vector2, b: Vector2) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    return distanceSq(point, a);
  }
  let t = (apx * abx + apy * aby) / abLenSq;
  t = clamp(t, 0, 1);
  const closestX = a.x + abx * t;
  const closestY = a.y + aby * t;
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  return dx * dx + dy * dy;
};

export const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

