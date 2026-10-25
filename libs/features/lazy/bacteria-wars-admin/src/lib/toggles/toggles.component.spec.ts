import { TestBed } from '@angular/core/testing';
import { FEATURE_TOGGLES } from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminActionsService } from '../moderation/admin-actions.service';
import { AdminTogglesService, type ToggleState } from './admin-toggles.service';
import { TogglesComponent } from './toggles.component';

const STATE: ToggleState = {
  available: true,
  values: { ...FEATURE_TOGGLES, matchmaking: false },
  set: { matchmaking: false },
};

function render(state: ToggleState = STATE) {
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
  const toggle = (name: string) =>
    [...element.querySelectorAll('mat-slide-toggle')]
      .find((t) => t.textContent?.includes(name))
      ?.querySelector('button') as HTMLButtonElement;
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
    expect(text).toContain('default (on)');
    expect(button('Publish').disabled).toBe(true);
  });

  it('publishes only the changed toggles, then reads them back', async () => {
    const { run, read, settle, button, toggle, element } = render();
    await settle();
    toggle('Leaderboards').click();
    await settle();
    expect(element.textContent).toContain('changed');
    button('Publish').click();
    await settle();
    expect(run).toHaveBeenCalledWith({
      type: 'toggles.set',
      subject: 'Leaderboards',
      target: null,
      args: { values: { leaderboards: false } },
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(element.textContent).toContain('Published: Leaderboards: off');
  });

  it('locks the draft while it reads the toggles again', async () => {
    const { read, settle, button, toggle } = render();
    await settle();
    toggle('Leaderboards').click();
    await settle();
    let answer: (state: ToggleState) => void = () => undefined;
    read.mockImplementationOnce(
      () => new Promise<ToggleState>((resolve) => (answer = resolve))
    );
    button('Read again').click();
    await settle();
    expect(button('Read again').disabled).toBe(true);
    expect(button('Publish').disabled).toBe(true);
    expect(button('Discard').disabled).toBe(true);
    expect(toggle('Leaderboards').disabled).toBe(true);
    answer(STATE);
    await settle();
    expect(read).toHaveBeenCalledTimes(2);
    expect(button('Read again').disabled).toBe(false);
    expect(toggle('Leaderboards').disabled).toBe(false);
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
      element.querySelector('mat-slide-toggle button')?.hasAttribute('disabled')
    ).toBe(true);
  });
});
