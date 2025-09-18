import type { EnemyModifierSummary, ModifierRarity, RunModifierId } from '../game/types';
import { ALL_DRAFT_MODIFIERS } from '../game/modifiers';

const modifierLookup = new Map(
  ALL_DRAFT_MODIFIERS.map((modifier) => [modifier.id, modifier]),
);

export interface PauseOverlayPlayerModifier {
  id: RunModifierId;
  count: number;
}

export class PauseOverlay {
  public readonly element: HTMLDivElement;

  private readonly playerList: HTMLDivElement;
  private readonly playerEmpty: HTMLParagraphElement;
  private readonly enemyList: HTMLDivElement;
  private readonly enemyEmpty: HTMLParagraphElement;
  private readonly resumeButton: HTMLButtonElement;
  private readonly quitButton: HTMLButtonElement;
  private resumeHandler?: () => void;
  private quitHandler?: () => void;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'pause-overlay';
    this.element.setAttribute('aria-hidden', 'true');
    this.element.addEventListener('click', (event) => {
      if (event.target === this.element) {
        this.resumeHandler?.();
      }
    });

    const panel = document.createElement('div');
    panel.className = 'pause-overlay__panel';

    const heading = document.createElement('div');
    heading.className = 'pause-overlay__heading';

    const title = document.createElement('h2');
    title.textContent = 'Run Paused';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Review your loadout and current threats before resuming.';

    heading.append(title, subtitle);

    const content = document.createElement('div');
    content.className = 'pause-overlay__content';

    const playerSection = this.createSection(
      'Loadout Modifiers',
      'Collect upgrades during your run to expand your arsenal.',
    );
    this.playerList = playerSection.list;
    this.playerEmpty = playerSection.empty;

    const enemySection = this.createSection(
      'Enemy Mutations',
      'No enemy modifiers are active this wave.',
    );
    this.enemyList = enemySection.list;
    this.enemyEmpty = enemySection.empty;

    content.append(playerSection.section, enemySection.section);

    const actions = document.createElement('div');
    actions.className = 'pause-overlay__actions';

    this.resumeButton = document.createElement('button');
    this.resumeButton.type = 'button';
    this.resumeButton.className = 'pause-overlay__resume';
    this.resumeButton.textContent = 'Resume Run';
    this.resumeButton.addEventListener('click', () => {
      this.resumeHandler?.();
    });

    this.quitButton = document.createElement('button');
    this.quitButton.type = 'button';
    this.quitButton.className = 'pause-overlay__quit';
    this.quitButton.textContent = 'Quit to Menu';
    this.quitButton.addEventListener('click', () => {
      this.quitHandler?.();
    });

    const hint = document.createElement('p');
    hint.className = 'pause-overlay__hint';
    hint.textContent = 'Tap outside or choose an action below.';

    actions.append(this.resumeButton, this.quitButton, hint);

    panel.append(heading, content, actions);
    this.element.append(panel);

    this.setPlayerModifiers([]);
    this.setEnemyModifiers([]);
  }

  setVisible(visible: boolean) {
    this.element.classList.toggle('visible', visible);
    this.element.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) {
      this.resumeButton.focus({ preventScroll: true });
    } else {
      if (this.element.contains(document.activeElement)) {
        (document.activeElement as HTMLElement).blur();
      }
      this.resumeButton.blur();
      this.quitButton.blur();
    }
  }

  onResumeRequested(handler: () => void) {
    this.resumeHandler = handler;
  }

  onQuitRequested(handler: () => void) {
    this.quitHandler = handler;
  }

  setPlayerModifiers(modifiers: PauseOverlayPlayerModifier[]) {
    const fragment = document.createDocumentFragment();

    const entries = modifiers
      .map((modifier) => {
        const definition = modifierLookup.get(modifier.id);
        if (!definition) return null;
        return { definition, count: modifier.count };
      })
      .filter((entry): entry is { definition: (typeof ALL_DRAFT_MODIFIERS)[number]; count: number } =>
        entry !== null,
      )
      .sort((a, b) => a.definition.name.localeCompare(b.definition.name));

    for (const entry of entries) {
      fragment.appendChild(
        this.createPlayerCard(
          entry.definition.name,
          entry.definition.description,
          entry.definition.rarity,
          entry.count,
        ),
      );
    }

    this.playerList.replaceChildren(fragment);
    const hasEntries = entries.length > 0;
    this.playerList.hidden = !hasEntries;
    this.playerEmpty.hidden = hasEntries;
  }

  setEnemyModifiers(modifiers: EnemyModifierSummary[]) {
    const fragment = document.createDocumentFragment();

    for (const modifier of modifiers) {
      fragment.appendChild(this.createEnemyCard(modifier.name, modifier.description));
    }

    this.enemyList.replaceChildren(fragment);
    const hasEntries = modifiers.length > 0;
    this.enemyList.hidden = !hasEntries;
    this.enemyEmpty.hidden = hasEntries;
  }

  private createSection(title: string, emptyMessage: string) {
    const section = document.createElement('section');
    section.className = 'pause-overlay__section';

    const heading = document.createElement('h3');
    heading.textContent = title;

    const list = document.createElement('div');
    list.className = 'pause-overlay__list';

    const empty = document.createElement('p');
    empty.className = 'pause-overlay__empty';
    empty.textContent = emptyMessage;

    section.append(heading, list, empty);

    return { section, list, empty };
  }

  private createPlayerCard(
    name: string,
    description: string,
    rarity: ModifierRarity,
    count: number,
  ): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'pause-overlay__card pause-overlay__card--player';
    card.dataset.rarity = rarity;

    const header = document.createElement('div');
    header.className = 'pause-overlay__card-header';

    const title = document.createElement('h4');
    title.textContent = name;

    header.appendChild(title);

    if (count > 1) {
      const countBadge = document.createElement('span');
      countBadge.className = 'pause-overlay__count';
      countBadge.textContent = `×${count}`;
      header.appendChild(countBadge);
    }

    const rarityLabel = document.createElement('span');
    rarityLabel.className = `pause-overlay__tag rarity-${rarity}`;
    rarityLabel.textContent = rarity.toUpperCase();

    const body = document.createElement('p');
    body.textContent = description;

    card.append(header, rarityLabel, body);

    return card;
  }

  private createEnemyCard(name: string, description: string): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'pause-overlay__card pause-overlay__card--enemy';

    const title = document.createElement('h4');
    title.textContent = name;

    const body = document.createElement('p');
    body.textContent = description;

    card.append(title, body);

    return card;
  }
}
