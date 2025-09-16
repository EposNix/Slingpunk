import type { DraftModifier } from '../game/modifiers';

export class PowerDraftOverlay {
  public readonly element: HTMLDivElement;
  private readonly optionsGrid: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly subtitle: HTMLParagraphElement;
  private resolve?: (choice: DraftModifier) => void;
  private active = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'power-draft';

    this.title = document.createElement('h2');
    this.title.textContent = 'Choose your upgrade';

    this.subtitle = document.createElement('p');
    this.subtitle.textContent = 'Select one of the three experimental puck mods.';

    this.optionsGrid = document.createElement('div');
    this.optionsGrid.className = 'power-draft__grid';

    this.element.append(this.title, this.subtitle, this.optionsGrid);
    this.hide();
  }

  async present(
    options: DraftModifier[],
    config?: { title?: string; subtitle?: string },
  ): Promise<DraftModifier> {
    if (this.active) {
      throw new Error('Power draft already active');
    }
    this.active = true;
    this.optionsGrid.replaceChildren();
    this.title.textContent = config?.title ?? 'Choose your upgrade';
    this.subtitle.textContent =
      config?.subtitle ?? 'Select one of the three experimental puck mods.';

    return new Promise<DraftModifier>((resolve) => {
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

  private createOptionCard(option: DraftModifier) {
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

  private finish(option: DraftModifier) {
    if (!this.active) return;
    this.active = false;
    this.hide();
    const resolver = this.resolve;
    this.resolve = undefined;
    resolver?.(option);
  }
}
