import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { IndexedClub } from '@wolsok/feat-shared-basketball-data';
import type { ProxyFetch } from '../basketball-data/proxy-fetch';
import { CLUB_INDEX_FETCH } from './club-index';
import { MAX_HITS } from './club-search-result';
import {
  ClubSearchComponent,
  SEARCH_DEBOUNCE_MS,
} from './club-search.component';
import { ClubSearchTerm } from './club-search-term';

const WASBUETTEL: IndexedClub = {
  id: 1837,
  name: 'MTV Wasbüttel',
  associations: [{ id: 7, name: 'Niedersachsen' }],
};
const POST_SV: IndexedClub = {
  id: 1476,
  name: 'Post SV Nürnberg',
  associations: [
    { id: 2, name: 'Bayern' },
    { id: 30, name: 'Regionalliga Südost' },
  ],
};

function answering(status: number, body: unknown): ProxyFetch {
  return async () => new Response(JSON.stringify(body), { status });
}

interface Setup {
  readonly page: HTMLElement;
  readonly fetchProxy: ReturnType<typeof vi.fn<ProxyFetch>>;
  type(term: string): Promise<void>;
  settle(): Promise<void>;
}

/** Renders the search; the field is focused (the index loads) unless `used` is false. */
async function setup(
  fetchProxy: ProxyFetch,
  term = '',
  { used = true }: { used?: boolean } = {}
): Promise<Setup> {
  const recorded = vi.fn<ProxyFetch>(fetchProxy);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CLUB_INDEX_FETCH, useValue: recorded },
    ],
  });
  TestBed.inject(ClubSearchTerm).value.set(term);
  const fixture = TestBed.createComponent(ClubSearchComponent);
  const page = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await pause(SEARCH_DEBOUNCE_MS + 20);
    await fixture.whenStable();
  };
  await settle();
  if (used) {
    field(page).dispatchEvent(new Event('focus'));
    await settle();
  }
  return {
    page,
    fetchProxy: recorded,
    settle,
    type: async (typed) => {
      const input = field(page);
      input.value = typed;
      input.dispatchEvent(new Event('input'));
      await settle();
    },
  };
}

function field(page: HTMLElement): HTMLInputElement {
  const input = page.querySelector<HTMLInputElement>('[data-qa="club-search"]');
  if (input === null) {
    throw new Error('no search field');
  }
  return input;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function hits(page: HTMLElement): HTMLAnchorElement[] {
  return [...page.querySelectorAll<HTMLAnchorElement>('[data-qa="club"]')];
}

/** A hit as it reads: the Verein's name, then its Verbände. */
function hitText(hit: HTMLAnchorElement): string {
  return [...hit.querySelectorAll('[matListItemTitle], [matListItemLine]')]
    .map(text)
    .join(' / ');
}

describe('ClubSearchComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists the Vereine a term matches, linking to their Teams', async () => {
    const { page, type } = await setup(answering(200, [WASBUETTEL, POST_SV]));

    await type('wasbuttel');

    expect(hits(page).map(hitText)).toEqual(['MTV Wasbüttel / Niedersachsen']);
    expect(hits(page)[0].getAttribute('href')).toBe('/suchen/verein/1837');
  });

  it("names every Verband a Verein's Teams play in", async () => {
    const { page, type } = await setup(answering(200, [WASBUETTEL, POST_SV]));

    await type('post');

    expect(hitText(hits(page)[0])).toBe(
      'Post SV Nürnberg / Bayern · Regionalliga Südost'
    );
  });

  it('searches only once typing paused', async () => {
    const { page, settle } = await setup(answering(200, [WASBUETTEL]));
    const input = page.querySelector<HTMLInputElement>(
      '[data-qa="club-search"]'
    );
    if (input === null) {
      throw new Error('no search field');
    }

    input.value = 'wasb';
    input.dispatchEvent(new Event('input'));
    await pause(SEARCH_DEBOUNCE_MS / 2);
    expect(hits(page)).toEqual([]);

    await settle();
    expect(hits(page).map(hitText)).toEqual(['MTV Wasbüttel / Niedersachsen']);
  });

  it('loads the index once and sends no term', async () => {
    const { fetchProxy, type } = await setup(answering(200, [WASBUETTEL]));

    await type('wa');
    await type('wasbuttel');

    expect(fetchProxy).toHaveBeenCalledTimes(1);
    expect(fetchProxy).toHaveBeenCalledWith('/api/clubs', expect.anything());
  });

  it('loads nothing until the field is used', async () => {
    const { fetchProxy } = await setup(answering(200, [WASBUETTEL]), '', {
      used: false,
    });

    expect(fetchProxy).not.toHaveBeenCalled();
  });

  it('reads an empty list again once the field is used again', async () => {
    const fetchProxy = vi
      .fn<ProxyFetch>()
      .mockImplementationOnce(answering(200, []))
      .mockImplementationOnce(answering(200, [WASBUETTEL]));
    const { page, settle, type } = await setup(fetchProxy);
    expect(page.querySelector('[data-qa="club-search-empty"]')).not.toBeNull();

    field(page).dispatchEvent(new Event('focus'));
    await settle();
    await type('wasbuttel');

    expect(hits(page)).toHaveLength(1);
  });

  it('shows the term kept from before, with its hits, at once', async () => {
    const { page } = await setup(answering(200, [WASBUETTEL]), 'wasbuttel', {
      used: false,
    });

    expect(
      page.querySelector<HTMLInputElement>('[data-qa="club-search"]')?.value
    ).toBe('wasbuttel');
    expect(hits(page)).toHaveLength(1);
  });

  it('lists nothing for a single character', async () => {
    const { page, type } = await setup(answering(200, [WASBUETTEL]));

    await type('w');

    expect(hits(page)).toEqual([]);
    expect(page.querySelector('[data-qa="club-search-no-hits"]')).toBe(null);
  });

  it('says where no Verein matches, and points to the Liga', async () => {
    const { page, type } = await setup(answering(200, [WASBUETTEL]));

    await type('bamberg');

    expect(
      text(page.querySelector('[data-qa="club-search-no-hits"]'))
    ).toContain('über seine Liga');
  });

  it('says the list is still being built while it is empty', async () => {
    const { page } = await setup(answering(200, []));

    expect(text(page.querySelector('[data-qa="club-search-empty"]'))).toContain(
      'wird gerade aufgebaut'
    );
  });

  it(`lists at most ${MAX_HITS} and asks for more of the name`, async () => {
    const many = Array.from({ length: MAX_HITS + 5 }, (_, i) => ({
      id: i + 1,
      name: `TSV ${i}`,
      associations: [{ id: 7, name: 'Niedersachsen' }],
    }));
    const { page, type } = await setup(answering(200, many));

    await type('tsv');

    expect(hits(page)).toHaveLength(MAX_HITS);
    expect(text(page.querySelector('[data-qa="club-search-more"]'))).toBe(
      `Mehr als ${MAX_HITS} Vereine gefunden. Gib mehr vom Namen ein.`
    );
  });

  it('says the DBB is not reachable on a 502, and loads again', async () => {
    const fetchProxy = vi
      .fn<ProxyFetch>()
      .mockImplementationOnce(answering(502, {}))
      .mockImplementationOnce(answering(200, [WASBUETTEL]));
    const { page, settle, type } = await setup(fetchProxy);

    const failure = page.querySelector('[data-qa="club-search-failure"]');
    expect(text(failure)).toContain(
      'Die Vereinsliste ist gerade nicht erreichbar'
    );
    failure?.querySelector('button')?.click();
    await settle();
    await type('wasbuttel');

    expect(page.querySelector('[data-qa="club-search-failure"]')).toBeNull();
    expect(hits(page)).toHaveLength(1);
  });

  it('says there is no internet where the browser is offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { page } = await setup(answering(200, [WASBUETTEL]));

    expect(
      text(page.querySelector('[data-qa="club-search-failure"]'))
    ).toContain('Kein Internet');
  });

  it('says there is no connection where no server answers', async () => {
    const { page } = await setup(async () => {
      throw new TypeError('Failed to fetch');
    });

    expect(
      text(page.querySelector('[data-qa="club-search-failure"]'))
    ).toContain('Keine Verbindung');
  });
});
