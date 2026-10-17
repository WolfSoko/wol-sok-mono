import { Locator, Page } from '@playwright/test';

/** The bacteria game page: the arena, its controls and the match setup. */
export class BacteriaGamePo {
  public readonly mainTitle: Locator;
  public readonly playArea: Locator;
  public readonly playCta: Locator;
  public readonly resetCta: Locator;
  public readonly levelSelect: Locator;
  public readonly levelDescription: Locator;
  public readonly fullscreenCta: Locator;
  public readonly modePicker: Locator;
  public readonly difficultySelect: Locator;
  public readonly difficultyDescription: Locator;
  public readonly boostCta: Locator;
  public readonly colonyNames: Locator;
  /** The stage that fills the screen, with a seat per player. */
  public readonly stage: Locator;
  public readonly joysticks: Locator;
  public readonly leaveFullscreenCta: Locator;
  public readonly intro: Locator;
  public readonly settingsCta: Locator;
  public readonly helpCta: Locator;
  public readonly backCta: Locator;
  public readonly pauseCta: Locator;
  public readonly resumeCta: Locator;
  public readonly quitCta: Locator;
  public readonly menuTitle: Locator;

  constructor(private readonly page: Page) {
    this.mainTitle = page.locator('h1');
    this.playArea = page.locator('.stage canvas');
    this.playCta = page.getByRole('button', { name: 'Play', exact: true });
    this.resetCta = page.getByRole('button', { name: 'Reset' });
    this.levelSelect = page.locator('.level-select');
    this.levelDescription = page.locator('.level-description');
    this.fullscreenCta = page.getByRole('button', { name: /fullscreen/i });
    this.modePicker = page.locator('.mode-picker');
    this.difficultySelect = page.locator('.difficulty-select');
    this.difficultyDescription = page.locator('.difficulty-description');
    this.boostCta = page.getByRole('button', { name: /^Boost/ });
    this.colonyNames = page.locator('.colony-name');
    this.stage = page.locator('.stage.fullscreen');
    this.joysticks = page.getByLabel(/^Joystick /);
    this.leaveFullscreenCta = page.getByRole('button', {
      name: 'Back to the page',
    });
    this.intro = page.locator('mat-card-header');
    this.settingsCta = page.getByRole('button', { name: 'Settings' });
    this.helpCta = page.getByRole('button', { name: 'How to play' });
    this.backCta = page.getByRole('button', { name: 'Back', exact: true });
    this.pauseCta = page.getByRole('button', { name: 'Pause', exact: true });
    this.resumeCta = page.getByRole('button', { name: 'Resume' });
    this.quitCta = page.getByRole('button', { name: 'Quit to menu' });
    this.menuTitle = page.locator('.menu-title');
  }

  public async goto(): Promise<void> {
    await this.page.goto('/');
  }

  public async chooseLevel(name: RegExp): Promise<void> {
    await this.levelSelect.click();
    await this.page.getByRole('option', { name }).click();
  }

  /** The toggles are a radio group, so the options have the radio role. */
  public async chooseMode(name: RegExp): Promise<void> {
    await this.modePicker.getByRole('radio', { name }).click();
  }

  public async chooseDifficulty(name: RegExp): Promise<void> {
    await this.difficultySelect.click();
    await this.page.getByRole('option', { name }).click();
  }

  public async pressBoostKey(key: 'Space' | 'Enter'): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /** The joystick zone of a seat: 0 at the left edge, 1 at the right one. */
  public joystick(seat: number): Locator {
    return this.joysticks.nth(seat);
  }

  /** The stick itself, shown under the finger while a zone is held. */
  public heldStick(seat: number): Locator {
    return this.joystick(seat).locator('.base:not(.idle)');
  }

  /** The seat's boost button. */
  public boostOf(seat: number): Locator {
    return this.page
      .locator('feat-lazy-bac-game-boost-pad')
      .nth(seat)
      .getByRole('button');
  }

  /** Where an element is on the screen; it must have a layout. */
  public async boxOf(
    locator: Locator
  ): Promise<{ x: number; y: number; width: number; height: number }> {
    const box = await locator.boundingBox();
    if (box == null) {
      throw new Error('the element has no layout yet');
    }
    return box;
  }

  /**
   * Pushes a seat's joystick with a finger: touches down in the middle of
   * the zone, drags by the offset and stays there until {@link release}.
   */
  public async push(seat: number, dx: number, dy: number): Promise<void> {
    const box = await this.boxOf(this.joystick(seat));
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.mouse.move(x + dx, y + dy, { steps: 5 });
  }

  public async release(): Promise<void> {
    await this.page.mouse.up();
  }
}
