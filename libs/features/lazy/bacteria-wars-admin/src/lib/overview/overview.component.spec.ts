import { TestBed } from '@angular/core/testing';
import {
  type FakeDoc,
  FakeFirebase,
  provideFakeGameCloud,
  settleSnapshots,
  timestampAt,
} from '@wolsok/feat-lazy-bac-game/testing';
import { AdminCommandsService } from '../commands/admin-commands.service';
import { OverviewComponent } from './overview.component';

const NOON = Date.UTC(2026, 9, 25, 12);
const HOUR = 3_600_000;

/** `adminStats/now` as seeded, and two hourly snapshots before it. */
function fakeStats(now: FakeDoc | undefined): FakeFirebase {
  return new FakeFirebase({
    docs: {
      ...(now === undefined ? {} : { 'adminStats/now': now }),
      'adminStats/h_2026102510': {
        online: 3,
        at: timestampAt(NOON - 2 * HOUR),
      },
      'adminStats/h_2026102511': { online: 4, at: timestampAt(NOON - HOUR) },
    },
  });
}

async function render(
  now: FakeDoc | undefined,
  send = jest.fn(async (_command: { type: string }) => ({ ok: true }))
) {
  const fake = fakeStats(now);
  TestBed.configureTestingModule({
    providers: [
      provideFakeGameCloud({ firebase: fake.connection() }),
      { provide: AdminCommandsService, useValue: { send } },
    ],
  });
  const fixture = TestBed.createComponent(OverviewComponent);
  fixture.detectChanges();
  await settleSnapshots();
  fixture.detectChanges();
  return {
    fake,
    fixture,
    send,
    text: () => fixture.nativeElement.textContent,
  };
}

function button(
  fixture: { nativeElement: HTMLElement },
  label: string
): HTMLButtonElement {
  return [...fixture.nativeElement.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(label)
  ) as HTMLButtonElement;
}

describe('OverviewComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the figures and the hourly history, newest first and without now', async () => {
    const { fixture, fake, text } = await render({
      accounts: 1234,
      online: 7,
      entries: { xp: 3 },
      at: timestampAt(NOON),
    });
    expect(text()).toContain('Accounts');
    expect(text()).toContain('1,234');
    expect(text()).toContain('Online now');
    expect(text()).toContain('xp');
    expect(text()).toContain('The last 48 hours');
    const rows = [
      ...fixture.nativeElement.querySelectorAll('table.history tr[mat-row]'),
    ].map((row: Element) => row.textContent?.replace(/\s+/g, ' ').trim());
    expect(rows).toEqual([
      expect.stringMatching(/^\S+ 11:00 4 /),
      expect.stringMatching(/^\S+ 10:00 3 /),
    ]);
    expect(fake.queries).toEqual([
      ['adminStats', ['orderBy', 'at', 'desc'], ['limit', 49]],
    ]);
  });

  it('asks for a refresh when there are no statistics yet', async () => {
    const { fixture, send, text } = await render(undefined);
    expect(text()).toContain('No statistics yet');

    button(fixture, 'Refresh').click();
    await fixture.whenStable();

    expect(send).toHaveBeenCalledWith({
      type: 'stats.refresh',
      target: null,
      reason: '',
      args: {},
    });
  });

  it('shows a refused refresh', async () => {
    const { fixture, text } = await render(
      undefined,
      jest.fn(async () => ({ ok: false, error: 'not-admin' }))
    );
    button(fixture, 'Refresh').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('The server refused: not-admin');
  });

  it('recounts the accounts, then refreshes to show the total', async () => {
    const { fixture, send } = await render(undefined);
    button(fixture, 'Recount accounts').click();
    await fixture.whenStable();

    expect(send.mock.calls.map(([command]) => command.type)).toEqual([
      'stats.recount',
      'stats.refresh',
    ]);
  });

  it('mirrors the friend lists for the online status', async () => {
    const { fixture, send } = await render(undefined);
    button(fixture, 'Mirror friend lists').click();
    await fixture.whenStable();

    expect(send.mock.calls.map(([command]) => command.type)).toEqual([
      'presence.backfill',
    ]);
  });

  it('does not refresh after a refused recount', async () => {
    const send = jest.fn(async (_command: { type: string }) => ({
      ok: false,
      error: 'not-admin',
    }));
    const { fixture, text } = await render(undefined, send);
    button(fixture, 'Recount accounts').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'stats.recount' })
    );
    expect(text()).toContain('The server refused: not-admin');
  });
});
