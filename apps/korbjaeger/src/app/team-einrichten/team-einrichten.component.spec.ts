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
  type LigaSeite,
  type LigaSuche,
  type LigaSucheFilter,
  type ReadOptions,
  type ReadSignal,
} from '@wolsok/feat-shared-basketball-data';
import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing';
import { AUSWAHL, type Auswahl } from '../auswahl/auswahl';
import { LokaleAuswahl } from '../auswahl/lokale-auswahl';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import { TeamEinrichtenComponent } from './team-einrichten.component';
import { fakeAuswahl } from '../auswahl/testing/fake-auswahl';

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

/** The recorded DBB, whose later pages of Ligen never come. */
class HaengendeSeiten extends DbbBasketballData {
  /** The signal of each later page asked for. */
  public readonly signale: ReadSignal[] = [];

  public constructor() {
    super(recordedDbb);
  }

  public override ligaSeite(
    _filter: LigaSucheFilter,
    _startIndex: number,
    options?: ReadOptions
  ): Promise<LigaSeite> {
    if (options?.signal !== undefined) {
      this.signale.push(options.signal);
    }
    return new Promise(() => undefined);
  }
}

/** The recorded DBB, whose search finds nothing where `leer` holds. */
class OhneFacetten extends DbbBasketballData {
  public constructor(
    private readonly leer: (filter: LigaSucheFilter) => boolean
  ) {
    super(recordedDbb);
  }

  public override ligaSuche(
    filter: LigaSucheFilter,
    options?: ReadOptions
  ): Promise<LigaSuche> {
    return this.leer(filter)
      ? Promise.resolve({
          facetten: {
            verbaende: [],
            altersklassen: [],
            altersgruppenGeschlechter: [],
          },
          ersteSeite: { startIndex: 0, ligen: [], weitere: false },
        })
      : super.ligaSuche(filter, options);
  }
}

/** The texts of the alerts within the element `qa` names. */
function alarme(seite: HTMLElement, qa: string): string[] {
  return [...seite.querySelectorAll(`[data-qa="${qa}"] [role="alert"]`)].map(
    textOf
  );
}

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
    const auswahl: Auswahl = fakeAuswahl({
      teams: signal([]),
      folgen: () => Promise.reject(new Error('offline')),
    });
    const assistent = await render(undefined, auswahl);
    await bisZumTeam(assistent);

    await assistent.tippen('team', 'MTV Wasbüttel -RST-');

    expect(TestBed.inject(Router).url).toBe('/');
    expect(textOf(assistent.seite.querySelector('[role="alert"]'))).not.toBe(
      ''
    );
  });

  it('offers no Team before Meine Teams are read', async () => {
    const auswahl: Auswahl = fakeAuswahl({
      teams: signal(undefined),
    });
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

  it('follows one Team only when two are tapped at once', async () => {
    const assistent = await render();
    await bisZumTeam(assistent);

    const knoepfe = assistent.seite.querySelectorAll<HTMLButtonElement>(
      'button[data-qa="team"]'
    );
    knoepfe[1].click();
    knoepfe[0].click();
    await assistent.stabil();

    expect(assistent.auswahl.teams()).toEqual([313036]);
    expect(TestBed.inject(Router).url).toBe('/team/313036');
  });

  it('cancels a later page of Ligen when a pick changes', async () => {
    const data = new HaengendeSeiten();
    const assistent = await render(data);
    await bisZurLiga(assistent);
    await (await assistent.knopf('Weitere Ligen'))?.click();
    expect(data.signale).toHaveLength(1);
    expect(data.signale[0].aborted).toBe(false);

    await assistent.waehlen('geschlecht', 'Jugend weiblich');

    expect(data.signale[0].aborted).toBe(true);
  });

  it('cancels a later page of Ligen when the page is left', async () => {
    const data = new HaengendeSeiten();
    const assistent = await render(data);
    await bisZurLiga(assistent);
    await (await assistent.knopf('Weitere Ligen'))?.click();

    assistent.fixture.destroy();

    expect(data.signale[0].aborted).toBe(true);
  });

  it('keeps the pages of Ligen read when another Liga is wanted', async () => {
    const assistent = await render();
    await bisZumTeam(assistent);

    await (await assistent.knopf('Andere Liga'))?.click();
    await assistent.stabil();

    expect(assistent.eintraege('liga')).toHaveLength(20);
    expect(assistent.eintraege('team')).toEqual([]);
  });

  it('says at the first step when the DBB finds no such search', async () => {
    const assistent = await render(
      new DbbBasketballData(async () => {
        throw new BasketballDataError('not-found', 'DBB: status 1');
      })
    );

    expect(alarme(assistent.seite, 'schritt-verband')).toEqual([
      'Für diese Auswahl kennt der DBB keine Ligen.',
    ]);
  });

  it('says so when the DBB names no Verband', async () => {
    const assistent = await render(new OhneFacetten(() => true));

    expect(
      textOf(assistent.seite.querySelector('[data-qa="schritt-verband"]'))
    ).toContain('Der DBB nennt gerade keine Verbände.');
    expect(await assistent.zeigt('verband')).toBe(false);
  });

  it('says so when a Verband has no age group', async () => {
    const assistent = await render(
      new OhneFacetten((filter) => filter.verbandIds.length > 0)
    );

    await assistent.waehlen('verband', 'Niedersachsen');

    expect(
      textOf(assistent.seite.querySelector('[data-qa="schritt-alter"]'))
    ).toContain('Für diesen Verband kennt der DBB keine Ligen.');
    expect(await assistent.zeigt('altersklasse')).toBe(false);
  });

  it('says at the step that failed why, until its pick changes', async () => {
    const assistent = await render();
    await assistent.waehlen('verband', 'Niedersachsen');

    // the fixtures have no search for Niedersachsen's U14
    await assistent.waehlen('altersklasse', 'U14');
    expect(alarme(assistent.seite, 'schritt-alter')).toEqual([
      'Der DBB ist gerade nicht erreichbar. Bitte später noch einmal versuchen.',
    ]);

    await assistent.waehlen('altersklasse', 'U12');
    expect(alarme(assistent.seite, 'schritt-alter')).toEqual([]);
    expect(assistent.seite.querySelectorAll('[role="alert"]')).toHaveLength(0);
  });
});
