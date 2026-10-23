import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '../i18n/i18n.service';
import { CHAPTERS } from '../state/chapters';
import { getLevel, LEVELS } from '../state/levels';
import { parseGeneratedId } from '../state/level-generator/generate-level';
import {
  drawPreviews,
  fakePreviewUrl,
  provideFakePreviews,
} from '../../testing/fake-preview-renderer';
import { LevelMapComponent } from './level-map.component';

describe('LevelMapComponent', () => {
  let fixture: ComponentFixture<LevelMapComponent>;

  function render(inputs: Record<string, unknown> = {}): HTMLElement {
    fixture = TestBed.createComponent(LevelMapComponent);
    fixture.componentRef.setInput('levelId', LEVELS[0].id);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function cards(host: HTMLElement): HTMLButtonElement[] {
    return Array.from(host.querySelectorAll('.level-card'));
  }

  it('offers a card per level, marks the chosen one and reports a pick', () => {
    const host = render({ levelId: LEVELS[2].id });
    const picked = jest.fn();
    fixture.componentInstance.pick.subscribe(picked);

    cards(host)[3].click();

    expect(cards(host)).toHaveLength(LEVELS.length);
    expect(cards(host)[2].getAttribute('aria-current')).toBe('true');
    expect(picked).toHaveBeenCalledWith(LEVELS[3].id);
  });

  it('locks the levels the ladder has not opened, with the reason', () => {
    const host = render({
      locks: { [LEVELS[1].id]: 'Win Petri Dish to unlock' },
    });

    expect(cards(host)[1].disabled).toBe(true);
    expect(cards(host)[1].textContent).toContain('Win Petri Dish to unlock');
    expect(cards(host)[0].disabled).toBe(false);
  });

  it('shows the medallions per difficulty, unless there are none to earn', () => {
    const medals = { [LEVELS[0].id]: { normal: 'silver' as const } };
    const host = render({ medals });

    expect(
      cards(host)[0].querySelectorAll('feat-lazy-bac-game-medallion')
    ).toHaveLength(3);

    fixture.componentRef.setInput('showMedals', false);
    fixture.detectChanges();
    expect(
      cards(host)[0].querySelector('feat-lazy-bac-game-medallion')
    ).toBeNull();
  });

  it('groups the ladder in chapters, counting the open levels on the ladder', () => {
    const host = render({
      laddered: true,
      locks: { [LEVELS[2].id]: 'Win Corridors to unlock' },
    });

    const chapters = Array.from(host.querySelectorAll('.chapter-head')).map(
      (head) => head.textContent ?? ''
    );
    expect(chapters[0]).toContain('Petri');
    expect(chapters[0]).toContain('2 of 3 open');
  });

  it('counts the open levels only where the ladder locks them', () => {
    const host = render();

    expect(host.querySelector('.chapter-open')).toBeNull();
  });

  it('offers the generator only where the mode allows it', () => {
    expect(render().querySelector('.generator')).toBeNull();
    expect(
      render({ generator: true }).querySelector('.generator')
    ).not.toBeNull();
  });

  it('generates a level of the chosen style and difficulty and picks it', () => {
    const host = render({ generator: true });
    const picked = jest.fn();
    fixture.componentInstance.pick.subscribe(picked);

    Array.from(host.querySelectorAll<HTMLButtonElement>('.style-picker button'))
      .find((b) => b.textContent?.includes('Cave'))
      ?.click();
    host.querySelector<HTMLButtonElement>('.generate')?.click();

    const id = picked.mock.calls[0][0] as string;
    expect(parseGeneratedId(id)).toEqual(
      expect.objectContaining({ recipe: 'cave', difficulty: 5 })
    );
  });

  it('keeps the rolled level offered, and its style, after a ladder pick', () => {
    const host = render({ generator: true, levelId: 'gen:cave:77:8' });

    fixture.componentRef.setInput('levelId', LEVELS[0].id);
    fixture.detectChanges();

    expect(host.querySelector('.branches')?.textContent).toContain(
      getLevel('gen:cave:77:8').name
    );
    expect(host.textContent).toContain('Difficulty 8');
  });

  it('names the chapters, the levels and their locks in German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const host = render({
      laddered: true,
      generator: true,
      locks: { [LEVELS[1].id]: 'Win Petri Dish to unlock' },
    });

    expect(host.querySelector('.chapter-open')?.textContent).toContain(
      '2 von 3 offen'
    );
    expect(cards(host)[1].textContent).toContain(
      'Gewinne Petrischale zum Freischalten'
    );
    expect(host.querySelector('.generate')?.textContent).toContain(
      'Generieren'
    );
  });

  it('badges a big map with its size where no picture is drawn', () => {
    const host = render();
    const expanse = CHAPTERS.flatMap((c) => c.levelIds).indexOf('expanse');

    expect(host.querySelector('feat-lazy-bac-game-level-preview')).toBeNull();
    expect(cards(host)[expanse].querySelector('.size')?.textContent).toBe(
      '2× map'
    );
    expect(cards(host)[0].querySelector('.size')).toBeNull();
  });

  describe('with pictures of the maps', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideFakePreviews()] });
    });

    it('shows each level its map, once drawn, named for the level', async () => {
      const host = render();
      const preview = () =>
        cards(host)[0].querySelector('feat-lazy-bac-game-level-preview');

      // The arena's colours hold its place until the picture is drawn.
      expect(preview()).not.toBeNull();
      expect(preview()?.querySelector('img')).toBeNull();
      await drawPreviews(LEVELS.length + 4);
      fixture.detectChanges();

      const image = preview()?.querySelector('img');
      expect(image?.getAttribute('src')).toBe(fakePreviewUrl(LEVELS[0].id));
      expect(image?.getAttribute('alt')).toBe('Map of Petri Dish');
      expect(host.querySelectorAll('.level-card img')).toHaveLength(
        LEVELS.length
      );
    });

    it('badges the picture of a big map with its size, in German too', async () => {
      TestBed.inject(I18nService).setLanguage('de');
      const host = render();
      const expanse = CHAPTERS.flatMap((c) => c.levelIds).indexOf('expanse');
      await drawPreviews(LEVELS.length + 4);
      fixture.detectChanges();

      const card = cards(host)[expanse];
      expect(
        card.querySelector('feat-lazy-bac-game-level-preview .size')
          ?.textContent
      ).toBe('2× Karte');
      expect(card.querySelector('img')?.getAttribute('alt')).toBe(
        `Karte von ${card.querySelector('.title')?.textContent?.trim()}`
      );
    });
  });
});
