import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL, type Auswahl } from '../auswahl/auswahl';
import { AuswahlZuNeuError } from '../auswahl/auswahl-fehler';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import { TeamFolgenComponent } from './team-folgen.component';
import { fakeAuswahl } from '../auswahl/testing/fake-auswahl';

const MTV_WASBUETTEL: TeamId = 313036;

interface Gerendert {
  readonly knopf: HTMLButtonElement;
  readonly seite: HTMLElement;
  /** Clicks the button and waits until the page shows what followed. */
  klicken(): Promise<void>;
}

async function render(auswahl: Auswahl, teamName?: string): Promise<Gerendert> {
  TestBed.configureTestingModule({
    providers: [{ provide: AUSWAHL, useValue: auswahl }],
  });
  const fixture = TestBed.createComponent(TeamFolgenComponent);
  fixture.componentRef.setInput('teamId', MTV_WASBUETTEL);
  if (teamName !== undefined) {
    fixture.componentRef.setInput('teamName', teamName);
  }
  await fixture.whenStable();
  const seite = fixture.nativeElement as HTMLElement;
  const knopf = seite.querySelector('button');
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

describe('TeamFolgenComponent', () => {
  it('offers to follow a Team not followed yet', async () => {
    const { knopf } = await render(new LokaleAuswahl(undefined));

    expect(knopf.textContent).toContain('Team folgen');
    expect(knopf.getAttribute('aria-pressed')).toBe('false');
  });

  it('follows the Team, then shows it as followed', async () => {
    const auswahl = new LokaleAuswahl(undefined);
    const { knopf, seite, klicken } = await render(auswahl);

    await klicken();

    expect(auswahl.teams()).toEqual([MTV_WASBUETTEL]);
    expect(knopf.getAttribute('aria-pressed')).toBe('true');
    expect(seite.textContent).toContain('Steht in Meine Teams');
  });

  it('names the Team in its label in a list, without the hint', async () => {
    const auswahl = new LokaleAuswahl(undefined);
    const { knopf, seite, klicken } = await render(auswahl, 'MTV Wasbüttel');
    expect(knopf.getAttribute('aria-label')).toBe('Team folgen: MTV Wasbüttel');

    await klicken();

    expect(knopf.getAttribute('aria-pressed')).toBe('true');
    expect(seite.textContent).not.toContain('Steht in Meine Teams');
  });

  it('shows a followed Team as followed, and unfollows it', async () => {
    const auswahl = new LokaleAuswahl(undefined);
    await auswahl.folgen(201500);
    await auswahl.folgen(MTV_WASBUETTEL);
    const { knopf, seite, klicken } = await render(auswahl);
    expect(knopf.getAttribute('aria-pressed')).toBe('true');

    await klicken();

    expect(auswahl.teams()).toEqual([201500]);
    expect(knopf.getAttribute('aria-pressed')).toBe('false');
    expect(seite.textContent).not.toContain('Steht in Meine Teams');
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
    expect(knopf.getAttribute('aria-pressed')).toBe('false');
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
    expect(knopf.hasAttribute('aria-pressed')).toBe(false);
    expect(folgen).not.toHaveBeenCalled();
    expect(seite.textContent).not.toContain('Steht in Meine Teams');
  });
});
