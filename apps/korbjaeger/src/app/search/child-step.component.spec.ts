import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  type Spiel,
  type TeamSaison,
} from '@wolsok/feat-shared-basketball-data';
import { LokaleAuswahl } from '@wolsok/feat-korbjaeger-auswahl';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import { JETZT } from '../jetzt';
import { ChildStepComponent } from './child-step.component';

type TeamSpieleRead = KorbjaegerData['teamSpiele'];

const JETZT_IM_SPEC = Date.parse('2026-11-08T12:00:00+01:00');
const WASBUETTEL = { id: 313036, name: 'MTV Wasbüttel -RST-', vereinId: 1837 };
const GIFHORN = { id: 201500, name: 'MTV Gifhorn', vereinId: 201500 };

function spiel(id: number, datum: string, played: boolean): Spiel {
  return {
    id,
    ligaId: 54862,
    spieltag: 1,
    datum,
    heim: { art: 'team', team: WASBUETTEL },
    gast: { art: 'team', team: GIFHORN },
    status: played
      ? { art: 'gespielt', ergebnis: { heim: 78, gast: 47 }, bestaetigt: true }
      : { art: 'geplant' },
  };
}

function saison(...spiele: Spiel[]): TeamSaison {
  return {
    team: WASBUETTEL,
    verein: { id: 1837, name: 'MTV Wasbüttel' },
    ligen: [],
    spiele,
  };
}

async function render(
  read: TeamSpieleRead,
  { followed = true }: { followed?: boolean } = {}
): Promise<{
  page: HTMLElement;
  teamSpiele: ReturnType<typeof vi.fn<TeamSpieleRead>>;
}> {
  const teamSpiele = vi.fn<TeamSpieleRead>(read);
  // in memory: nothing reaches the device's storage
  const auswahl = new LokaleAuswahl(undefined);
  if (followed) {
    await auswahl.folgen(WASBUETTEL.id);
  }
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BASKETBALL_DATA, useValue: { teamSpiele } },
      { provide: AUSWAHL, useValue: auswahl },
      { provide: JETZT, useValue: signal(JETZT_IM_SPEC) },
    ],
  });
  const fixture = TestBed.createComponent(ChildStepComponent);
  fixture.componentRef.setInput('teamId', WASBUETTEL.id);
  fixture.componentRef.setInput('teamName', WASBUETTEL.name);
  await fixture.whenStable();
  return { page: fixture.nativeElement as HTMLElement, teamSpiele };
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('ChildStepComponent', () => {
  it("links a followed Team's last played Spiel, to mark the Kind there", async () => {
    const { page, teamSpiele } = await render(async () =>
      saison(
        spiel(2861436, '2026-09-20', true),
        spiel(2861440, '2026-10-04', true),
        spiel(2861450, '2026-11-15', false)
      )
    );

    expect(teamSpiele).toHaveBeenCalledWith(WASBUETTEL.id, expect.anything());
    const link = page.querySelector('[data-qa="child-step-mark"]');
    expect(link?.getAttribute('href')).toBe('/spiel/2861440');
    expect(link?.getAttribute('aria-label')).toBe(
      'Kind im Kader markieren: MTV Wasbüttel -RST-'
    );
  });

  it('says the Kind can be marked after its first Spiel where none was played', async () => {
    const { page } = await render(async () =>
      saison(spiel(2861450, '2026-11-15', false))
    );

    expect(page.querySelector('[data-qa="child-step-mark"]')).toBeNull();
    expect(
      text(page.querySelector('[data-qa="child-step-after-first-game"]'))
    ).toBe(
      'Dein Kind kannst du markieren, sobald es nach seinem ersten Spiel in einem Spielbericht steht.'
    );
  });

  it('says why the Spiele could not be read', async () => {
    const { page } = await render(async () => {
      throw new BasketballDataError('unavailable', 'DBB down');
    });

    expect(text(page.querySelector('[data-qa="child-step-failure"]'))).toBe(
      'Der DBB ist gerade nicht erreichbar. Bitte später noch einmal versuchen.'
    );
  });

  it('shows and reads nothing for a Team not followed', async () => {
    const { page, teamSpiele } = await render(async () => saison(), {
      followed: false,
    });

    expect(teamSpiele).not.toHaveBeenCalled();
    expect(text(page)).toBe('');
  });
});
