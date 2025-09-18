import type { HudData, RunModifierId } from '../game/types';
import { ALL_DRAFT_MODIFIERS } from '../game/modifiers';

const modifierLabels: Record<RunModifierId, string> = Object.fromEntries(
  ALL_DRAFT_MODIFIERS.map((mod) => [mod.id, mod.name]),
) as Record<RunModifierId, string>;

export class HUD {
  public readonly element: HTMLDivElement;
  public readonly toastElement: HTMLDivElement;
  private readonly scoreValue: HTMLSpanElement;
  private readonly comboValue: HTMLSpanElement;
  private readonly comboFill: HTMLDivElement;
  private readonly focusFill: HTMLDivElement;
  private readonly focusValue: HTMLSpanElement;
  private readonly heartsValue: HTMLSpanElement;
  private readonly waveValue: HTMLSpanElement;
  private readonly modifierValue: HTMLSpanElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly specialButton: HTMLButtonElement;
  private readonly specialPercent: HTMLSpanElement;
  private readonly specialName: HTMLSpanElement;
  private specialCircle!: SVGCircleElement;
  private specialCircumference = 1;

  private pauseHandler?: () => void;
  private specialHandler?: () => void;
  private toastTimeout?: number;
  private specialReady = false;

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
    focusMetric.root.classList.add('focus-widget__core');
    this.focusValue = focusMetric.value;
    const focusBar = document.createElement('div');
    focusBar.className = 'focus-bar';
    this.focusFill = document.createElement('div');
    focusBar.appendChild(this.focusFill);
    focusMetric.root.appendChild(focusBar);

    const specialStatus = document.createElement('div');
    specialStatus.className = 'focus-widget__status';
    this.specialName = document.createElement('span');
    this.specialName.className = 'focus-widget__name';
    this.specialName.innerText = 'Nova Pulse';
    this.specialPercent = document.createElement('span');
    this.specialPercent.className = 'focus-widget__value';
    this.specialPercent.innerText = '0%';
    specialStatus.append(this.specialName, this.specialPercent);
    focusMetric.root.appendChild(specialStatus);

    const powerupMetric = this.createMetric('Loadout');
    powerupMetric.root.classList.add('focus-wrapper__loadout');
    this.modifierValue = powerupMetric.value;
    this.modifierValue.innerText = 'None yet';

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

    this.specialButton = document.createElement('button');
    this.specialButton.className = 'focus-widget';
    this.specialButton.type = 'button';
    this.specialButton.append(this.createSpecialRing(), focusMetric.root);
    this.specialButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.specialReady) {
        this.specialHandler?.();
      }
    });

    const focusWrapper = document.createElement('div');
    focusWrapper.className = 'focus-wrapper';
    focusWrapper.append(this.specialButton, powerupMetric.root);

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

  onSpecialRequested(handler: () => void) {
    this.specialHandler = handler;
  }

  update(data: HudData) {
    this.scoreValue.innerText = data.score.toLocaleString();
    this.comboValue.innerText = `${data.comboHeat.toFixed(0)} (x${data.comboTier + 1})`;
    this.comboFill.style.width = `${Math.min(1, Math.max(0, data.comboProgress)) * 100}%`;
    const clampedFocus = Math.min(100, Math.max(0, data.focus));
    this.focusFill.style.width = `${clampedFocus}%`;
    this.focusValue.innerText = `${Math.round(clampedFocus)}%`;
    this.heartsValue.innerText = '❤️'.repeat(Math.max(0, data.lives)) || '💀';
    this.waveValue.innerText = `S${data.wave}`;
    if (data.lastModifier) {
      this.modifierValue.innerText = modifierLabels[data.lastModifier];
    } else {
      this.modifierValue.innerText = 'None yet';
    }

    this.specialName.innerText = data.specialName;
    const max = Math.max(1, data.specialMax);
    const ratio = Math.min(1, Math.max(0, data.specialCharge / max));
    const offset = this.specialCircumference * (1 - ratio);
    this.specialCircle.style.strokeDashoffset = `${offset}`;
    this.specialReady = data.specialReady;
    this.specialButton.classList.toggle('is-ready', data.specialReady);
    this.specialPercent.innerText = data.specialReady
      ? 'Ready!'
      : `${Math.round(ratio * 100)}%`;
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

  private createSpecialRing() {
    const size = 200;
    const radius = 90;
    const center = size / 2;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.classList.add('focus-widget__ring');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradientId = `nova-gradient-${Math.random().toString(36).slice(2)}`;
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');
    const stopA = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopA.setAttribute('offset', '0%');
    stopA.setAttribute('stop-color', '#38f3ff');
    stopA.setAttribute('stop-opacity', '0.95');
    const stopB = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stopB.setAttribute('offset', '100%');
    stopB.setAttribute('stop-color', '#7effc3');
    stopB.setAttribute('stop-opacity', '0.95');
    gradient.append(stopA, stopB);
    defs.appendChild(gradient);
    svg.appendChild(defs);

    const base = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    base.setAttribute('cx', `${center}`);
    base.setAttribute('cy', `${center}`);
    base.setAttribute('r', `${radius}`);
    base.setAttribute('class', 'focus-widget__ring-bg');
    svg.appendChild(base);

    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fill.setAttribute('cx', `${center}`);
    fill.setAttribute('cy', `${center}`);
    fill.setAttribute('r', `${radius}`);
    fill.setAttribute('class', 'focus-widget__ring-fill');
    fill.setAttribute('stroke', `url(#${gradientId})`);
    fill.setAttribute('stroke-dashoffset', '0');
    svg.appendChild(fill);

    this.specialCircle = fill;
    this.specialCircumference = 2 * Math.PI * radius;
    this.specialCircle.style.strokeDasharray = `${this.specialCircumference}`;
    this.specialCircle.style.strokeDashoffset = `${this.specialCircumference}`;

    return svg;
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
