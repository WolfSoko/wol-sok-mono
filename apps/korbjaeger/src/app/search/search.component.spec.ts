import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CLUB_INDEX } from './club-index';
import { SearchComponent } from './search.component';

async function render(): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CLUB_INDEX, useValue: async () => [] },
    ],
  });
  const fixture = TestBed.createComponent(SearchComponent);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('SearchComponent', () => {
  it('offers three ways in: the Verein, the Kind and the Liga', async () => {
    const page = await render();

    expect(
      [...page.querySelectorAll('h2')].map((h2) => h2.textContent?.trim())
    ).toEqual(['Über den Verein', 'Über mein Kind', 'Über die Liga']);
  });

  it('searches the Verein right on the page', async () => {
    const page = await render();

    expect(
      page.querySelector('[data-qa="weg-verein"] [data-qa="vereinssuche"]')
    ).not.toBeNull();
  });

  it('leads to the wizard for the way through the Liga', async () => {
    const page = await render();

    expect(
      page.querySelector('[data-qa="weg-liga"] a')?.getAttribute('href')
    ).toBe('/team-einrichten');
  });

  it('offers no search by a name of a person', async () => {
    const page = await render();

    expect(page.querySelectorAll('input')).toHaveLength(1);
    expect(page.querySelector('[data-qa="weg-kind"] input')).toBeNull();
  });
});
