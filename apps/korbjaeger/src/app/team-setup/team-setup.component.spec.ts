import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { Component, signal } from '@angular/core';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { provideRouter, Router } from '@angular/router';
import {
  BasketballDataError,
  DbbBasketballData,
  type LeaguePage,
  type LeagueSearch,
  type LeagueSearchFilter,
  type ReadOptions,
  type ReadSignal,
} from '@wolsok/feat-shared-basketball-data';
import { recordedDbbTransport } from '@wolsok/feat-shared-basketball-data/testing';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  type Selection,
  LocalSelection,
} from '@wolsok/feat-korbjaeger-selection';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from '../basketball-data/basketball-data.provider';
import { TeamSetupComponent } from './team-setup.component';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';

@Component({ template: '' })
class TeamPageStub {}

/** The recorded DBB, whose later pages of Ligen never come. */
class HangingPages extends DbbBasketballData {
  /** The signal of each later page asked for. */
  public readonly signale: ReadSignal[] = [];

  public constructor() {
    super(recordedDbbTransport);
  }

  public override leaguePage(
    _filter: LeagueSearchFilter,
    _startIndex: number,
    options?: ReadOptions
  ): Promise<LeaguePage> {
    if (options?.signal !== undefined) {
      this.signale.push(options.signal);
    }
    return new Promise(() => undefined);
  }
}

/** The recorded DBB, whose search finds nothing where `empty` holds. */
class WithoutFacets extends DbbBasketballData {
  public constructor(
    private readonly leer: (filter: LeagueSearchFilter) => boolean
  ) {
    super(recordedDbbTransport);
  }

  public override leagueSearch(
    filter: LeagueSearchFilter,
    options?: ReadOptions
  ): Promise<LeagueSearch> {
    return this.leer(filter)
      ? Promise.resolve({
          facets: {
            associations: [],
            ageGroups: [],
            ageGroupGenders: [],
          },
          firstPage: { startIndex: 0, leagues: [], more: false },
        })
      : super.leagueSearch(filter, options);
  }
}

/** The texts of the alerts within the element `qa` names. */
function alerts(page: HTMLElement, qa: string): string[] {
  return [...page.querySelectorAll(`[data-qa="${qa}"] [role="alert"]`)].map(
    textOf
  );
}

interface Wizard {
  readonly fixture: ComponentFixture<TeamSetupComponent>;
  readonly page: HTMLElement;
  readonly selection: Selection;
  /** The choices of the select `name` (`association`, `ageGroup`, ...). */
  options(name: string): Promise<string[]>;
  /** Picks the choice `text` of the select `name`. */
  choose(name: string, text: string): Promise<void>;
  /** Whether the select `name` is shown. */
  shows(name: string): Promise<boolean>;
  /** The texts of the list items `name` (`league`, `team`). */
  entries(name: string): string[];
  /** Taps the list item `name` that reads `text`. */
  tap(name: string, text: string): Promise<void>;
  /** The button that reads `text`, if shown. */
  button(text: string): Promise<MatButtonHarness | undefined>;
  /** Waits for the reads and the page. */
  settled(): Promise<void>;
}

async function render(
  data: KorbjaegerData = new DbbBasketballData(recordedDbbTransport),
  selection: Selection = new LocalSelection(undefined)
): Promise<Wizard> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'team/:id', component: TeamPageStub }]),
      { provide: BASKETBALL_DATA, useValue: data },
      { provide: AUSWAHL, useValue: selection },
    ],
  });
  const fixture = TestBed.createComponent(TeamSetupComponent);
  const loader: HarnessLoader = TestbedHarnessEnvironment.loader(fixture);
  const page = fixture.nativeElement as HTMLElement;
  const select = (name: string): HTMLElement | null =>
    page.querySelector<HTMLElement>(`mat-select[data-qa="${name}"]`);
  /** Opens the select `name` and gives its options in the overlay. */
  const openSelect = async (name: string): Promise<HTMLElement[]> => {
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
  const closeSelect = async (): Promise<void> => {
    document
      .querySelector('.cdk-overlay-backdrop')
      ?.dispatchEvent(new MouseEvent('click'));
    await fixture.whenStable();
  };
  const settled = async (): Promise<void> => {
    // the adapter settles in microtasks, the page in the next round
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const entries = (name: string): HTMLElement[] => [
    ...page.querySelectorAll<HTMLElement>(`[data-qa="${name}"]`),
  ];
  await settled();
  return {
    fixture,
    page,
    selection,
    options: async (name) => {
      const options = (await openSelect(name)).map(textOf);
      await closeSelect();
      return options;
    },
    choose: async (name, text) => {
      const option = (await openSelect(name)).find(
        (element) => textOf(element) === text
      );
      if (option === undefined) {
        throw new Error(`no option ${text} in ${name}`);
      }
      option.click();
      await settled();
    },
    shows: async (name) => select(name) !== null,
    entries: (name) => entries(name).map(textOf),
    tap: async (name, text) => {
      const entry = entries(name).find((element) =>
        textOf(element).startsWith(text)
      );
      if (entry === undefined) {
        throw new Error(`no ${name} ${text}`);
      }
      entry.click();
      await settled();
    },
    button: async (text) =>
      (await loader.getAllHarnesses(MatButtonHarness.with({ text })))[0],
    settled,
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
async function untilLeague(wizard: Wizard): Promise<void> {
  await wizard.choose('association', 'Niedersachsen');
  await wizard.choose('age-group', 'U12');
  await wizard.choose('gender', 'Jugend männlich');
}

/** Opens the second page of Ligen and picks Team 313036's Vorrunde. */
async function bisZumTeam(wizard: Wizard): Promise<void> {
  await untilLeague(wizard);
  await (await wizard.button('Weitere Ligen'))?.click();
  await wizard.settled();
  await wizard.tap('league', 'Regionsvorrunde Nord Braunschweig mu12');
}

describe('TeamSetupComponent', () => {
  it('offers each Verband that has Ligen, and nothing else yet', async () => {
    const wizard = await render();

    const associations = await wizard.options('association');

    expect(associations).toHaveLength(23);
    expect(associations).toContain('Niedersachsen');
    expect(await wizard.shows('age-group')).toBe(false);
  });

  it('offers only the age groups the Verband has', async () => {
    const wizard = await render();

    await wizard.choose('association', 'Niedersachsen');

    const ageGroups = await wizard.options('age-group');
    expect(ageGroups).toContain('U12');
    expect(ageGroups).not.toContain('U19');
    expect(await wizard.shows('gender')).toBe(false);
  });

  it('offers the genders of the age group, then its Ligen', async () => {
    const wizard = await render();
    await wizard.choose('association', 'Niedersachsen');
    await wizard.choose('age-group', 'U12');

    expect(await wizard.options('gender')).toEqual([
      'Jugend männlich',
      'Jugend weiblich',
    ]);
    expect(wizard.entries('league')).toEqual([]);

    await wizard.choose('gender', 'Jugend männlich');

    const leagues = wizard.entries('league');
    expect(leagues).toHaveLength(10);
    expect(leagues[0]).toBe('Landesliga U12 Nord Landesliga');
    expect(leagues[3]).toBe(
      'Regionsliga Braunschweig mu12 Regionsliga · Region Braunschweig'
    );
  });

  it('pages through the Ligen until there are no more', async () => {
    const wizard = await render();
    await untilLeague(wizard);

    await (await wizard.button('Weitere Ligen'))?.click();
    await wizard.settled();
    expect(wizard.entries('league')).toHaveLength(20);

    await (await wizard.button('Weitere Ligen'))?.click();
    await wizard.settled();
    expect(wizard.entries('league')).toHaveLength(28);
    expect(await wizard.button('Weitere Ligen')).toBeUndefined();
  });

  it('lists every Team of the picked Liga', async () => {
    const wizard = await render();

    await bisZumTeam(wizard);

    expect(wizard.entries('league')).toEqual([]);
    expect(
      textOf(wizard.page.querySelector('[data-qa="chosen-league"]'))
    ).toContain('Regionsvorrunde Nord Braunschweig mu12');
    expect(wizard.entries('team')).toEqual([
      'MTV Gifhorn',
      'MTV Wasbüttel -RST-',
      'SV Groß Oesingen -RST-',
      'SV Groß Schwülper',
      'TuS Müden-Dieckhorst -RST/aK-',
      'TV Jahn Wolfsburg Honeybadgers -RST-',
    ]);
  });

  it('follows the tapped Team and opens its page', async () => {
    const wizard = await render();
    await bisZumTeam(wizard);

    await wizard.tap('team', 'MTV Wasbüttel -RST-');

    expect(wizard.selection.teams()).toEqual([313036]);
    expect(TestBed.inject(Router).url).toBe('/team/313036');
  });

  it('opens a Team already followed without following it twice', async () => {
    const selection = new LocalSelection(undefined);
    await selection.follow(313036);
    const wizard = await render(undefined, selection);
    await bisZumTeam(wizard);

    expect(wizard.entries('team')).toContain('MTV Wasbüttel -RST- Gefolgt');
    await wizard.tap('team', 'MTV Wasbüttel -RST-');

    expect(selection.teams()).toEqual([313036]);
    expect(TestBed.inject(Router).url).toBe('/team/313036');
  });

  it('unfollows a followed Team from its row, staying in the list', async () => {
    const selection = new LocalSelection(undefined);
    await selection.follow(313036);
    const wizard = await render(undefined, selection);
    await bisZumTeam(wizard);
    const button = wizard.page.querySelector<HTMLButtonElement>(
      '[aria-label="Nicht mehr folgen: MTV Wasbüttel -RST-"]'
    );
    expect(button).not.toBeNull();

    button?.click();
    await wizard.settled();

    expect(selection.teams()).toEqual([]);
    expect(TestBed.inject(Router).url).toBe('/');
    expect(wizard.entries('team')).toContain('MTV Wasbüttel -RST-');
    // focus on the Team's row, where its control went
    const row = document.activeElement as HTMLElement | null;
    expect(row?.getAttribute('data-qa')).toBe('team');
    expect(textOf(row)).toBe('MTV Wasbüttel -RST-');
    expect(wizard.page.querySelector('[data-qa="follow-team"]')).toBeNull();
    const bar = await TestbedHarnessEnvironment.documentRootLoader(
      wizard.fixture
    ).getHarness(MatSnackBarHarness);
    expect(await bar.getMessage()).toBe(
      'MTV Wasbüttel -RST- steht nicht mehr in Meine Teams.'
    );

    await bar.dismissWithAction();
    await wizard.settled();

    expect(selection.teams()).toEqual([313036]);
    TestBed.inject(MatSnackBar).dismiss();
  });

  it('offers to unfollow only the Teams followed', async () => {
    const selection = new LocalSelection(undefined);
    await selection.follow(201500);
    const wizard = await render(undefined, selection);
    await bisZumTeam(wizard);

    const buttons = [
      ...wizard.page.querySelectorAll('[data-qa="follow-team"]'),
    ].map((button) => button.getAttribute('aria-label'));
    expect(buttons).toEqual(['Nicht mehr folgen: MTV Gifhorn']);
  });

  it('stays and says so when the Team could not be followed', async () => {
    const selection: Selection = fakeSelection({
      teams: signal([]),
      follow: () => Promise.reject(new Error('offline')),
    });
    const wizard = await render(undefined, selection);
    await bisZumTeam(wizard);

    await wizard.tap('team', 'MTV Wasbüttel -RST-');

    expect(TestBed.inject(Router).url).toBe('/');
    expect(textOf(wizard.page.querySelector('[role="alert"]'))).not.toBe('');
  });

  it('offers no Team before Meine Teams are read', async () => {
    const selection: Selection = fakeSelection({
      teams: signal(undefined),
    });
    const wizard = await render(undefined, selection);

    await bisZumTeam(wizard);

    const buttons = wizard.page.querySelectorAll<HTMLButtonElement>(
      'button[data-qa="team"]'
    );
    expect(buttons).toHaveLength(6);
    expect([...buttons].every((button) => button.disabled)).toBe(true);
  });

  it('starts over below a pick that changed', async () => {
    const wizard = await render();
    await bisZumTeam(wizard);

    await wizard.choose('association', 'Bayern');

    expect(await wizard.shows('gender')).toBe(false);
    expect(wizard.entries('league')).toEqual([]);
    expect(wizard.entries('team')).toEqual([]);
  });

  it('says so when the DBB cannot be reached', async () => {
    const wizard = await render(
      new DbbBasketballData(async () => {
        throw new BasketballDataError('unavailable', 'DBB down');
      })
    );

    expect(textOf(wizard.page.querySelector('[role="alert"]'))).toContain(
      'Der DBB ist gerade nicht erreichbar.'
    );
  });

  it('follows one Team only when two are tapped at once', async () => {
    const wizard = await render();
    await bisZumTeam(wizard);

    const buttons = wizard.page.querySelectorAll<HTMLButtonElement>(
      'button[data-qa="team"]'
    );
    buttons[1].click();
    buttons[0].click();
    await wizard.settled();

    expect(wizard.selection.teams()).toEqual([313036]);
    expect(TestBed.inject(Router).url).toBe('/team/313036');
  });

  it('cancels a later page of Ligen when a pick changes', async () => {
    const data = new HangingPages();
    const wizard = await render(data);
    await untilLeague(wizard);
    await (await wizard.button('Weitere Ligen'))?.click();
    expect(data.signale).toHaveLength(1);
    expect(data.signale[0].aborted).toBe(false);

    await wizard.choose('gender', 'Jugend weiblich');

    expect(data.signale[0].aborted).toBe(true);
  });

  it('cancels a later page of Ligen when the page is left', async () => {
    const data = new HangingPages();
    const wizard = await render(data);
    await untilLeague(wizard);
    await (await wizard.button('Weitere Ligen'))?.click();

    wizard.fixture.destroy();

    expect(data.signale[0].aborted).toBe(true);
  });

  it('keeps the pages of Ligen read when another Liga is wanted', async () => {
    const wizard = await render();
    await bisZumTeam(wizard);

    await (await wizard.button('Andere Liga'))?.click();
    await wizard.settled();

    expect(wizard.entries('league')).toHaveLength(20);
    expect(wizard.entries('team')).toEqual([]);
  });

  it('says at the first step when the DBB finds no such search', async () => {
    const wizard = await render(
      new DbbBasketballData(async () => {
        throw new BasketballDataError('not-found', 'DBB: status 1');
      })
    );

    expect(alerts(wizard.page, 'step-association')).toEqual([
      'Für diese Auswahl kennt der DBB keine Ligen.',
    ]);
  });

  it('says so when the DBB names no Verband', async () => {
    const wizard = await render(new WithoutFacets(() => true));

    expect(
      textOf(wizard.page.querySelector('[data-qa="step-association"]'))
    ).toContain('Der DBB nennt gerade keine Verbände.');
    expect(await wizard.shows('association')).toBe(false);
  });

  it('says so when a Verband has no age group', async () => {
    const wizard = await render(
      new WithoutFacets((filter) => filter.associationIds.length > 0)
    );

    await wizard.choose('association', 'Niedersachsen');

    expect(
      textOf(wizard.page.querySelector('[data-qa="step-age-group"]'))
    ).toContain('Für diesen Verband kennt der DBB keine Ligen.');
    expect(await wizard.shows('age-group')).toBe(false);
  });

  it('says at the step that failed why, until its pick changes', async () => {
    const wizard = await render();
    await wizard.choose('association', 'Niedersachsen');

    // the fixtures have no search for Niedersachsen's U14
    await wizard.choose('age-group', 'U14');
    expect(alerts(wizard.page, 'step-age-group')).toEqual([
      'Der DBB ist gerade nicht erreichbar. Bitte später noch einmal versuchen.',
    ]);

    await wizard.choose('age-group', 'U12');
    expect(alerts(wizard.page, 'step-age-group')).toEqual([]);
    expect(wizard.page.querySelectorAll('[role="alert"]')).toHaveLength(0);
  });
});
