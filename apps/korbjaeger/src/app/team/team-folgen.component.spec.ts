import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL, type Auswahl } from '../auswahl/auswahl';
import { AuswahlZuNeuError } from '../auswahl/auswahl-fehler';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import { NachEntfolgen } from './nach-entfolgen';
import { TeamFolgenComponent } from './team-folgen.component';
import { fakeAuswahl } from '../auswahl/testing/fake-auswahl';

const MTV_WASBUETTEL: TeamId = 313036;

interface Gerendert {
  readonly knopf: HTMLButtonElement;
  readonly seite: HTMLElement;
  /** Clicks the button and waits until the page shows what followed. */
  klicken(): Promise<void>;
}

interface Optionen {
  readonly teamName?: string;
  /** The screen provides `NachEntfolgen`: the control disappears with the Team. */
  readonly verschwindet?: boolean;
}

async function render(
  auswahl: Auswahl,
  { teamName, verschwindet }: Optionen = {}
): Promise<Gerendert> {
  TestBed.configureTestingModule({
    providers: [
      { provide: AUSWAHL, useValue: auswahl },
      ...(verschwindet ? [NachEntfolgen] : []),
    ],
  });
  const fixture = TestBed.createComponent(TeamFolgenComponent);
  fixture.componentRef.setInput('teamId', MTV_WASBUETTEL);
  if (teamName !== undefined) {
    fixture.componentRef.setInput('teamName', teamName);
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
    klicken: async () => {
      knopf.click();
      // the adapter settles in a microtask, the page in the next round
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    },
  };
}

/** The latest snackbar's text and its action, where one is open. */
function snackbar():
  | { text: string; aktion: HTMLButtonElement | null }
  | undefined {
  const leiste = [...document.querySelectorAll('mat-snack-bar-container')].at(
    -1
  );
  if (leiste === undefined) {
    return undefined;
  }
  return {
    text: leiste.textContent ?? '',
    aktion: leiste.querySelector('button'),
  };
}

async function warten(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
}

describe('TeamFolgenComponent', () => {
  afterEach(() => {
    TestBed.inject(MatSnackBar).dismiss();
  });

  it('offers to follow a Team not followed yet', async () => {
    const { knopf } = await render(new LokaleAuswahl(undefined));

    expect(knopf.textContent).toContain('Team folgen');
    expect(knopf.hasAttribute('aria-pressed')).toBe(false);
  });

  it('follows the Team, then says so and offers to unfollow it', async () => {
    const auswahl = new LokaleAuswahl(undefined);
    const { knopf, seite, klicken } = await render(auswahl);

    await klicken();

    expect(auswahl.teams()).toEqual([MTV_WASBUETTEL]);
    expect(knopf.textContent).toContain('Nicht mehr folgen');
    expect(knopf.textContent).not.toContain('Team folgen');
    expect(seite.textContent).toContain('Du folgst diesem Team.');
    expect(seite.textContent).toContain('Steht in Meine Teams');
  });

  it('names the Team in its label in a list, without the hint', async () => {
    const auswahl = new LokaleAuswahl(undefined);
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
    const auswahl = new LokaleAuswahl(undefined);
    await auswahl.folgen(201500);
    await auswahl.folgen(MTV_WASBUETTEL);
    const { knopf, seite, klicken } = await render(auswahl);
    expect(knopf.textContent).toContain('Nicht mehr folgen');

    await klicken();

    expect(auswahl.teams()).toEqual([201500]);
    expect(knopf.textContent).toContain('Team folgen');
    expect(seite.textContent).not.toContain('Steht in Meine Teams');
    expect(snackbar()).toBeUndefined();
  });

  describe('where the control disappears with the Team (NachEntfolgen)', () => {
    it('offers to undo the unfollowing, and follows the Team again', async () => {
      const auswahl = new LokaleAuswahl(undefined);
      await auswahl.folgen(MTV_WASBUETTEL);
      const { klicken } = await render(auswahl, {
        teamName: 'MTV Wasbüttel',
        verschwindet: true,
      });

      await klicken();

      expect(auswahl.teams()).toEqual([]);
      expect(snackbar()?.text).toContain(
        'MTV Wasbüttel steht nicht mehr in Meine Teams.'
      );
      expect(snackbar()?.aktion?.textContent).toContain('Rückgängig');

      snackbar()?.aktion?.click();
      await warten();

      expect(auswahl.teams()).toEqual([MTV_WASBUETTEL]);
    });

    it('says so where the undo could not be stored', async () => {
      const auswahl: Auswahl = fakeAuswahl({
        teams: signal([MTV_WASBUETTEL]),
        folgen: () => Promise.reject(new Error('offline')),
      });
      const { klicken } = await render(auswahl, {
        teamName: 'MTV Wasbüttel',
        verschwindet: true,
      });
      await klicken();

      snackbar()?.aktion?.click();
      await warten();
      await warten();

      expect(snackbar()?.text).toContain('Das ließ sich nicht speichern.');
    });

    it('hands the screen the Team unfollowed, to move focus', async () => {
      const auswahl = new LokaleAuswahl(undefined);
      await auswahl.folgen(MTV_WASBUETTEL);
      const { klicken } = await render(auswahl, {
        teamName: 'MTV Wasbüttel',
        verschwindet: true,
      });
      const entfolgt = vi.spyOn(TestBed.inject(NachEntfolgen), 'entfolgt');

      await klicken();

      expect(entfolgt).toHaveBeenCalledWith(MTV_WASBUETTEL, 'MTV Wasbüttel');
    });

    it('offers no undo where the unfollowing failed', async () => {
      const auswahl: Auswahl = fakeAuswahl({
        teams: signal([MTV_WASBUETTEL]),
        entfolgen: () => Promise.reject(new Error('offline')),
      });
      const { seite, klicken } = await render(auswahl, {
        teamName: 'MTV Wasbüttel',
        verschwindet: true,
      });
      const entfolgt = vi.spyOn(TestBed.inject(NachEntfolgen), 'entfolgt');

      await klicken();

      expect(snackbar()).toBeUndefined();
      expect(entfolgt).not.toHaveBeenCalled();
      expect(seite.querySelector('[role="alert"]')?.textContent).toContain(
        'Das ließ sich nicht speichern.'
      );
    });
  });
  it('takes whether the Team is followed from the screen, where it knows', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: AUSWAHL, useValue: new LokaleAuswahl(undefined) }],
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
    const auswahl: Auswahl = fakeAuswahl({
      teams: signal([]),
      folgen: () => Promise.reject(new Error('offline')),
    });
    const { knopf, seite, klicken } = await render(auswahl);

    await klicken();

    expect(seite.querySelector('[role="alert"]')?.textContent).toContain(
      'Das ließ sich nicht speichern.'
    );
    expect(knopf.textContent).toContain('Team folgen');
  });

  it('asks to reload where a newer version of the app stored Meine Teams', async () => {
    const auswahl: Auswahl = fakeAuswahl({
      teams: signal([]),
      folgen: () => Promise.reject(new AuswahlZuNeuError()),
    });
    const { seite, klicken } = await render(auswahl);

    await klicken();

    expect(seite.querySelector('[role="alert"]')?.textContent).toContain(
      'Bitte die App neu laden.'
    );
  });

  it('offers nothing to press before Meine Teams are read', async () => {
    const folgen = vi.fn<Auswahl['folgen']>(() => Promise.resolve());
    const { knopf, seite, klicken } = await render(
      fakeAuswahl({ teams: signal(undefined), folgen })
    );

    await klicken();

    expect(knopf.disabled).toBe(true);
    expect(knopf.textContent).toContain('Team folgen');
    expect(folgen).not.toHaveBeenCalled();
    expect(seite.textContent).not.toContain('Steht in Meine Teams');
  });
});
