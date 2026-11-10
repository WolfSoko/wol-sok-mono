import { TestBed } from '@angular/core/testing';
import { SpielZeileComponent } from './spiel-zeile.component';
import type { SpielZeile } from './spiel-zeile';

const GESPIELT: SpielZeile = {
  id: 1,
  datum: 'So., 20.09.2026',
  uhrzeit: '09:00',
  liga: 'U12 Kreisliga',
  ort: 'Heim',
  gegner: 'MTV Gifhorn',
  ergebnis: '78:47',
  ausgang: 'win',
  vorlaeufig: false,
};

async function render(zeile: SpielZeile): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(SpielZeileComponent);
  fixture.componentRef.setInput('zeile', zeile);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

function text(seite: HTMLElement, qa: string): string | undefined {
  return seite.querySelector(`[data-qa="${qa}"]`)?.textContent?.trim();
}

describe('SpielZeileComponent', () => {
  it('marks a result the Verband has not confirmed yet as vorläufig, with its score and badge', async () => {
    const seite = await render({ ...GESPIELT, vorlaeufig: true });

    expect(text(seite, 'spiel-ergebnis')).toBe('78:47');
    expect(text(seite, 'spiel-ausgang')).toBe('Sieg');
    expect(text(seite, 'spiel-vorlaeufig')).toBe('vorläufig');
    expect(
      seite.querySelector('.ausgang')?.textContent?.replace(/\s+/g, ' ').trim()
    ).toBe('Sieg 78:47 vorläufig');
  });

  it('does not mark a confirmed result', async () => {
    const seite = await render(GESPIELT);

    expect(text(seite, 'spiel-ergebnis')).toBe('78:47');
    expect(seite.querySelector('[data-qa="spiel-vorlaeufig"]')).toBeNull();
  });
});
