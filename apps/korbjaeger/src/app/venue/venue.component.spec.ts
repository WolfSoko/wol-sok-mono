import { TestBed } from '@angular/core/testing';
import type { Venue } from '@wolsok/feat-shared-basketball-data';
import { VenueComponent } from './venue.component';

const SPORTS_HALL: Venue = {
  name: 'Sporthalle Wasbüttel',
  street: 'Schulstraße 1',
  postcode: '38553',
  town: 'Wasbüttel',
};

async function render(venue: Venue | undefined): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(VenueComponent);
  fixture.componentRef.setInput('venue', venue);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

/** What a screen reader reads of `element`: its text without what it hides. */
function announced(element: Element | null): string {
  if (element?.getAttribute('aria-hidden') === 'true') {
    return '';
  }
  const copy = element?.cloneNode(true) as Element | undefined;
  copy
    ?.querySelectorAll('[aria-hidden="true"]')
    .forEach((hidden) => hidden.remove());
  return (copy?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('VenueComponent', () => {
  it('shows the Halle with its address', async () => {
    const page = await render(SPORTS_HALL);

    expect(page.querySelector('[data-qa="venue-name"]')?.textContent).toBe(
      'Sporthalle Wasbüttel'
    );
    expect(page.querySelector('[data-qa="venue-address"]')?.textContent).toBe(
      'Schulstraße 1, 38553 Wasbüttel'
    );
  });

  it('names the Halle in the navigation link, as one sentence', async () => {
    const page = await render(SPORTS_HALL);

    expect(announced(page.querySelector('[data-qa="venue-navigation"]'))).toBe(
      'Route planen zur Halle Sporthalle Wasbüttel (öffnet neuen Tab)'
    );
  });

  it('says so while the DBB names no Halle', async () => {
    const page = await render(undefined);

    expect(page.textContent).toContain('Die Halle steht noch nicht fest.');
    expect(page.querySelector('[data-qa="venue-navigation"]')).toBeNull();
  });
});
