import type { Game } from '../Game';
import type { PowerUpType, Vector2 } from '../types';

const colors: Record<PowerUpType, string> = {
  lightning: '#76a9ff',
  shield: '#66ffd0',
  multiball: '#ffc43c',
  timewarp: '#a3a7ff',
  ricochet: '#ff6ef2',
  pierce: '#faff7a',
};

export class PowerUp {
  public readonly type: PowerUpType;
  public position: Vector2;
  public velocity: Vector2;
  public radius: number;
  public alive = true;
  private pulse = Math.random() * Math.PI * 2;

  constructor(type: PowerUpType, position: Vector2) {
    this.type = type;
    this.position = { ...position };
    this.velocity = { x: 0, y: 40 };
    this.radius = 18;
  }

  update(dt: number, game: Game) {
    this.pulse += dt * 4;
    this.velocity.y = 40 + Math.sin(this.pulse) * 10;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    if (this.position.y > game.height + 80) {
      this.alive = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const glow = (Math.sin(this.pulse) + 1) * 0.5;
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + glow * 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + glow * 0.2})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = colors[this.type];
    ctx.shadowColor = colors[this.type];
    ctx.shadowBlur = 20 + glow * 20;
    ctx.fill();

    ctx.fillStyle = '#09031a';
    ctx.font = 'bold 16px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.getGlyph(), 0, 1);

    ctx.restore();
  }

  private getGlyph() {
    switch (this.type) {
      case 'lightning':
        return '⚡';
      case 'shield':
        return '🛡️';
      case 'multiball':
        return '✳️';
      case 'timewarp':
        return '⏱️';
      case 'ricochet':
        return '🌀';
      case 'pierce':
        return '🎯';
    }
  }
}
