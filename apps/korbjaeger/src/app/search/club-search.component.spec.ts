import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  BasketballDataError,
  type IndexedClub,
} from '@wolsok/feat-shared-basketball-data';
import { KeinInternetError } from '../basketball-data/kein-internet-error';
import { KEIN_INTERNET } from '../fehler/fehler-text';
import { CLUB_INDEX, type ClubIndexLoader } from './club-index';
import { ClubSearchComponent } from './club-search.component';
import { ClubSearchTerm } from './club-search-term';

const NIEDERSACHSEN = { id: 7, name: 'Niedersachsen' };
const WASBUETTEL: IndexedClub = {
  id: 1837,
  name: 'MTV Wasbüttel',
  associations: [NIEDERSACHSEN],
};
const GIFHORN: IndexedClub = {
  id: 1835,
  name: 'MTV Gifhorn',
  associations: [NIEDERSACHSEN],
};

/** Renders the search; `settle: false` where the list never loads, which would keep the fixture unstable. */
async function render(load: ClubIndexLoader, { settle = true } = {}) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: CLUB_INDEX, useValue: load }],
  });
  const fixture = TestBed.createComponent(ClubSearchComponent);
  const stable = async (): Promise<void> => {
    if (settle) {
      await fixture.whenStable();
    } else {
      fixture.detectChanges();
    }
  };
  await stable();
  const element = fixture.nativeElement as HTMLElement;
  return {
    element,
    async type(text: string): Promise<void> {
      const input = element.querySelector<HTMLInputElement>(
        '[data-qa="vereinssuche"]'
      );
      if (input === null) {
        throw new Error('no search field');
      }
      input.value = text;
      input.dispatchEvent(new Event('input'));
      await stable();
    },
    stable,
  };
}

function hits(element: HTMLElement): { name: string; href: string | null }[] {
  return [...element.querySelectorAll('[data-qa="verein"]')].map((hit) => ({
    name: hit.querySelector('[matListItemTitle]')?.textContent?.trim() ?? '',
    href: hit.getAttribute('href'),
  }));
}

function status(element: HTMLElement): string {
  return (
    element
      .querySelector('[data-qa="vereinssuche-status"]')
      ?.textContent?.trim() ?? ''
  );
}

describe('ClubSearchComponent', () => {
  it('links each Verein matching the term to its page, with its Verbände', async () => {
    const { element, type } = await render(async () => [GIFHORN, WASBUETTEL]);

    await type('wasbuttel');

    expect(hits(element)).toEqual([
      { name: 'MTV Wasbüttel', href: '/suchen/verein/1837' },
    ]);
    expect(element.querySelector('[matListItemLine]')?.textContent).toBe(
      'Niedersachsen'
    );
    expect(status(element)).toBe('Ein Verein gefunden.');
  });

  it('loads the list once, however much is typed', async () => {
    const load = vi.fn<ClubIndexLoader>(async () => [GIFHORN, WASBUETTEL]);
    const { element, type } = await render(load);

    await type('mt');
    await type('mtv');
    await type('mtv g');

    expect(hits(element).map(({ name }) => name)).toEqual(['MTV Gifhorn']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('asks for more than one character', async () => {
    const { element, type } = await render(async () => [WASBUETTEL]);

    await type('m');

    expect(hits(element)).toEqual([]);
    expect(status(element)).toBe('Bitte mindestens zwei Zeichen eingeben.');
  });

  it('says when no Verein matches', async () => {
    const { element, type } = await render(async () => [WASBUETTEL]);

    await type('bamberg');

    expect(status(element)).toContain('Kein Verein gefunden.');
  });

  it('shows the list loading while a term waits for it', async () => {
    const { element, type } = await render(() => new Promise(() => undefined), {
      settle: false,
    });

    await type('mtv');

    expect(
      element.querySelector('mat-progress-bar')?.getAttribute('aria-label')
    ).toBe('Vereine werden geladen');
  });

  it('says why the list failed and loads it again on request', async () => {
    const load = vi
      .fn<ClubIndexLoader>()
      .mockRejectedValueOnce(new KeinInternetError('/api/clubs'))
      .mockResolvedValue([WASBUETTEL]);
    const { element, type, stable } = await render(load);

    expect(
      element.querySelector('[data-qa="vereinssuche-fehler"]')?.textContent
    ).toContain(KEIN_INTERNET);
    element.querySelector<HTMLButtonElement>('button')?.click();
    await stable();
    await type('wasbüttel');

    expect(hits(element)).toHaveLength(1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps the term for the next time the search opens', async () => {
    const { type } = await render(async () => [WASBUETTEL]);
    await type('wasb');

    expect(TestBed.inject(ClubSearchTerm).term()).toBe('wasb');
  });

  it('says the list is not available for a failure of the server', async () => {
    const { element } = await render(async () => {
      throw new BasketballDataError('unavailable', '/api/clubs: HTTP 502');
    });

    expect(
      element.querySelector('[data-qa="vereinssuche-fehler"]')?.textContent
    ).toContain('Die Liste der Vereine ist gerade nicht erreichbar.');
  });
});
