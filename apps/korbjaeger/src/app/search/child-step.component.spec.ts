import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BasketballDataError } from '@wolsok/feat-shared-basketball-data';
import { LokaleAuswahl } from '@wolsok/feat-korbjaeger-auswahl';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import { JETZT } from '../jetzt';
import {
  inLigaWithoutGameReports,
  saisonOf,
  spielOn,
  WASBUETTEL_RST,
} from '../../testing/team-saison';
import { ChildStepComponent } from './child-step.component';

type TeamSpieleRead = KorbjaegerData['teamGames'];

const JETZT_IM_SPEC = Date.parse('2026-11-08T12:00:00+01:00');
const WASBUETTEL = WASBUETTEL_RST;

async function render(
  read: TeamSpieleRead,
  { followed = true }: { followed?: boolean } = {}
): Promise<{
  page: HTMLElement;
  teamGames: ReturnType<typeof vi.fn<TeamSpieleRead>>;
}> {
  const teamGames = vi.fn<TeamSpieleRead>(read);
  // in memory: nothing reaches the device's storage
  const auswahl = new LokaleAuswahl(undefined);
  if (followed) {
    await auswahl.folgen(WASBUETTEL.id);
  }
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BASKETBALL_DATA, useValue: { teamGames } },
      { provide: AUSWAHL, useValue: auswahl },
      { provide: JETZT, useValue: signal(JETZT_IM_SPEC) },
    ],
  });
  const fixture = TestBed.createComponent(ChildStepComponent);
  fixture.componentRef.setInput('teamId', WASBUETTEL.id);
  fixture.componentRef.setInput('teamName', WASBUETTEL.name);
  await fixture.whenStable();
  return { page: fixture.nativeElement as HTMLElement, teamGames };
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('ChildStepComponent', () => {
  it("links a followed Team's last played Spiel, to mark the Kind there", async () => {
    const { page, teamGames } = await render(async () =>
      saisonOf(
        spielOn(2861436, '2026-09-20'),
        spielOn(2861440, '2026-10-04'),
        spielOn(2861450, '2026-11-15', { kind: 'scheduled' })
      )
    );

    expect(teamGames).toHaveBeenCalledWith(WASBUETTEL.id, expect.anything());
    const link = page.querySelector('[data-qa="child-step-mark"]');
    expect(link?.getAttribute('href')).toBe('/spiel/2861440');
    expect(link?.getAttribute('aria-label')).toBe(
      'Kind im Kader markieren: MTV Wasbüttel -RST-'
    );
  });

  it('says the Kind can be marked after its first Spiel where none was played', async () => {
    const { page } = await render(async () =>
      saisonOf(spielOn(2861450, '2026-11-15', { kind: 'scheduled' }))
    );

    expect(page.querySelector('[data-qa="child-step-mark"]')).toBeNull();
    expect(
      text(page.querySelector('[data-qa="child-step-after-first-game"]'))
    ).toBe(
      'Dein Kind kannst du markieren, sobald es nach seinem ersten Spiel in einem Spielbericht steht.'
    );
  });

  it('says the Kind cannot be marked where the Liga keeps no Spielberichte', async () => {
    const { page } = await render(async () =>
      inLigaWithoutGameReports(saisonOf(spielOn(2970229, '2026-10-04')))
    );

    expect(page.querySelector('[data-qa="child-step-mark"]')).toBeNull();
    expect(
      text(page.querySelector('[data-qa="child-step-no-game-reports"]'))
    ).toBe(
      'Für die Liga dieses Teams führt der DBB keine Spielberichte. Dein Kind kannst du hier deshalb nicht markieren.'
    );
  });

  it('says how old the Spiele are where the last good answer stood in', async () => {
    const { page } = await render(async (_, options) => {
      options?.lesung?.ersetzt({
        gespeichertAm: JETZT_IM_SPEC - 2 * 60 * 60_000,
        grund: 'keine-verbindung',
      });
      return saisonOf(spielOn(2861436, '2026-09-20'));
    });

    expect(text(page.querySelector('[data-qa="child-step-stand"]'))).toContain(
      'Stand: vor 2 Std.'
    );
    expect(
      page.querySelector('[data-qa="child-step-mark"]')?.getAttribute('href')
    ).toBe('/spiel/2861436');
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
    const { page, teamGames } = await render(async () => saisonOf(), {
      followed: false,
    });

    expect(teamGames).not.toHaveBeenCalled();
    expect(text(page)).toBe('');
  });
});
