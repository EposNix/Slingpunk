import type { HudData, PowerUpType } from '../game/types';

const powerUpLabels: Record<PowerUpType, string> = {
  lightning: 'Lightning',
  shield: 'Shield Bubble',
  multiball: 'Multiball',
  timewarp: 'Time Warp',
  ricochet: 'Ricochet Rune',
  pierce: 'Pierce Core',
};

export class HUD {
  public readonly element: HTMLDivElement;
  public readonly toastElement: HTMLDivElement;
  private readonly scoreValue: HTMLSpanElement;
  private readonly comboValue: HTMLSpanElement;
  private readonly comboFill: HTMLDivElement;
  private readonly focusFill: HTMLDivElement;
  private readonly heartsValue: HTMLSpanElement;
  private readonly waveValue: HTMLSpanElement;
  private readonly powerupValue: HTMLSpanElement;
  private readonly pauseButton: HTMLButtonElement;

  private pauseHandler?: () => void;
  private toastTimeout?: number;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'hud-layer';

    const top = document.createElement('div');
    top.className = 'hud-top';
    const bottom = document.createElement('div');
    bottom.className = 'hud-bottom';

    const scoreMetric = this.createMetric('Score');
    this.scoreValue = scoreMetric.value;

    const comboMetric = this.createMetric('Combo Heat');
    this.comboValue = comboMetric.value;
    const comboBar = document.createElement('div');
    comboBar.className = 'combo-bar';
    this.comboFill = document.createElement('div');
    comboBar.appendChild(this.comboFill);
    comboMetric.root.appendChild(comboBar);

    const heartsMetric = this.createMetric('Hearts');
    this.heartsValue = heartsMetric.value;

    const waveMetric = this.createMetric('Wave');
    this.waveValue = waveMetric.value;

    const focusMetric = this.createMetric('Focus');
    const focusBar = document.createElement('div');
    focusBar.className = 'focus-bar';
    this.focusFill = document.createElement('div');
    focusBar.appendChild(this.focusFill);
    focusMetric.root.appendChild(focusBar);

    const powerupMetric = this.createMetric('Power-up');
    this.powerupValue = powerupMetric.value;
    this.powerupValue.innerText = 'None';

    const leftStack = document.createElement('div');
    leftStack.style.display = 'flex';
    leftStack.style.flexDirection = 'column';
    leftStack.style.gap = '0.5rem';
    leftStack.append(scoreMetric.root, comboMetric.root);

    const rightStack = document.createElement('div');
    rightStack.style.display = 'flex';
    rightStack.style.flexDirection = 'column';
    rightStack.style.alignItems = 'flex-end';
    rightStack.style.gap = '0.5rem';
    rightStack.append(heartsMetric.root, waveMetric.root);

    this.pauseButton = document.createElement('button');
    this.pauseButton.className = 'pause-button';
    this.pauseButton.type = 'button';
    this.pauseButton.textContent = 'Pause';
    this.pauseButton.addEventListener('click', () => {
      this.pauseHandler?.();
    });

    const controlHint = document.createElement('div');
    controlHint.className = 'pill control-hint';
    controlHint.innerHTML =
      '<span>Drag</span> Aim · <span>Release</span> Fire · <span>Swipe</span> Aftertouch';

    const focusWrapper = document.createElement('div');
    focusWrapper.className = 'pill';
    focusWrapper.style.display = 'flex';
    focusWrapper.style.flexDirection = 'column';
    focusWrapper.style.gap = '0.25rem';
    focusWrapper.append(focusMetric.root, powerupMetric.root);

    top.append(leftStack, this.pauseButton, rightStack);
    bottom.append(controlHint, focusWrapper);

    this.element.append(top, bottom);

    this.toastElement = document.createElement('div');
    this.toastElement.className = 'toast';
    this.toastElement.textContent = '';
  }

  onPauseRequested(handler: () => void) {
    this.pauseHandler = handler;
  }

  update(data: HudData) {
    this.scoreValue.innerText = data.score.toLocaleString();
    this.comboValue.innerText = `${data.comboHeat.toFixed(0)} (x${data.comboTier + 1})`;
    this.comboFill.style.width = `${Math.min(1, Math.max(0, data.comboProgress)) * 100}%`;
    this.focusFill.style.width = `${Math.min(100, Math.max(0, data.focus))}%`;
    this.heartsValue.innerText = '❤️'.repeat(Math.max(0, data.lives)) || '💀';
    this.waveValue.innerText = `S${data.wave}`;
    if (data.powerUp) {
      this.powerupValue.innerText = powerUpLabels[data.powerUp];
    } else {
      this.powerupValue.innerText = 'None';
    }
  }

  setPaused(paused: boolean) {
    this.pauseButton.textContent = paused ? 'Resume' : 'Pause';
  }

  showToast(message: string, duration = 1500) {
    this.toastElement.textContent = message;
    this.toastElement.classList.add('visible');
    if (this.toastTimeout) {
      window.clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = window.setTimeout(() => {
      this.toastElement.classList.remove('visible');
    }, duration);
  }

  private createMetric(label: string) {
    const root = document.createElement('div');
    root.className = 'pill metric';
    const labelEl = document.createElement('span');
    labelEl.className = 'metric-label';
    labelEl.innerText = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'metric-value';
    valueEl.innerText = '0';
    root.append(labelEl, valueEl);
    return { root, value: valueEl };
  }
}
