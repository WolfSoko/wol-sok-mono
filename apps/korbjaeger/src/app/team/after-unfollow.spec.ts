import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  LocalSelection,
  type Selection,
} from '@wolsok/feat-korbjaeger-selection';
import { AUSWAHL } from '../auswahl/auswahl';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';
import { FocusAfterUnfollowDirective } from './focus-after-unfollow.directive';
import { AfterUnfollow } from './after-unfollow';

@Component({
  imports: [FocusAfterUnfollowDirective],
  providers: [AfterUnfollow],
  template: `
    <h2 korbFocusAfterUnfollow tabindex="-1">Meine Teams</h2>
    <button type="button" [korbFocusAfterUnfollow]="313036">Wasbüttel</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Screen {}

interface Setup {
  readonly afterUnfollow: AfterUnfollow;
  readonly bars: HarnessLoader;
  readonly settled: () => Promise<void>;
}

async function render(
  selection: Selection = new LocalSelection(undefined)
): Promise<Setup> {
  TestBed.configureTestingModule({
    providers: [{ provide: AUSWAHL, useValue: selection }],
  });
  const fixture = TestBed.createComponent(Screen);
  await fixture.whenStable();
  return {
    afterUnfollow: fixture.debugElement.injector.get(AfterUnfollow),
    bars: TestbedHarnessEnvironment.documentRootLoader(fixture),
    settled: () => fixture.whenStable(),
  };
}

describe('AfterUnfollow', () => {
  afterEach(() => TestBed.inject(MatSnackBar).dismiss());

  it("moves focus to the Team's own target", async () => {
    const { afterUnfollow } = await render();

    afterUnfollow.unfollowed(313036, 'MTV Wasbüttel');

    expect(document.activeElement?.textContent).toBe('Wasbüttel');
  });

  it("moves focus to the screen's target for a Team without one", async () => {
    const { afterUnfollow } = await render();

    afterUnfollow.unfollowed(201500, 'MTV Gifhorn');

    expect(document.activeElement?.textContent).toBe('Meine Teams');
  });

  it('follows the Team again at the place it had', async () => {
    const follow = vi.fn<Selection['follow']>(() => Promise.resolve());
    const { afterUnfollow, bars } = await render(fakeSelection({ follow }));

    afterUnfollow.unfollowed(313036, 'MTV Wasbüttel', { since: 5 });
    await (await bars.getHarness(MatSnackBarHarness)).dismissWithAction();

    expect(follow).toHaveBeenCalledWith(313036, { since: 5 });
  });

  it('takes the undo back once another store holds the choices (signed in or out elsewhere)', async () => {
    const source = signal<object>({ art: 'konto' });
    const follow = vi.fn<Selection['follow']>(() => Promise.resolve());
    const { afterUnfollow, bars, settled } = await render(
      fakeSelection({ source, follow })
    );
    afterUnfollow.unfollowed(313036, 'MTV Wasbüttel');
    expect(await bars.getHarnessOrNull(MatSnackBarHarness)).not.toBeNull();

    source.set({ art: 'geraet' });
    await settled();

    expect(await bars.getHarnessOrNull(MatSnackBarHarness)).toBeNull();
    expect(follow).not.toHaveBeenCalled();
  });

  it('follows nobody where "Rückgängig" comes after the switch, before the snackbar went', async () => {
    const source = signal<object>({ art: 'konto' });
    const follow = vi.fn<Selection['follow']>(() => Promise.resolve());
    const { afterUnfollow, bars } = await render(
      fakeSelection({ source, follow })
    );
    afterUnfollow.unfollowed(313036, 'MTV Wasbüttel');
    // queried by hand: a harness would wait for the page, running the effect
    const action = document.querySelector<HTMLButtonElement>(
      'mat-snack-bar-container button'
    );
    expect(action).not.toBeNull();

    // the same tick: no effect has run yet
    source.set({ art: 'geraet' });
    action?.click();

    expect(follow).not.toHaveBeenCalled();
    expect(await bars.getHarnessOrNull(MatSnackBarHarness)).toBeNull();
  });
});
