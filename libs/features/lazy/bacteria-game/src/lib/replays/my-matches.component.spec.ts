import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { FakeGameReplays } from '../../testing/fake-game-replays';
import { recordedReplay } from '../../testing/recorded-replay';
import { recordingPainters } from '../../testing/recording-painter';
import { I18nService } from '../i18n/i18n.service';
import { BALANCE_VERSION } from '../state/game-balance';
import { GameAccount } from '../storage/game-account';
import { GameReplays } from '../storage/game-replays';
import { NEVER, throwError } from 'rxjs';
import { COMMAND_TIMEOUT_MS, MyMatchesComponent } from './my-matches.component';

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

describe('MyMatchesComponent', () => {
  let replays: FakeGameReplays;

  function setUp(cloud = true): void {
    TestBed.resetTestingModule();
    replays = new FakeGameReplays(true, cloud);
    TestBed.configureTestingModule({
      providers: [
        recordingPainters(),
        { provide: GameAccount, useValue: new FakeGameAccount('ada') },
        { provide: GameReplays, useValue: replays },
      ],
    });
    TestBed.inject(I18nService).setLanguage('en');
  }

  beforeEach(() => setUp());

  async function render() {
    const fixture = TestBed.createComponent(MyMatchesComponent);
    await settle(fixture);
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  function button(page: HTMLElement, label: string): HTMLButtonElement {
    const found = [...page.querySelectorAll('button')].find((each) =>
      each.getAttribute('aria-label')?.startsWith(label)
    );
    if (found === undefined) {
      throw new Error(`No button "${label}"`);
    }
    return found;
  }

  it('says so while there are no matches', async () => {
    const { page } = await render();

    expect(page.textContent).toContain('No recorded matches yet.');
    expect(page.textContent).toContain('last 30 days');
  });

  it("lists the player's matches and plays one back", async () => {
    await replays.submit({ replay: recordedReplay(), hint: 40 });
    const { fixture, page } = await render();

    expect(page.textContent).toContain('Vs computer');
    button(page, 'Watch').click();
    await settle(fixture);

    expect(
      page.querySelector('feat-lazy-bac-game-replay-viewer')
    ).not.toBeNull();
    [...page.querySelectorAll('button')]
      .find((each) => each.textContent?.includes('Back to the list'))
      ?.click();
    await settle(fixture);
    expect(page.querySelector('feat-lazy-bac-game-replay-viewer')).toBeNull();
  });

  it('plays no match of an older balance', async () => {
    await replays.submit({ replay: recordedReplay(), hint: 40 });
    replays.change('l_fake0', { balanceVersion: BALANCE_VERSION - 1 });
    const { fixture, page } = await render();

    button(page, 'Watch').click();
    await settle(fixture);

    expect(page.textContent).toContain('older version');
    expect(page.querySelector('feat-lazy-bac-game-replay-viewer')).toBeNull();
  });

  it("tells the result from the player's seat, and what the board said", async () => {
    await replays.submit({ replay: recordedReplay(), hint: 40 });
    replays.change('l_fake0', {
      kind: 'online',
      state: 'agreed',
      winnerSeat: 1,
      seat: 1,
      rankedReason: 'pair-cap',
    });
    const { page } = await render();

    expect(page.textContent).toContain('Online · Won');
    expect(page.textContent).toContain('Both reported');
    expect(page.textContent).toContain(
      "Not counted: the day's counted matches against this opponent are used"
    );
  });

  it('keeps a cloud match out of the gallery by a command', async () => {
    await replays.submit({ replay: recordedReplay(), hint: 40 });
    const { fixture, page } = await render();

    button(page, 'Keep').click();
    await settle(fixture);

    expect(replays.commands).toEqual([{ type: 'remove', replayId: 'l_fake0' }]);
    expect(page.textContent).toContain(
      'This match stays out of the public gallery.'
    );
    // Still listed - the server keeps it until it expires - but marked.
    expect(page.textContent).toContain('Not in the gallery');
    expect(
      [...page.querySelectorAll('button')].some((each) =>
        each.getAttribute('aria-label')?.startsWith('Keep')
      )
    ).toBe(false);
  });

  it('says it did not work when the server never answers, and lets go', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(replays, 'watchCommand').mockReturnValue(NEVER);
    await replays.submit({ replay: recordedReplay(), hint: 40 });
    const { fixture, page } = await render();

    jest.useFakeTimers({
      doNotFake: [
        'queueMicrotask',
        'nextTick',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ],
    });
    try {
      button(page, 'Keep').click();
      await jest.advanceTimersByTimeAsync(COMMAND_TIMEOUT_MS);
    } finally {
      jest.useRealTimers();
    }
    await settle(fixture);

    expect(page.textContent).toContain('That did not work.');
    expect(button(page, 'Keep').disabled).toBe(false);
  });

  it('says it did not work when watching the command fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest
      .spyOn(replays, 'watchCommand')
      .mockReturnValue(throwError(() => new Error('refused')));
    await replays.submit({ replay: recordedReplay(), hint: 40 });
    const { fixture, page } = await render();

    button(page, 'Keep').click();
    await settle(fixture);

    expect(page.textContent).toContain('That did not work.');
    expect(button(page, 'Keep').disabled).toBe(false);
  });

  it("lists a device's matches, newest 20, and deletes one", async () => {
    setUp(false);
    await replays.submit({ replay: recordedReplay(), hint: 40 });
    const { fixture, page } = await render();

    expect(page.textContent).toContain('only the newest 20 are kept');
    button(page, 'Delete').click();
    await settle(fixture);

    expect(replays.commands).toEqual([{ type: 'remove', replayId: 'l_fake0' }]);
    expect(page.textContent).toContain('Match deleted.');
    expect(page.textContent).toContain('No recorded matches yet.');
  });
});
