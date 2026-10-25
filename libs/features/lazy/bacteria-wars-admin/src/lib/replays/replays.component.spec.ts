import { TestBed } from '@angular/core/testing';
import { AdminActionsService } from '../moderation/admin-actions.service';
import type { StoredReplayRecord } from '../moderation/admin-records';
import { AdminRecordsService } from '../moderation/admin-records.service';
import { ReplaysComponent } from './replays.component';

const STORED: StoredReplayRecord = {
  replayId: 'r9',
  state: 'verified',
  kind: 'local',
  levelId: 'l9',
  score: 64,
  publicId: null,
  galleryOut: false,
};

function render(stored: StoredReplayRecord | null | Error = STORED) {
  const publicReplays = jest.fn(async () => ({
    rows: [
      {
        publicId: 'p1',
        replayId: 'r1',
        kind: 'online',
        levelId: 'arena',
        players: ['Ada', 'Anonymous #0042'],
        score: 70,
        featuredAt: Date.UTC(2026, 9, 25),
        featuredBy: 'admin' as const,
        anonymised: false,
      },
      {
        publicId: 'p2',
        replayId: 'r2',
        kind: 'local',
        levelId: 'l2',
        players: ['Anonymous #0001', 'computer'],
        score: 61,
        featuredAt: null,
        featuredBy: 'auto' as const,
        anonymised: true,
      },
    ],
    next: null,
  }));
  const candidateDays = jest.fn(async () => ({
    rows: [
      {
        day: '2026-10-24',
        checked: 3,
        published: ['r1'],
        candidates: [
          {
            replayId: 'r1',
            kind: 'online',
            levelId: 'arena',
            score: 70,
            reasons: [],
          },
          {
            replayId: 'r3',
            kind: 'local',
            levelId: 'daily-x',
            score: 58,
            reasons: ['close'],
          },
        ],
      },
    ],
    next: null,
  }));
  const storedReplay = jest.fn(async (_id: string) => {
    if (stored instanceof Error) {
      throw stored;
    }
    return stored;
  });
  const runReplay = jest.fn(async () => ({ ok: true }));
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AdminRecordsService,
        useValue: { publicReplays, candidateDays, storedReplay },
      },
      { provide: AdminActionsService, useValue: { runReplay } },
    ],
  });
  const fixture = TestBed.createComponent(ReplaysComponent);
  const element: HTMLElement = fixture.nativeElement;
  // A command reloads after it answers: let every promise run.
  const settle = async () => {
    for (let round = 0; round < 3; round++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  };
  const buttons = (label: string) =>
    [...element.querySelectorAll('button')].filter((b) =>
      b.textContent?.includes(label)
    ) as HTMLButtonElement[];
  const typeId = async (id: string) => {
    const input = element.querySelector('input') as HTMLInputElement;
    input.value = id;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  return {
    fixture,
    element,
    publicReplays,
    storedReplay,
    runReplay,
    settle,
    buttons,
    typeId,
  };
}

describe('ReplaysComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists the public replays and the runners-up', async () => {
    const { element, settle, buttons } = render();
    await settle();
    const text = element.textContent ?? '';
    expect(text).toContain('online · arena');
    expect(text).toContain('Ada – Anonymous #0042');
    expect(text).toContain('by you');
    expect(text).toContain('2026-10-24');
    expect(text).toContain('1 published, 3 re-run');
    expect(text).toContain('daily-x');
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      '/replays/p1'
    );
    // The anonymised one offers no second anonymising.
    expect(buttons('Anonymise')).toHaveLength(1);
    // A runner-up already public offers no feature: only r3 does.
    expect(buttons('Feature in the gallery')).toHaveLength(1);
  });

  it('takes a public replay down and anonymises one, then reloads', async () => {
    const { runReplay, publicReplays, settle, buttons } = render();
    await settle();
    buttons('Take down from the gallery')[0].click();
    await settle();
    expect(runReplay).toHaveBeenLastCalledWith(
      'unfeature',
      'p1',
      'online · arena'
    );
    expect(publicReplays).toHaveBeenCalledTimes(2);
    buttons('Anonymise')[0].click();
    await settle();
    expect(runReplay).toHaveBeenLastCalledWith(
      'anonymise',
      'p1',
      'online · arena'
    );
  });

  it('features a runner-up', async () => {
    const { runReplay, settle, buttons } = render();
    await settle();
    buttons('Feature in the gallery')[0].click();
    await settle();
    expect(runReplay).toHaveBeenLastCalledWith('feature', 'r3', 'r3');
  });

  it('looks up a stored replay by id and features it', async () => {
    const { element, storedReplay, runReplay, settle, buttons, typeId } =
      render();
    await settle();
    await typeId('bad id!');
    expect(buttons('Look up')[0].disabled).toBe(true);
    await typeId('r9');
    buttons('Look up')[0].click();
    await settle();
    expect(storedReplay).toHaveBeenCalledWith('r9');
    expect(element.textContent).toContain('local · l9 · verified');

    // The input changes, but the card refreshes the replay it shows.
    await typeId('half');
    buttons('Feature in the gallery')[0].click();
    await settle();
    expect(runReplay).toHaveBeenLastCalledWith('feature', 'r9', 'r9');
    expect(storedReplay).toHaveBeenCalledTimes(2);
    expect(storedReplay).toHaveBeenLastCalledWith('r9');
  });

  it('curates a looked-up public replay by its stored id', async () => {
    const { runReplay, settle, buttons, typeId } = render({
      ...STORED,
      publicId: 'p9',
    });
    await settle();
    await typeId('r9');
    buttons('Look up')[0].click();
    await settle();
    // Two take-downs: the looked-up one first, then the list's.
    buttons('Take down from the gallery')[0].click();
    await settle();
    expect(runReplay).toHaveBeenLastCalledWith('unfeature', 'r9', 'r9');
  });

  it('offers no feature for a replay out of the gallery for good', async () => {
    const { settle, buttons, typeId } = render({
      ...STORED,
      galleryOut: true,
    });
    await settle();
    await typeId('r9');
    buttons('Look up')[0].click();
    await settle();
    // Only the runner-up's.
    expect(buttons('Feature in the gallery')).toHaveLength(1);
  });

  it('says when the replay could not be read', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {
      // expected
    });
    const { element, settle, buttons, typeId } = render(new Error('denied'));
    await settle();
    await typeId('r9');
    buttons('Look up')[0].click();
    await settle();
    expect(element.textContent).toContain('Could not read the replay');
    expect(element.textContent).not.toContain('No stored replay');
    error.mockRestore();
  });

  it('says when no stored replay has the id', async () => {
    const { element, settle, buttons, typeId } = render(null);
    await settle();
    await typeId('r404');
    buttons('Look up')[0].click();
    await settle();
    expect(element.textContent).toContain('No stored replay with this id.');
  });
});
