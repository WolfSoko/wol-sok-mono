import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL, type Auswahl } from '../auswahl/auswahl';
import { AuswahlZuNeuError } from '../auswahl/auswahl-fehler';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import { TeamFolgenComponent } from './team-folgen.component';

const MTV_WASBUETTEL: TeamId = 313036;

interface Gerendert {
  readonly knopf: HTMLButtonElement;
  readonly seite: HTMLElement;
  /** Clicks the button and waits until the page shows what followed. */
  klicken(): Promise<void>;
}

async function render(auswahl: Auswahl): Promise<Gerendert> {
  TestBed.configureTestingModule({
    providers: [{ provide: AUSWAHL, useValue: auswahl }],
  });
  const fixture = TestBed.createComponent(TeamFolgenComponent);
  fixture.componentRef.setInput('teamId', MTV_WASBUETTEL);
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
    const auswahl: Auswahl = {
      teams: signal([]),
      folgen: () => Promise.reject(new Error('offline')),
      entfolgen: () => Promise.resolve(),
    };
    const { knopf, seite, klicken } = await render(auswahl);

    await klicken();

    expect(seite.querySelector('[role="alert"]')?.textContent).toContain(
      'Das ließ sich nicht speichern.'
    );
    expect(knopf.getAttribute('aria-pressed')).toBe('false');
  });

  it('asks to reload where a newer version of the app stored Meine Teams', async () => {
    const auswahl: Auswahl = {
      teams: signal([]),
      folgen: () => Promise.reject(new AuswahlZuNeuError()),
      entfolgen: () => Promise.resolve(),
    };
    const { seite, klicken } = await render(auswahl);

    await klicken();

    expect(seite.querySelector('[role="alert"]')?.textContent).toContain(
      'Bitte die App neu laden.'
    );
  });
});
