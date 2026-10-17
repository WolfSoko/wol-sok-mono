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

  constructor(private readonly page: Page) {
    this.mainTitle = page.locator('h1');
    this.playArea = page.locator('.stage canvas');
    this.playCta = page.getByRole('button', { name: 'Start' });
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
    this.joysticks = page.locator('feat-lazy-bac-game-joystick');
    this.leaveFullscreenCta = page.getByRole('button', {
      name: 'Leave fullscreen',
    });
    this.intro = page.locator('mat-card-header');
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

  /** The joystick zone of a seat: 0 along the near edge, 1 along the far one. */
  public joystick(seat: number): Locator {
    return this.joysticks.nth(seat);
  }

  /** The seat's boost button. */
  public boostOf(seat: number): Locator {
    return this.page.locator('.seat-boost').nth(seat).getByRole('button');
  }

  /**
   * Pushes a seat's joystick with a finger: touches down in the middle of
   * the zone, drags by the offset and stays there until {@link release}.
   */
  public async push(seat: number, dx: number, dy: number): Promise<void> {
    const box = await this.joystick(seat).boundingBox();
    if (box == null) {
      throw new Error(`joystick ${seat} has no layout`);
    }
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
