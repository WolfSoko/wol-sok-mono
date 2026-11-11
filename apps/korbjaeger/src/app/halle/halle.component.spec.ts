import { TestBed } from '@angular/core/testing';
import type { Venue } from '@wolsok/feat-shared-basketball-data';
import { HalleComponent } from './halle.component';

const SPORTHALLE: Venue = {
  name: 'Sporthalle Wasbüttel',
  street: 'Schulstraße 1',
  postcode: '38553',
  town: 'Wasbüttel',
};

async function render(halle: Venue | undefined): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(HalleComponent);
  fixture.componentRef.setInput('halle', halle);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

/** What a screen reader reads of `element`: its text without what it hides. */
function vorgelesen(element: Element | null): string {
  if (element?.getAttribute('aria-hidden') === 'true') {
    return '';
  }
  const kopie = element?.cloneNode(true) as Element | undefined;
  kopie
    ?.querySelectorAll('[aria-hidden="true"]')
    .forEach((versteckt) => versteckt.remove());
  return (kopie?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('HalleComponent', () => {
  it('shows the Halle with its address', async () => {
    const seite = await render(SPORTHALLE);

    expect(seite.querySelector('[data-qa="halle-name"]')?.textContent).toBe(
      'Sporthalle Wasbüttel'
    );
    expect(seite.querySelector('[data-qa="halle-adresse"]')?.textContent).toBe(
      'Schulstraße 1, 38553 Wasbüttel'
    );
  });

  it('names the Halle in the navigation link, as one sentence', async () => {
    const seite = await render(SPORTHALLE);

    expect(
      vorgelesen(seite.querySelector('[data-qa="halle-navigation"]'))
    ).toBe('Route planen zur Halle Sporthalle Wasbüttel (öffnet neuen Tab)');
  });

  it('says so while the DBB names no Halle', async () => {
    const seite = await render(undefined);

    expect(seite.textContent).toContain('Die Halle steht noch nicht fest.');
    expect(seite.querySelector('[data-qa="halle-navigation"]')).toBeNull();
  });
});
