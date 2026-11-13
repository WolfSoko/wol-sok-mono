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
import { NachEntfolgen } from './nach-entfolgen';
import { TeamFolgenComponent } from './team-folgen.component';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';

const MTV_WASBUETTEL: TeamId = 313036;

interface Gerendert {
  readonly knopf: HTMLButtonElement;
  readonly seite: HTMLElement;
  /** The snackbars, open over the page (`document`'s root). */
  readonly leisten: HarnessLoader;
  /** Clicks the button and waits until the page shows what followed. */
  klicken(): Promise<void>;
}

interface Optionen {
  readonly teamName?: string;
  /** The screen provides `NachEntfolgen`. */
  readonly nachEntfolgen?: boolean;
  /** The control says it disappears with its Team (`verschwindetNachEntfolgen`). */
  readonly verschwindet?: boolean;
}

async function render(
  auswahl: Selection,
  { teamName, nachEntfolgen, verschwindet }: Optionen = {}
): Promise<Gerendert> {
  TestBed.configureTestingModule({
    providers: [
      { provide: AUSWAHL, useValue: auswahl },
      ...((nachEntfolgen ?? verschwindet) ? [NachEntfolgen] : []),
    ],
  });
  const fixture = TestBed.createComponent(TeamFolgenComponent);
  fixture.componentRef.setInput('teamId', MTV_WASBUETTEL);
  if (teamName !== undefined) {
    fixture.componentRef.setInput('teamName', teamName);
  }
  if (verschwindet) {
    fixture.componentRef.setInput('verschwindetNachEntfolgen', true);
  }
  await fixture.whenStable();
  const seite = fixture.nativeElement as HTMLElement;
  const knopf = seite.querySelector<HTMLButtonElement>(
    '[data-qa="team-folgen"]'
  );
  if (knopf === null) {
    throw new Error('no button');
  }
  return {
    knopf,
    seite,
    leisten: TestbedHarnessEnvironment.documentRootLoader(fixture),
    klicken: async () => {
      knopf.click();
      await warten();
      await fixture.whenStable();
    },
  };
}

/** Lets the adapter settle (microtasks), then the next round of the page. */
async function warten(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
}

describe('TeamFolgenComponent', () => {
  afterEach(() => {
    TestBed.inject(MatSnackBar).dismiss();
  });

  it('offers to follow a Team not followed yet', async () => {
    const { knopf } = await render(new LocalSelection(undefined));

    expect(knopf.textContent).toContain('Team folgen');
    expect(knopf.hasAttribute('aria-pressed')).toBe(false);
  });

  it('follows the Team, then says so and offers to unfollow it', async () => {
    const auswahl = new LocalSelection(undefined);
    const { knopf, seite, klicken } = await render(auswahl);

    await klicken();

    expect(auswahl.teams()).toEqual([MTV_WASBUETTEL]);
    expect(knopf.textContent).toContain('Nicht mehr folgen');
    expect(knopf.textContent).not.toContain('Team folgen');
    expect(seite.textContent).toContain('Du folgst diesem Team.');
    expect(seite.textContent).toContain('Steht in Meine Teams');
  });

  it('names the Team in its label in a list, without the hint', async () => {
    const auswahl = new LocalSelection(undefined);
    const { knopf, seite, klicken } = await render(auswahl, {
      teamName: 'MTV Wasbüttel',
    });
    expect(knopf.getAttribute('aria-label')).toBe('Team folgen: MTV Wasbüttel');

    await klicken();

    expect(knopf.getAttribute('aria-label')).toBe(
      'Nicht mehr folgen: MTV Wasbüttel'
    );
    expect(seite.textContent).not.toContain('Steht in Meine Teams');
  });

  it('unfollows a followed Team, then offers to follow it again', async () => {
    const auswahl = new LocalSelection(undefined);
    await auswahl.follow(201500);
    await auswahl.follow(MTV_WASBUETTEL);
    const { knopf, seite, leisten, klicken } = await render(auswahl);
    expect(knopf.textContent).toContain('Nicht mehr folgen');

    await klicken();

    expect(auswahl.teams()).toEqual([201500]);
    expect(knopf.textContent).toContain('Team folgen');
    expect(seite.textContent).not.toContain('Steht in Meine Teams');
    expect(await leisten.getHarnessOrNull(MatSnackBarHarness)).toBeNull();
  });

  describe('where the control disappears with the Team (NachEntfolgen)', () => {
    it('offers to undo the unfollowing, and follows the Team again', async () => {
      const auswahl = new LocalSelection(undefined);
      await auswahl.follow(MTV_WASBUETTEL);
      const { leisten, klicken } = await render(auswahl, {
        teamName: 'MTV Wasbüttel',
        verschwindet: true,
      });

      await klicken();

      expect(auswahl.teams()).toEqual([]);
      const leiste = await leisten.getHarness(MatSnackBarHarness);
      expect(await leiste.getMessage()).toBe(
        'MTV Wasbüttel steht nicht mehr in Meine Teams.'
      );
      expect(await leiste.getActionDescription()).toBe('Rückgängig');

      await leiste.dismissWithAction();
      await warten();

      expect(auswahl.teams()).toEqual([MTV_WASBUETTEL]);
    });

    it('puts the Team back at its place in Meine Teams, not at the end', async () => {
      const MTV_GIFHORN = 201500;
      const auswahl = new LocalSelection(mapStorage());
      await auswahl.follow(MTV_WASBUETTEL);
      await auswahl.follow(MTV_GIFHORN);
      const { leisten, klicken } = await render(auswahl, {
        teamName: 'MTV Wasbüttel',
        verschwindet: true,
      });

      await klicken();
      expect(auswahl.teams()).toEqual([MTV_GIFHORN]);
      await (await leisten.getHarness(MatSnackBarHarness)).dismissWithAction();
      await warten();

      expect(auswahl.teams()).toEqual([MTV_WASBUETTEL, MTV_GIFHORN]);
    });

    it('says so where the undo could not be stored', async () => {
      const auswahl: Selection = fakeSelection({
        teams: signal([MTV_WASBUETTEL]),
        follow: () => Promise.reject(new Error('offline')),
      });
      const { leisten, klicken } = await render(auswahl, {
        teamName: 'MTV Wasbüttel',
        verschwindet: true,
      });
      await klicken();

      await (await leisten.getHarness(MatSnackBarHarness)).dismissWithAction();
      await warten();

      const leiste = await leisten.getHarness(MatSnackBarHarness);
      expect(await leiste.getMessage()).toContain(
        'Das ließ sich nicht speichern.'
      );
    });

    it('hands the screen the Team unfollowed, to move focus', async () => {
      const auswahl = new LocalSelection(undefined);
      await auswahl.follow(MTV_WASBUETTEL);
      const { klicken } = await render(auswahl, {
        teamName: 'MTV Wasbüttel',
        verschwindet: true,
      });
      const entfolgt = vi.spyOn(TestBed.inject(NachEntfolgen), 'entfolgt');

      await klicken();

      expect(entfolgt).toHaveBeenCalledWith(
        MTV_WASBUETTEL,
        'MTV Wasbüttel',
        undefined
      );
    });

    it('hands the screen the place the Team had, for the undo', async () => {
      const platz = { since: 7 };
      const auswahl: Selection = fakeSelection({
        teams: signal([MTV_WASBUETTEL]),
        unfollow: () => Promise.resolve(platz),
      });
      const { klicken } = await render(auswahl, {
        teamName: 'MTV Wasbüttel',
        verschwindet: true,
      });
      const entfolgt = vi.spyOn(TestBed.inject(NachEntfolgen), 'entfolgt');

      await klicken();

      expect(entfolgt).toHaveBeenCalledWith(
        MTV_WASBUETTEL,
        'MTV Wasbüttel',
        platz
      );
    });

    it('leaves focus and offers no undo for a control that stays (a Verein list on the screen)', async () => {
      const auswahl = new LocalSelection(undefined);
      await auswahl.follow(MTV_WASBUETTEL);
      const { leisten, klicken } = await render(auswahl, {
        teamName: 'MTV Wasbüttel',
        nachEntfolgen: true,
      });
      const entfolgt = vi.spyOn(TestBed.inject(NachEntfolgen), 'entfolgt');

      await klicken();

      expect(auswahl.teams()).toEqual([]);
      expect(entfolgt).not.toHaveBeenCalled();
      expect(await leisten.getHarnessOrNull(MatSnackBarHarness)).toBeNull();
    });

    it('offers no undo where the unfollowing failed', async () => {
      const auswahl: Selection = fakeSelection({
        teams: signal([MTV_WASBUETTEL]),
        unfollow: () => Promise.reject(new Error('offline')),
      });
      const { seite, leisten, klicken } = await render(auswahl, {
        teamName: 'MTV Wasbüttel',
        verschwindet: true,
      });
      const entfolgt = vi.spyOn(TestBed.inject(NachEntfolgen), 'entfolgt');

      await klicken();

      expect(await leisten.getHarnessOrNull(MatSnackBarHarness)).toBeNull();
      expect(entfolgt).not.toHaveBeenCalled();
      expect(seite.querySelector('[role="alert"]')?.textContent).toContain(
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
    const fixture = TestBed.createComponent(TeamFolgenComponent);
    fixture.componentRef.setInput('teamId', MTV_WASBUETTEL);
    fixture.componentRef.setInput('gefolgt', true);
    await fixture.whenStable();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-qa="team-folgen"]'
      )?.textContent
    ).toContain('Nicht mehr folgen');
  });

  it('says so when the choice could not be stored', async () => {
    const auswahl: Selection = fakeSelection({
      teams: signal([]),
      follow: () => Promise.reject(new Error('offline')),
    });
    const { knopf, seite, klicken } = await render(auswahl);

    await klicken();

    expect(seite.querySelector('[role="alert"]')?.textContent).toContain(
      'Das ließ sich nicht speichern.'
    );
    expect(knopf.textContent).toContain('Team folgen');
  });

  it('asks to reload where a newer version of the app stored Meine Teams', async () => {
    const auswahl: Selection = fakeSelection({
      teams: signal([]),
      follow: () => Promise.reject(new SelectionTooNewError()),
    });
    const { seite, klicken } = await render(auswahl);

    await klicken();

    expect(seite.querySelector('[role="alert"]')?.textContent).toContain(
      'Bitte die App neu laden.'
    );
  });

  it('offers nothing to press before Meine Teams are read', async () => {
    const folgen = vi.fn<Selection['follow']>(() => Promise.resolve());
    const { knopf, seite, klicken } = await render(
      fakeSelection({ teams: signal(undefined), follow: folgen })
    );

    await klicken();

    expect(knopf.disabled).toBe(true);
    expect(knopf.textContent).toContain('Team folgen');
    expect(folgen).not.toHaveBeenCalled();
    expect(seite.textContent).not.toContain('Steht in Meine Teams');
  });
});
