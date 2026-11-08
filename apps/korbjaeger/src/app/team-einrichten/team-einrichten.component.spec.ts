import { Component, signal } from '@angular/core';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { provideRouter, Router } from '@angular/router';
import {
  BasketballDataError,
  DbbBasketballData,
  dbbHttpRequest,
  type DbbTransport,
} from '@wolsok/feat-shared-basketball-data';
import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing';
import { AUSWAHL, type Auswahl } from '../auswahl/auswahl';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import { TeamEinrichtenComponent } from './team-einrichten.component';

/** The DBB as the recorded fixtures answer it (`fakeDbbAnswer`). */
const recordedDbb: DbbTransport = async (request) => {
  const call = dbbHttpRequest(request);
  const answer = fakeDbbAnswer(
    call.method,
    call.path,
    call.method === 'POST' ? JSON.stringify(call.body) : undefined
  );
  if (answer === undefined) {
    throw new Error(`not recorded: ${call.method} ${call.path}`);
  }
  return answer;
};

@Component({ template: '' })
class TeamSeiteAttrappe {}

interface Assistent {
  readonly fixture: ComponentFixture<TeamEinrichtenComponent>;
  readonly seite: HTMLElement;
  readonly auswahl: Auswahl;
  /** The choices of the select `name` (`verband`, `altersklasse`, ...). */
  optionen(name: string): Promise<string[]>;
  /** Picks the choice `text` of the select `name`. */
  waehlen(name: string, text: string): Promise<void>;
  /** Whether the select `name` is shown. */
  zeigt(name: string): Promise<boolean>;
  /** The texts of the list items `name` (`liga`, `team`). */
  eintraege(name: string): string[];
  /** Taps the list item `name` that reads `text`. */
  tippen(name: string, text: string): Promise<void>;
  /** The button that reads `text`, if shown. */
  knopf(text: string): Promise<MatButtonHarness | undefined>;
  /** Waits for the reads and the page. */
  stabil(): Promise<void>;
}

async function render(
  data: KorbjaegerData = new DbbBasketballData(recordedDbb),
  auswahl: Auswahl = new LokaleAuswahl(undefined)
): Promise<Assistent> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'team/:id', component: TeamSeiteAttrappe }]),
      { provide: BASKETBALL_DATA, useValue: data },
      { provide: AUSWAHL, useValue: auswahl },
    ],
  });
  const fixture = TestBed.createComponent(TeamEinrichtenComponent);
  const loader: HarnessLoader = TestbedHarnessEnvironment.loader(fixture);
  const seite = fixture.nativeElement as HTMLElement;
  const select = (name: string): HTMLElement | null =>
    seite.querySelector<HTMLElement>(`mat-select[data-qa="${name}"]`);
  /** Opens the select `name` and gives its options in the overlay. */
  const oeffnen = async (name: string): Promise<HTMLElement[]> => {
    const trigger = select(name)?.querySelector<HTMLElement>(
      '.mat-mdc-select-trigger'
    );
    if (trigger === undefined || trigger === null) {
      throw new Error(`no select ${name}`);
    }
    trigger.click();
    await fixture.whenStable();
    const panel = document.getElementById(
      select(name)?.getAttribute('aria-controls') ?? ''
    );
    return [...(panel?.querySelectorAll<HTMLElement>('mat-option') ?? [])];
  };
  const schliessen = async (): Promise<void> => {
    document
      .querySelector('.cdk-overlay-backdrop')
      ?.dispatchEvent(new MouseEvent('click'));
    await fixture.whenStable();
  };
  const stabil = async (): Promise<void> => {
    // the adapter settles in microtasks, the page in the next round
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const eintraege = (name: string): HTMLElement[] => [
    ...seite.querySelectorAll<HTMLElement>(`[data-qa="${name}"]`),
  ];
  await stabil();
  return {
    fixture,
    seite,
    auswahl,
    optionen: async (name) => {
      const optionen = (await oeffnen(name)).map(textOf);
      await schliessen();
      return optionen;
    },
    waehlen: async (name, text) => {
      const option = (await oeffnen(name)).find(
        (element) => textOf(element) === text
      );
      if (option === undefined) {
        throw new Error(`no option ${text} in ${name}`);
      }
      option.click();
      await stabil();
    },
    zeigt: async (name) => select(name) !== null,
    eintraege: (name) => eintraege(name).map(textOf),
    tippen: async (name, text) => {
      const eintrag = eintraege(name).find((element) =>
        textOf(element).startsWith(text)
      );
      if (eintrag === undefined) {
        throw new Error(`no ${name} ${text}`);
      }
      eintrag.click();
      await stabil();
    },
    knopf: async (text) =>
      (await loader.getAllHarnesses(MatButtonHarness.with({ text })))[0],
    stabil,
  };
}

/** What `element` reads, a space between its parts, icons left out. */
function textOf(element: Element | null): string {
  if (element === null) {
    return '';
  }
  const texte: string[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.parentElement?.closest('mat-icon') === null) {
      texte.push(node.textContent ?? '');
    }
  }
  return texte.join(' ').replace(/\s+/g, ' ').trim();
}

/** Picks Niedersachsen, U12 and Jugend männlich. */
async function bisZurLiga(assistent: Assistent): Promise<void> {
  await assistent.waehlen('verband', 'Niedersachsen');
  await assistent.waehlen('altersklasse', 'U12');
  await assistent.waehlen('geschlecht', 'Jugend männlich');
}

/** Opens the second page of Ligen and picks Team 313036's Vorrunde. */
async function bisZumTeam(assistent: Assistent): Promise<void> {
  await bisZurLiga(assistent);
  await (await assistent.knopf('Weitere Ligen'))?.click();
  await assistent.stabil();
  await assistent.tippen('liga', 'Regionsvorrunde Nord Braunschweig mu12');
}

describe('TeamEinrichtenComponent', () => {
  it('offers each Verband that has Ligen, and nothing else yet', async () => {
    const assistent = await render();

    const verbaende = await assistent.optionen('verband');

    expect(verbaende).toHaveLength(23);
    expect(verbaende).toContain('Niedersachsen');
    expect(await assistent.zeigt('altersklasse')).toBe(false);
  });

  it('offers only the age groups the Verband has', async () => {
    const assistent = await render();

    await assistent.waehlen('verband', 'Niedersachsen');

    const altersklassen = await assistent.optionen('altersklasse');
    expect(altersklassen).toContain('U12');
    expect(altersklassen).not.toContain('U19');
    expect(await assistent.zeigt('geschlecht')).toBe(false);
  });

  it('offers the genders of the age group, then its Ligen', async () => {
    const assistent = await render();
    await assistent.waehlen('verband', 'Niedersachsen');
    await assistent.waehlen('altersklasse', 'U12');

    expect(await assistent.optionen('geschlecht')).toEqual([
      'Jugend männlich',
      'Jugend weiblich',
    ]);
    expect(assistent.eintraege('liga')).toEqual([]);

    await assistent.waehlen('geschlecht', 'Jugend männlich');

    const ligen = assistent.eintraege('liga');
    expect(ligen).toHaveLength(10);
    expect(ligen[0]).toBe('Landesliga U12 Nord Landesliga');
    expect(ligen[3]).toBe(
      'Regionsliga Braunschweig mu12 Regionsliga · Region Braunschweig'
    );
  });

  it('pages through the Ligen until there are no more', async () => {
    const assistent = await render();
    await bisZurLiga(assistent);

    await (await assistent.knopf('Weitere Ligen'))?.click();
    await assistent.stabil();
    expect(assistent.eintraege('liga')).toHaveLength(20);

    await (await assistent.knopf('Weitere Ligen'))?.click();
    await assistent.stabil();
    expect(assistent.eintraege('liga')).toHaveLength(28);
    expect(await assistent.knopf('Weitere Ligen')).toBeUndefined();
  });

  it('lists every Team of the picked Liga', async () => {
    const assistent = await render();

    await bisZumTeam(assistent);

    expect(assistent.eintraege('liga')).toEqual([]);
    expect(
      textOf(assistent.seite.querySelector('[data-qa="gewaehlte-liga"]'))
    ).toContain('Regionsvorrunde Nord Braunschweig mu12');
    expect(assistent.eintraege('team')).toEqual([
      'MTV Gifhorn',
      'MTV Wasbüttel -RST-',
      'SV Groß Oesingen -RST-',
      'SV Groß Schwülper',
      'TuS Müden-Dieckhorst -RST/aK-',
      'TV Jahn Wolfsburg Honeybadgers -RST-',
    ]);
  });

  it('follows the tapped Team and opens its page', async () => {
    const assistent = await render();
    await bisZumTeam(assistent);

    await assistent.tippen('team', 'MTV Wasbüttel -RST-');

    expect(assistent.auswahl.teams()).toEqual([313036]);
    expect(TestBed.inject(Router).url).toBe('/team/313036');
  });

  it('opens a Team already followed without following it twice', async () => {
    const auswahl = new LokaleAuswahl(undefined);
    await auswahl.folgen(313036);
    const assistent = await render(undefined, auswahl);
    await bisZumTeam(assistent);

    expect(assistent.eintraege('team')).toContain(
      'MTV Wasbüttel -RST- Folgst du schon'
    );
    await assistent.tippen('team', 'MTV Wasbüttel -RST-');

    expect(auswahl.teams()).toEqual([313036]);
    expect(TestBed.inject(Router).url).toBe('/team/313036');
  });

  it('stays and says so when the Team could not be followed', async () => {
    const auswahl: Auswahl = {
      teams: signal([]),
      folgen: () => Promise.reject(new Error('offline')),
      entfolgen: () => Promise.resolve(),
    };
    const assistent = await render(undefined, auswahl);
    await bisZumTeam(assistent);

    await assistent.tippen('team', 'MTV Wasbüttel -RST-');

    expect(TestBed.inject(Router).url).toBe('/');
    expect(textOf(assistent.seite.querySelector('[role="alert"]'))).not.toBe(
      ''
    );
  });

  it('offers no Team before Meine Teams are read', async () => {
    const auswahl: Auswahl = {
      teams: signal(undefined),
      folgen: () => Promise.resolve(),
      entfolgen: () => Promise.resolve(),
    };
    const assistent = await render(undefined, auswahl);

    await bisZumTeam(assistent);

    const knoepfe = assistent.seite.querySelectorAll<HTMLButtonElement>(
      'button[data-qa="team"]'
    );
    expect(knoepfe).toHaveLength(6);
    expect([...knoepfe].every((knopf) => knopf.disabled)).toBe(true);
  });

  it('starts over below a pick that changed', async () => {
    const assistent = await render();
    await bisZumTeam(assistent);

    await assistent.waehlen('verband', 'Bayern');

    expect(await assistent.zeigt('geschlecht')).toBe(false);
    expect(assistent.eintraege('liga')).toEqual([]);
    expect(assistent.eintraege('team')).toEqual([]);
  });

  it('says so when the DBB cannot be reached', async () => {
    const assistent = await render(
      new DbbBasketballData(async () => {
        throw new BasketballDataError('unavailable', 'DBB down');
      })
    );

    expect(textOf(assistent.seite.querySelector('[role="alert"]'))).toContain(
      'Der DBB ist gerade nicht erreichbar.'
    );
  });
});
