import type { RunModifierDefinition } from '../game/types';

export class PowerDraftOverlay {
  public readonly element: HTMLDivElement;
  private readonly optionsGrid: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private resolve?: (choice: RunModifierDefinition) => void;
  private active = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'power-draft';

    this.title = document.createElement('h2');
    this.title.textContent = 'Choose your upgrade';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Select one of the three experimental puck mods.';

    this.optionsGrid = document.createElement('div');
    this.optionsGrid.className = 'power-draft__grid';

    this.element.append(this.title, subtitle, this.optionsGrid);
    this.hide();
  }

  async present(options: RunModifierDefinition[]): Promise<RunModifierDefinition> {
    if (this.active) {
      throw new Error('Power draft already active');
    }
    this.active = true;
    this.optionsGrid.replaceChildren();

    return new Promise<RunModifierDefinition>((resolve) => {
      this.resolve = resolve;
      for (const option of options) {
        this.optionsGrid.appendChild(this.createOptionCard(option));
      }
      this.show();
    });
  }

  hide() {
    this.element.classList.remove('visible');
    this.element.style.pointerEvents = 'none';
  }

  private show() {
    this.element.classList.add('visible');
    this.element.style.pointerEvents = 'auto';
  }

  private createOptionCard(option: RunModifierDefinition) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `draft-card rarity-${option.rarity}`;

    const rarity = document.createElement('span');
    rarity.className = 'draft-card__rarity';
    rarity.innerText = option.rarity.toUpperCase();

    const name = document.createElement('h3');
    name.textContent = option.name;

    const description = document.createElement('p');
    description.textContent = option.description;

    button.append(rarity, name, description);
    button.addEventListener('click', () => this.finish(option));

    return button;
  }

  private finish(option: RunModifierDefinition) {
    if (!this.active) return;
    this.active = false;
    this.hide();
    const resolver = this.resolve;
    this.resolve = undefined;
    resolver?.(option);
  }
}
