import { TestBed } from '@angular/core/testing';
import { GameRowComponent } from './game-row.component';
import type { GameRow } from './game-row';

const PLAYED_GAME: GameRow = {
  id: 1,
  date: 'So., 20.09.2026',
  time: '09:00',
  league: 'U12 Kreisliga',
  homeOrAway: 'Heim',
  opponent: 'MTV Gifhorn',
  result: '78:47',
  outcome: 'win',
  provisional: false,
};

async function render(row: GameRow): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(GameRowComponent);
  fixture.componentRef.setInput('row', row);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

function text(page: HTMLElement, qa: string): string | undefined {
  return page.querySelector(`[data-qa="${qa}"]`)?.textContent?.trim();
}

describe('GameRowComponent', () => {
  it('marks a result the Verband has not confirmed yet as vorläufig, with its score and badge', async () => {
    const page = await render({ ...PLAYED_GAME, provisional: true });

    expect(text(page, 'game-result')).toBe('78:47');
    expect(text(page, 'game-outcome')).toBe('Sieg');
    expect(text(page, 'game-provisional')).toBe('vorläufig');
    expect(
      page.querySelector('.outcome')?.textContent?.replace(/\s+/g, ' ').trim()
    ).toBe('Sieg 78:47 vorläufig');
  });

  it('does not mark a confirmed result', async () => {
    const page = await render(PLAYED_GAME);

    expect(text(page, 'game-result')).toBe('78:47');
    expect(page.querySelector('[data-qa="game-provisional"]')).toBeNull();
  });
});
