import './style.css';
import { Game } from './game/Game';
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from './game/difficulty';
import type { DifficultyDefinition } from './game/types';
import { HUD } from './ui/HUD';
import { IntroMenu } from './ui/IntroMenu';
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
  const introMenu = new IntroMenu(DIFFICULTIES);

  shell.append(
    canvas,
    hud.element,
    hud.toastElement,
    pauseOverlay.element,
    draft.element,
    introMenu.element,
  );
  app.appendChild(shell);

  let currentGame: Game | null = null;
  window.slingpunkGame = undefined;

  const beginRun = (difficulty: DifficultyDefinition) => {
    introMenu.hide();
    if (currentGame) {
      currentGame.dispose();
    }
    currentGame = new Game(canvas, hud, draft, pauseOverlay, difficulty);
    window.slingpunkGame = currentGame;
    currentGame.start();
  };

  hud.onPauseRequested(() => {
    currentGame?.togglePause();
  });

  pauseOverlay.onQuitRequested(() => {
    if (currentGame) {
      currentGame.dispose();
      currentGame = null;
    }
    window.slingpunkGame = undefined;
    hud.setPaused(false);
    introMenu.show();
  });

  introMenu.onStart((difficulty) => {
    beginRun(difficulty);
  });

  introMenu.selectDifficulty(DEFAULT_DIFFICULTY.id);
}

document.addEventListener('DOMContentLoaded', bootstrap);
