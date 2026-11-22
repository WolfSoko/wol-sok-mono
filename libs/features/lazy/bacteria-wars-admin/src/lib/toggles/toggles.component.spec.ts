import { TestBed } from '@angular/core/testing';
import { FEATURE_TOGGLES } from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminActionsService } from '../moderation/admin-actions.service';
import { AdminTogglesService, type TogglesRead } from './admin-toggles.service';
import { TogglesComponent } from './toggles.component';

const STATE: TogglesRead = {
  available: true,
  values: { ...FEATURE_TOGGLES, matchmaking: 'off' },
  set: { matchmaking: 'off' },
};

function render(state: TogglesRead = STATE) {
  const read = jest.fn(async (_fresh: boolean) => state);
  const run = jest.fn(async () => ({ ok: true }));
  TestBed.configureTestingModule({
    providers: [
      { provide: AdminTogglesService, useValue: { read } },
      { provide: AdminActionsService, useValue: { run } },
    ],
  });
  const fixture = TestBed.createComponent(TogglesComponent);
  const element: HTMLElement = fixture.nativeElement;
  const settle = async () => {
    for (let round = 0; round < 3; round++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  };
  const button = (label: string) =>
    [...element.querySelectorAll('button')].find((b) =>
      b.textContent?.includes(label)
    ) as HTMLButtonElement;
  /** The button of a toggle's state, by the toggle's key. */
  const toggle = (key: string, state: 'Off' | 'Admin' | 'On') =>
    [
      ...element.querySelectorAll(
        `mat-button-toggle-group[data-toggle="${key}"] button`
      ),
    ].find((b) => b.textContent?.trim() === state) as HTMLButtonElement;
  return { fixture, element, read, run, settle, button, toggle };
}

describe('TogglesComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows each toggle, set in Remote Config or at its default', async () => {
    const { element, read, settle, button } = render();
    await settle();
    expect(read).toHaveBeenCalledWith(true);
    const text = element.textContent ?? '';
    expect(text).toContain('Matchmaking queue');
    expect(text).toContain('set in Remote Config');
    expect(text).toContain('default (On)');
    expect(text).toContain('default (Off)');
    expect(text).toContain('Bacterium main menu');
    expect(button('Publish').disabled).toBe(true);
  });

  it('publishes only the changed toggles, then reads them back', async () => {
    const { run, read, settle, button, toggle, element } = render();
    await settle();
    toggle('leaderboards', 'Admin').click();
    toggle('bacteriumMenu', 'Admin').click();
    await settle();
    expect(element.textContent).toContain('changed');
    button('Publish').click();
    await settle();
    expect(run).toHaveBeenCalledWith({
      type: 'toggles.set',
      subject: 'Leaderboards, Bacterium main menu',
      target: null,
      args: { values: { leaderboards: 'admin', bacteriumMenu: 'admin' } },
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(element.textContent).toContain(
      'Published: Leaderboards: Admin, Bacterium main menu: Admin'
    );
  });

  it('locks the draft while it reads the toggles again', async () => {
    const { read, settle, button, toggle } = render();
    await settle();
    toggle('leaderboards', 'Off').click();
    await settle();
    let answer: (state: TogglesRead) => void = () => undefined;
    read.mockImplementationOnce(
      () => new Promise<TogglesRead>((resolve) => (answer = resolve))
    );
    button('Read again').click();
    await settle();
    expect(button('Read again').disabled).toBe(true);
    expect(button('Publish').disabled).toBe(true);
    expect(button('Discard').disabled).toBe(true);
    expect(toggle('leaderboards', 'On').disabled).toBe(true);
    answer(STATE);
    await settle();
    expect(read).toHaveBeenCalledTimes(2);
    expect(button('Read again').disabled).toBe(false);
    expect(toggle('leaderboards', 'On').disabled).toBe(false);
  });

  it('switches nothing where Remote Config cannot be reached', async () => {
    const { element, settle } = render({
      available: false,
      values: FEATURE_TOGGLES,
      set: {},
    });
    await settle();
    expect(element.textContent).toContain('cannot be reached');
    expect(
      element
        .querySelector('mat-button-toggle-group button')
        ?.hasAttribute('disabled')
    ).toBe(true);
  });
});
