import type { DifficultyDefinition } from '../game/types';

export class IntroMenu {
  public readonly element: HTMLDivElement;

  private readonly startButton: HTMLButtonElement;
  private readonly cardLookup = new Map<string, HTMLButtonElement>();
  private readonly difficulties: DifficultyDefinition[];

  private startHandler?: (difficulty: DifficultyDefinition) => void;
  private selectedId?: string;

  constructor(difficulties: DifficultyDefinition[]) {
    this.difficulties = difficulties;
    this.element = document.createElement('div');
    this.element.className = 'intro-menu visible';
    this.element.setAttribute('aria-hidden', 'false');

    const panel = document.createElement('div');
    panel.className = 'intro-menu__panel';

    const heading = document.createElement('div');
    heading.className = 'intro-menu__heading';

    const title = document.createElement('h1');
    title.textContent = 'Slingpunk Deployment';
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Configure your run parameters before launching the next operation.';
    heading.append(title, subtitle);

    const grid = document.createElement('div');
    grid.className = 'intro-menu__grid';

    for (const difficulty of difficulties) {
      const card = this.createDifficultyCard(difficulty);
      grid.appendChild(card);
      this.cardLookup.set(difficulty.id, card);
    }

    this.startButton = document.createElement('button');
    this.startButton.type = 'button';
    this.startButton.className = 'intro-menu__start';
    this.startButton.textContent = 'Launch Run';
    this.startButton.disabled = true;
    this.startButton.addEventListener('click', () => {
      if (!this.selectedId) return;
      const difficulty = this.difficulties.find((entry) => entry.id === this.selectedId);
      if (!difficulty) return;
      this.startHandler?.(difficulty);
    });

    panel.append(heading, grid, this.startButton);
    this.element.append(panel);

    const defaultDifficulty =
      difficulties.find((entry) => entry.isDefault) ?? difficulties[0];
    if (defaultDifficulty) {
      this.setSelected(defaultDifficulty.id);
    }
  }

  onStart(handler: (difficulty: DifficultyDefinition) => void) {
    this.startHandler = handler;
  }

  show() {
    this.element.classList.add('visible');
    this.element.setAttribute('aria-hidden', 'false');
    this.setInteractivity(true);
    if (this.selectedId) {
      this.cardLookup.get(this.selectedId)?.focus();
    } else {
      this.startButton.focus();
    }
  }

  hide() {
    this.element.classList.remove('visible');
    this.element.setAttribute('aria-hidden', 'true');
    this.setInteractivity(false);
  }

  selectDifficulty(id: string) {
    this.setSelected(id);
  }

  private setSelected(id: string) {
    if (this.selectedId === id) return;
    if (this.selectedId) {
      const previous = this.cardLookup.get(this.selectedId);
      previous?.classList.remove('selected');
      previous?.setAttribute('aria-pressed', 'false');
    }

    const next = this.cardLookup.get(id);
    if (!next) {
      this.selectedId = undefined;
      this.refreshStartButton();
      return;
    }

    this.selectedId = id;
    next.classList.add('selected');
    next.setAttribute('aria-pressed', 'true');
    this.refreshStartButton();
  }

  private refreshStartButton() {
    if (!this.selectedId) {
      this.startButton.disabled = true;
      this.startButton.textContent = 'Launch Run';
      return;
    }

    const difficulty = this.difficulties.find(
      (entry) => entry.id === this.selectedId,
    );
    this.startButton.disabled = false;
    this.startButton.textContent = `Launch ${difficulty?.name ?? 'Run'}`;
  }

  private setInteractivity(isEnabled: boolean) {
    for (const card of this.cardLookup.values()) {
      card.disabled = !isEnabled;
    }

    if (isEnabled) {
      this.refreshStartButton();
      return;
    }

    this.startButton.disabled = true;
  }

  private createDifficultyCard(difficulty: DifficultyDefinition) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'intro-menu__card';
    button.dataset.difficulty = difficulty.id;
    button.dataset.name = difficulty.name;
    button.setAttribute('aria-pressed', 'false');

    const header = document.createElement('div');
    header.className = 'intro-menu__card-header';

    const title = document.createElement('h2');
    title.textContent = difficulty.name;

    const tagline = document.createElement('span');
    tagline.className = 'intro-menu__tagline';
    tagline.textContent = difficulty.tagline;

    header.append(title, tagline);

    const description = document.createElement('p');
    description.textContent = difficulty.description;

    const modifiers = document.createElement('ul');
    modifiers.className = 'intro-menu__modifiers';

    const damageItem = document.createElement('li');
    damageItem.textContent = this.describeMultiplier(
      difficulty.playerDamageMultiplier,
      'Player damage',
    );
    const hpItem = document.createElement('li');
    hpItem.textContent = this.describeMultiplier(difficulty.enemyHpMultiplier, 'Enemy HP');

    modifiers.append(damageItem, hpItem);

    button.append(header, description, modifiers);

    button.addEventListener('click', () => {
      this.setSelected(difficulty.id);
    });

    button.addEventListener('dblclick', () => {
      this.setSelected(difficulty.id);
      this.startHandler?.(difficulty);
    });

    return button;
  }

  private describeMultiplier(multiplier: number, label: string) {
    const percentage = Math.round((multiplier - 1) * 100);
    const sign = percentage > 0 ? '+' : '';
    return `${label}: ${sign}${percentage}%`;
  }
}
