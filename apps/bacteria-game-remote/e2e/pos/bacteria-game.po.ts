import { Locator, Page } from '@playwright/test';

/** The bacteria game page: the arena, its controls and the match setup. */
export class BacteriaGamePo {
  public readonly playArea: Locator;
  public readonly playCta: Locator;
  public readonly startCta: Locator;
  public readonly profileCta: Locator;
  public readonly friendsCta: Locator;
  /** The last step of a new game: the briefing, the opponent, Start. */
  public readonly startStep: Locator;
  public readonly nextCta: Locator;
  /** One step back in a new game. */
  public readonly stepBackCta: Locator;
  /** Lays the stage over the whole viewport. */
  public readonly fullscreenCta: Locator;
  /** Puts the stage back into the page. */
  public readonly exitFullscreenCta: Locator;
  public readonly difficultyPicker: Locator;
  public readonly boostCta: Locator;
  public readonly colonyNames: Locator;
  /** The stage, with the arena and a seat per player, in the page or not. */
  public readonly stage: Locator;
  /** The stage while it is laid over the whole viewport. */
  public readonly fullscreenStage: Locator;
  public readonly joysticks: Locator;
  public readonly colonyCta: Locator;
  public readonly settingsCta: Locator;
  public readonly helpCta: Locator;
  public readonly backCta: Locator;
  public readonly pauseCta: Locator;
  public readonly resumeCta: Locator;
  public readonly quitCta: Locator;
  public readonly menuTitle: Locator;
  public readonly muteCta: Locator;
  public readonly winner: Locator;
  public readonly unmuteCta: Locator;

  constructor(private readonly page: Page) {
    this.playArea = page.locator('.stage .arena-canvas');
    this.playCta = page.getByRole('button', { name: /New game/ });
    this.startCta = page.getByRole('button', { name: /^Start / });
    this.profileCta = page.getByRole('button', { name: 'Profile' });
    // The tile's name goes on with the friend requests waiting.
    this.friendsCta = page.getByRole('button', { name: /^Friends/ });
    this.startStep = page.locator('feat-lazy-bac-game-new-game .start-step');
    this.nextCta = page.getByRole('button', { name: /^Next/ });
    this.stepBackCta = page.getByRole('button', { name: 'Back', exact: true });
    this.fullscreenCta = page.getByRole('button', {
      name: 'Fullscreen',
      exact: true,
    });
    this.exitFullscreenCta = page.getByRole('button', {
      name: 'Exit fullscreen',
    });
    this.difficultyPicker = page.locator('.difficulty-picker');
    this.boostCta = page.getByRole('button', { name: /^Boost/ });
    this.colonyNames = page.locator('.colony-name');
    this.stage = page.locator('.stage');
    this.fullscreenStage = page.locator('.stage.fullscreen');
    this.joysticks = page.getByLabel(/^Joystick /);
    this.colonyCta = page.getByRole('button', { name: 'My Colony' });
    this.settingsCta = page.getByRole('button', { name: 'Settings' });
    this.helpCta = page.getByRole('button', { name: 'How to play' });
    this.backCta = page.getByRole('button', { name: 'Menu', exact: true });
    this.pauseCta = page.getByRole('button', { name: 'Pause', exact: true });
    this.resumeCta = page.getByRole('button', { name: 'Resume' });
    this.quitCta = page.getByRole('button', { name: 'Quit to menu' });
    this.menuTitle = page.locator('feat-lazy-bac-game-main-menu h1');
    this.muteCta = page.getByRole('button', { name: 'Mute', exact: true });
    this.winner = page.locator('feat-lazy-bac-game-winner');
    this.unmuteCta = page.getByRole('button', { name: 'Unmute' });
  }

  public async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /** A level's card in the level choice, by the level's title. */
  public levelCard(title: string): Locator {
    return this.page
      .locator('.levels')
      .getByRole('button', { name: new RegExp(`^\\d+ ${title}\\b`) });
  }

  public async chooseLevel(title: string): Promise<void> {
    await this.levelCard(title).click();
  }

  /** A mode of a new game, by its name - "Campaign", "Two players". */
  public async chooseMode(name: string): Promise<void> {
    await this.page
      .locator('feat-lazy-bac-game-new-game .mode')
      .filter({ hasText: name })
      .click();
  }

  /** A new game in a mode, on to its start with the level it offers. */
  public async setUp(mode = 'Campaign'): Promise<void> {
    await this.playCta.click();
    await this.chooseMode(mode);
    await this.nextCta.click();
  }

  /** A new online game: straight to the lobby, which has no level step. */
  public async setUpOnline(): Promise<void> {
    await this.playCta.click();
    await this.chooseMode('Online');
  }

  /** Opens an online match from the lobby, on a level picked first. */
  public async openMatch(level = 'Petri Dish'): Promise<void> {
    await this.page.getByRole('button', { name: 'Open a match' }).click();
    await this.chooseLevel(level);
  }

  /** A new campaign game, started on the level the ladder offers. */
  public async startMatch(): Promise<void> {
    await this.setUp();
    await this.startCta.click();
  }

  public async chooseDifficulty(name: RegExp): Promise<void> {
    await this.difficultyPicker.getByRole('radio', { name }).click();
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

  /** Picks a colour in the colour picker of a seat, by the seat's label. */
  public async chooseColor(seat: string, color: string): Promise<void> {
    await this.page
      .getByRole('radiogroup', { name: `Colour of ${seat}` })
      .getByRole('radio', { name: color })
      .click();
  }

  /**
   * Holds a seat's joystick with one finger and taps its boost button with a
   * second one - two touches at once, as two hands on a phone make them.
   */
  public async tapBoostWhileHoldingStick(seat: number): Promise<void> {
    const stick = await this.boxOf(this.joystick(seat));
    const boost = await this.boxOf(this.boostOf(seat));
    const cdp = await this.page.context().newCDPSession(this.page);
    const finger = {
      x: stick.x + stick.width / 2,
      y: stick.y + stick.height / 2,
      id: 1,
    };
    const pushed = { ...finger, x: finger.x + 30 };
    const tap = {
      x: boost.x + boost.width / 2,
      y: boost.y + boost.height / 2,
      id: 2,
    };
    const touch = (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      touchPoints: (typeof finger)[]
    ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });

    await touch('touchStart', [finger]);
    await touch('touchMove', [pushed]);
    await touch('touchStart', [pushed, tap]);
    await touch('touchEnd', [pushed]);
    await touch('touchEnd', []);
  }

  /**
   * The colour of the arena at a cell, read back off the canvas by drawing
   * it into another one - and whether it is the orange colony's.
   *
   * A WebGL canvas only holds its picture in the frame it was painted in, so
   * it is read in an animation frame, after the running game painted it.
   */
  public async arenaPixel(
    x: number,
    y: number
  ): Promise<{ r: number; g: number; b: number; orange: boolean }> {
    return this.playArea.evaluate(
      (canvas: HTMLCanvasElement, [cellX, cellY]) =>
        new Promise<{ r: number; g: number; b: number; orange: boolean }>(
          (resolve, reject) =>
            requestAnimationFrame(() => {
              const copy = document.createElement('canvas');
              copy.width = canvas.width;
              copy.height = canvas.height;
              const context = copy.getContext('2d');
              if (context == null) {
                reject(new Error('no 2d context for the copy'));
                return;
              }
              context.drawImage(canvas, 0, 0);
              const scale = canvas.width / 320;
              const [r, g, b] = context.getImageData(
                Math.floor((cellX + 0.5) * scale),
                Math.floor((cellY + 0.5) * scale),
                1,
                1
              ).data;
              resolve({ r, g, b, orange: r > 150 && b < 120 && r > g });
            })
        ),
      [x, y]
    );
  }

  /** The number of bacteria a colony has, as the stage bar shows it. */
  /**
   * The GPU self-test's stored verdict (ADR 0015) - null until the game
   * has run it.
   */
  public async gpuSelfTest(): Promise<{ ok: boolean } | null> {
    const json = await this.page.evaluate(() =>
      localStorage.getItem('bacteria-game.gpu-self-test')
    );
    return json === null ? null : (JSON.parse(json) as { ok: boolean });
  }

  public async colonyCount(colony: number): Promise<number> {
    const text = await this.page
      .locator('.hud-colony .colony-count')
      .nth(colony)
      .innerText();
    return Number(text);
  }

  public async release(): Promise<void> {
    await this.page.mouse.up();
  }
}
