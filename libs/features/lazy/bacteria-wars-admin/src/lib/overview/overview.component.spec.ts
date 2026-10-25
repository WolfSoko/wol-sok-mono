import { TestBed } from '@angular/core/testing';
import {
  type FirebaseConnection,
  GameCloud,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminCommandsService } from '../commands/admin-commands.service';
import { OverviewComponent } from './overview.component';

/** Firestore that answers `adminStats/now` and the snapshot query. */
function fakeStats(now: Record<string, unknown> | undefined) {
  const dbSdk = {
    collection: () => 'adminStats',
    doc: () => 'now',
    query: () => 'history',
    where: () => null,
    orderBy: () => null,
    limit: () => null,
    documentId: () => '__name__',
    onSnapshot: (
      ref: string,
      next: (snapshot: {
        data?: () => unknown;
        docs?: { id: string; data: () => unknown }[];
      }) => void
    ) => {
      next(
        ref === 'now'
          ? { data: () => now }
          : {
              docs: [
                { id: 'h_2026102511', data: () => ({ online: 4 }) },
                { id: 'now', data: () => ({ online: 9 }) },
              ],
            }
      );
      return () => undefined;
    },
  };
  return { db: {}, dbSdk } as unknown as FirebaseConnection;
}

function render(
  now: Record<string, unknown> | undefined,
  send = jest.fn(async (_command: { type: string }) => ({ ok: true }))
) {
  TestBed.configureTestingModule({
    providers: [
      { provide: GameCloud, useValue: { firebase: () => fakeStats(now) } },
      { provide: AdminCommandsService, useValue: { send } },
    ],
  });
  const fixture = TestBed.createComponent(OverviewComponent);
  fixture.detectChanges();
  return { fixture, send, text: () => fixture.nativeElement.textContent };
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

  it('shows the figures and the hourly history', () => {
    const { text } = render({
      accounts: 1234,
      online: 7,
      entries: { xp: 3 },
      at: { toMillis: () => Date.UTC(2026, 9, 25, 12) },
    });
    expect(text()).toContain('Accounts');
    expect(text()).toContain('1,234');
    expect(text()).toContain('Online now');
    expect(text()).toContain('xp');
    expect(text()).toContain('The last 48 hours');
  });

  it('asks for a refresh when there are no statistics yet', async () => {
    const { fixture, send, text } = render(undefined);
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
    const { fixture, text } = render(
      undefined,
      jest.fn(async () => ({ ok: false, error: 'not-admin' }))
    );
    button(fixture, 'Refresh').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('The server refused: not-admin');
  });

  it('recounts the accounts, then refreshes to show the total', async () => {
    const { fixture, send } = render(undefined);
    button(fixture, 'Recount accounts').click();
    await fixture.whenStable();

    expect(send.mock.calls.map(([command]) => command.type)).toEqual([
      'stats.recount',
      'stats.refresh',
    ]);
  });

  it('does not refresh after a refused recount', async () => {
    const send = jest.fn(async (_command: { type: string }) => ({
      ok: false,
      error: 'not-admin',
    }));
    const { fixture, text } = render(undefined, send);
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
