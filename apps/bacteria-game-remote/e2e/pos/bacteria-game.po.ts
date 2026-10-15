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

  constructor(private readonly page: Page) {
    this.mainTitle = page.locator('h1');
    this.playArea = page.locator('.canvas-container canvas');
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
}
