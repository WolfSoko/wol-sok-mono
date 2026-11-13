import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { mapStorage } from '../../testing/storage';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  type Selection,
  SelectionTooNewError,
  LocalSelection,
} from '@wolsok/feat-korbjaeger-selection';
import { AfterUnfollow } from './after-unfollow';
import { FollowTeamComponent } from './follow-team.component';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';

const MTV_WASBUETTEL: TeamId = 313036;

interface Rendered {
  readonly button: HTMLButtonElement;
  readonly page: HTMLElement;
  /** The snackbars, open over the page (`document`'s root). */
  readonly bars: HarnessLoader;
  /** Clicks the button and waits until the page shows what followed. */
  click(): Promise<void>;
}

interface Options {
  readonly teamName?: string;
  /** The screen provides `AfterUnfollow`. */
  readonly afterUnfollow?: boolean;
  /** The control says it disappears with its Team (`disappearsOnUnfollow`). */
  readonly disappears?: boolean;
}

async function render(
  selection: Selection,
  { teamName, afterUnfollow, disappears }: Options = {}
): Promise<Rendered> {
  TestBed.configureTestingModule({
    providers: [
      { provide: AUSWAHL, useValue: selection },
      ...((afterUnfollow ?? disappears) ? [AfterUnfollow] : []),
    ],
  });
  const fixture = TestBed.createComponent(FollowTeamComponent);
  fixture.componentRef.setInput('teamId', MTV_WASBUETTEL);
  if (teamName !== undefined) {
    fixture.componentRef.setInput('teamName', teamName);
  }
  if (disappears) {
    fixture.componentRef.setInput('disappearsOnUnfollow', true);
  }
  await fixture.whenStable();
  const page = fixture.nativeElement as HTMLElement;
  const button = page.querySelector<HTMLButtonElement>(
    '[data-qa="follow-team"]'
  );
  if (button === null) {
    throw new Error('no button');
  }
  return {
    button,
    page,
    bars: TestbedHarnessEnvironment.documentRootLoader(fixture),
    click: async () => {
      button.click();
      await wait();
      await fixture.whenStable();
    },
  };
}

/** Lets the adapter settle (microtasks), then the next round of the page. */
async function wait(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
}

describe('FollowTeamComponent', () => {
  afterEach(() => {
    TestBed.inject(MatSnackBar).dismiss();
  });

  it('offers to follow a Team not followed yet', async () => {
    const { button } = await render(new LocalSelection(undefined));

    expect(button.textContent).toContain('Team folgen');
    expect(button.hasAttribute('aria-pressed')).toBe(false);
  });

  it('follows the Team, then says so and offers to unfollow it', async () => {
    const selection = new LocalSelection(undefined);
    const { button, page, click } = await render(selection);

    await click();

    expect(selection.teams()).toEqual([MTV_WASBUETTEL]);
    expect(button.textContent).toContain('Nicht mehr folgen');
    expect(button.textContent).not.toContain('Team folgen');
    expect(page.textContent).toContain('Du folgst diesem Team.');
    expect(page.textContent).toContain('Steht in Meine Teams');
  });

  it('names the Team in its label in a list, without the hint', async () => {
    const selection = new LocalSelection(undefined);
    const { button, page, click } = await render(selection, {
      teamName: 'MTV Wasbüttel',
    });
    expect(button.getAttribute('aria-label')).toBe(
      'Team folgen: MTV Wasbüttel'
    );

    await click();

    expect(button.getAttribute('aria-label')).toBe(
      'Nicht mehr folgen: MTV Wasbüttel'
    );
    expect(page.textContent).not.toContain('Steht in Meine Teams');
  });

  it('unfollows a followed Team, then offers to follow it again', async () => {
    const selection = new LocalSelection(undefined);
    await selection.follow(201500);
    await selection.follow(MTV_WASBUETTEL);
    const { button, page, bars, click } = await render(selection);
    expect(button.textContent).toContain('Nicht mehr folgen');

    await click();

    expect(selection.teams()).toEqual([201500]);
    expect(button.textContent).toContain('Team folgen');
    expect(page.textContent).not.toContain('Steht in Meine Teams');
    expect(await bars.getHarnessOrNull(MatSnackBarHarness)).toBeNull();
  });

  describe('where the control disappears with the Team (AfterUnfollow)', () => {
    it('offers to undo the unfollowing, and follows the Team again', async () => {
      const selection = new LocalSelection(undefined);
      await selection.follow(MTV_WASBUETTEL);
      const { bars, click } = await render(selection, {
        teamName: 'MTV Wasbüttel',
        disappears: true,
      });

      await click();

      expect(selection.teams()).toEqual([]);
      const bar = await bars.getHarness(MatSnackBarHarness);
      expect(await bar.getMessage()).toBe(
        'MTV Wasbüttel steht nicht mehr in Meine Teams.'
      );
      expect(await bar.getActionDescription()).toBe('Rückgängig');

      await bar.dismissWithAction();
      await wait();

      expect(selection.teams()).toEqual([MTV_WASBUETTEL]);
    });

    it('puts the Team back at its place in Meine Teams, not at the end', async () => {
      const MTV_GIFHORN = 201500;
      const selection = new LocalSelection(mapStorage());
      await selection.follow(MTV_WASBUETTEL);
      await selection.follow(MTV_GIFHORN);
      const { bars, click } = await render(selection, {
        teamName: 'MTV Wasbüttel',
        disappears: true,
      });

      await click();
      expect(selection.teams()).toEqual([MTV_GIFHORN]);
      await (await bars.getHarness(MatSnackBarHarness)).dismissWithAction();
      await wait();

      expect(selection.teams()).toEqual([MTV_WASBUETTEL, MTV_GIFHORN]);
    });

    it('says so where the undo could not be stored', async () => {
      const selection: Selection = fakeSelection({
        teams: signal([MTV_WASBUETTEL]),
        follow: () => Promise.reject(new Error('offline')),
      });
      const { bars, click } = await render(selection, {
        teamName: 'MTV Wasbüttel',
        disappears: true,
      });
      await click();

      await (await bars.getHarness(MatSnackBarHarness)).dismissWithAction();
      await wait();

      const bar = await bars.getHarness(MatSnackBarHarness);
      expect(await bar.getMessage()).toContain(
        'Das ließ sich nicht speichern.'
      );
    });

    it('hands the screen the Team unfollowed, to move focus', async () => {
      const selection = new LocalSelection(undefined);
      await selection.follow(MTV_WASBUETTEL);
      const { click } = await render(selection, {
        teamName: 'MTV Wasbüttel',
        disappears: true,
      });
      const unfollowed = vi.spyOn(TestBed.inject(AfterUnfollow), 'unfollowed');

      await click();

      expect(unfollowed).toHaveBeenCalledWith(
        MTV_WASBUETTEL,
        'MTV Wasbüttel',
        undefined
      );
    });

    it('hands the screen the place the Team had, for the undo', async () => {
      const place = { since: 7 };
      const selection: Selection = fakeSelection({
        teams: signal([MTV_WASBUETTEL]),
        unfollow: () => Promise.resolve(place),
      });
      const { click } = await render(selection, {
        teamName: 'MTV Wasbüttel',
        disappears: true,
      });
      const unfollowed = vi.spyOn(TestBed.inject(AfterUnfollow), 'unfollowed');

      await click();

      expect(unfollowed).toHaveBeenCalledWith(
        MTV_WASBUETTEL,
        'MTV Wasbüttel',
        place
      );
    });

    it('leaves focus and offers no undo for a control that stays (a Verein list on the screen)', async () => {
      const selection = new LocalSelection(undefined);
      await selection.follow(MTV_WASBUETTEL);
      const { bars, click } = await render(selection, {
        teamName: 'MTV Wasbüttel',
        afterUnfollow: true,
      });
      const unfollowed = vi.spyOn(TestBed.inject(AfterUnfollow), 'unfollowed');

      await click();

      expect(selection.teams()).toEqual([]);
      expect(unfollowed).not.toHaveBeenCalled();
      expect(await bars.getHarnessOrNull(MatSnackBarHarness)).toBeNull();
    });

    it('offers no undo where the unfollowing failed', async () => {
      const selection: Selection = fakeSelection({
        teams: signal([MTV_WASBUETTEL]),
        unfollow: () => Promise.reject(new Error('offline')),
      });
      const { page, bars, click } = await render(selection, {
        teamName: 'MTV Wasbüttel',
        disappears: true,
      });
      const unfollowed = vi.spyOn(TestBed.inject(AfterUnfollow), 'unfollowed');

      await click();

      expect(await bars.getHarnessOrNull(MatSnackBarHarness)).toBeNull();
      expect(unfollowed).not.toHaveBeenCalled();
      expect(page.querySelector('[role="alert"]')?.textContent).toContain(
        'Das ließ sich nicht speichern.'
      );
    });
  });
  it('takes whether the Team is followed from the screen, where it knows', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AUSWAHL, useValue: new LocalSelection(undefined) },
      ],
    });
    const fixture = TestBed.createComponent(FollowTeamComponent);
    fixture.componentRef.setInput('teamId', MTV_WASBUETTEL);
    fixture.componentRef.setInput('followed', true);
    await fixture.whenStable();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-qa="follow-team"]'
      )?.textContent
    ).toContain('Nicht mehr folgen');
  });

  it('says so when the choice could not be stored', async () => {
    const selection: Selection = fakeSelection({
      teams: signal([]),
      follow: () => Promise.reject(new Error('offline')),
    });
    const { button, page, click } = await render(selection);

    await click();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'Das ließ sich nicht speichern.'
    );
    expect(button.textContent).toContain('Team folgen');
  });

  it('asks to reload where a newer version of the app stored Meine Teams', async () => {
    const selection: Selection = fakeSelection({
      teams: signal([]),
      follow: () => Promise.reject(new SelectionTooNewError()),
    });
    const { page, click } = await render(selection);

    await click();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'Bitte die App neu laden.'
    );
  });

  it('offers nothing to press before Meine Teams are read', async () => {
    const follow = vi.fn<Selection['follow']>(() => Promise.resolve());
    const { button, page, click } = await render(
      fakeSelection({ teams: signal(undefined), follow })
    );

    await click();

    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Team folgen');
    expect(follow).not.toHaveBeenCalled();
    expect(page.textContent).not.toContain('Steht in Meine Teams');
  });
});
