import './style.css';
import { Game } from './game/Game';
import { HUD } from './ui/HUD';
import { PauseOverlay } from './ui/PauseOverlay';
import { PowerDraftOverlay } from './ui/PowerDraftOverlay';

declare global {
  interface Window {
    slingpunkGame?: Game;
  }
}

function bootstrap() {
  const app = document.getElementById('app');
  if (!app) {
    throw new Error('App container missing');
  }

  const shell = document.createElement('div');
  shell.className = 'game-shell';

  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  canvas.width = 720;
  canvas.height = 1280;

  const hud = new HUD();
  const draft = new PowerDraftOverlay();
  const pauseOverlay = new PauseOverlay();

  shell.append(canvas, hud.element, hud.toastElement, pauseOverlay.element, draft.element);
  app.appendChild(shell);

  const game = new Game(canvas, hud, draft, pauseOverlay);
  window.slingpunkGame = game;

  hud.onPauseRequested(() => {
    game.togglePause();
  });

  game.start();
}

document.addEventListener('DOMContentLoaded', bootstrap);
