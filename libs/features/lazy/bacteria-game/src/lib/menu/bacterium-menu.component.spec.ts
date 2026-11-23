import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RANKS } from '@wolsok/feat-shared-bacteria-engine';
import { bacteriumItems } from './bacterium/bacterium-items';
import {
  BACTERIUM_RENDERER,
  type BacteriumRenderer,
  type BacteriumScene,
} from './bacterium/bacterium-renderer';
import { MAX_LOBES } from './bacterium/bacterium-shader';
import { BacteriumMenuComponent } from './bacterium-menu.component';

const ITEMS = bacteriumItems({
  training: true,
  online: true,
  friends: false,
  leaderboards: false,
  colonyDna: 4,
  evolveDna: 0,
  friendRequests: 0,
  gallery: { url: '/replays', external: false },
});

/** A renderer that keeps what it was asked to draw. */
class RecordingRenderer implements BacteriumRenderer {
  public readonly scenes: BacteriumScene[] = [];
  public disposed = false;
  public resize(): void {
    // Nothing to size.
  }
  public draw(scene: BacteriumScene): void {
    this.scenes.push(scene);
  }
  public dispose(): void {
    this.disposed = true;
  }
}

describe('BacteriumMenuComponent', () => {
  /** The animation frames asked for and not cancelled, by id. */
  let frames: Map<number, FrameRequestCallback>;
  let nextId: number;

  beforeEach(() => {
    frames = new Map();
    nextId = 0;
    jest
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        frames.set(++nextId, callback);
        return nextId;
      });
    jest
      .spyOn(globalThis, 'cancelAnimationFrame')
      .mockImplementation((id) => frames.delete(id));
  });

  afterEach(() => jest.restoreAllMocks());

  /** Runs the animation frames asked for so far, at `now`. */
  function frame(now: number): void {
    const due = [...frames.values()];
    frames.clear();
    for (const callback of due) {
      callback(now);
    }
  }

  function render(renderer: BacteriumRenderer | null, xp = 0) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: BACTERIUM_RENDERER, useValue: () => renderer }],
    });
    const fixture: ComponentFixture<BacteriumMenuComponent> =
      TestBed.createComponent(BacteriumMenuComponent);
    fixture.componentRef.setInput('items', ITEMS);
    fixture.componentRef.setInput('xp', xp);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const spot = (id: string) =>
      element.querySelector<HTMLElement>(`[data-part="${id}"] .spot`);
    return { fixture, element, spot };
  }

  it('lays a real button over each part, the nucleus in the middle', () => {
    const { element, spot } = render(new RecordingRenderer());
    const parts = Array.from(element.querySelectorAll('[data-part]'));
    expect(parts.map((part) => part.getAttribute('data-part'))).toEqual(
      ITEMS.map((item) => item.id)
    );
    const play = element.querySelector<HTMLElement>('[data-part="play"]');
    expect(play?.style.left).toBe('50%');
    expect(play?.style.top).toBe('50%');
    expect(spot('play')?.tagName).toBe('BUTTON');
    expect(spot('play')?.textContent).toContain('New game');
    expect(spot('online')?.textContent).toContain('Online');
    expect(spot('gallery')?.tagName).toBe('A');
    expect(spot('colony')?.textContent).toContain('4');
    expect(element.querySelector('canvas')?.getAttribute('aria-hidden')).toBe(
      'true'
    );
  });

  it('reports the part picked', () => {
    const { fixture, spot } = render(new RecordingRenderer());
    const picked: string[] = [];
    fixture.componentInstance.pick.subscribe((id) => picked.push(id));
    spot('online')?.click();
    spot('play')?.click();
    expect(picked).toEqual(['online', 'play']);
  });

  it('draws with WebGL, lighting the part under the pointer or the focus', () => {
    const renderer = new RecordingRenderer();
    const { fixture, element, spot } = render(renderer);
    expect(element.querySelector('.css-body')).toBeNull();
    expect(renderer.scenes.length).toBeGreaterThan(0);
    const last = () => renderer.scenes[renderer.scenes.length - 1];
    expect(last().lobes).toHaveLength(ITEMS.length - 1);
    expect(last().hot).toBe(-1);

    spot('online')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
    frame(1000);
    // Online is the first lobe after the nucleus.
    expect(last().hot).toBe(0);

    spot('play')?.closest('li')?.dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    frame(2000);
    expect(last().hot).toBe(MAX_LOBES);

    // At most 30 frames a second.
    const drawn = renderer.scenes.length;
    frame(2010);
    expect(renderer.scenes).toHaveLength(drawn);

    fixture.destroy();
    expect(renderer.disposed).toBe(true);
  });

  it('draws the cell with CSS where WebGL cannot, with the same parts', () => {
    const { element, spot } = render(null);
    expect(element.classList).toContain('css-cell');
    expect(element.querySelectorAll('.css-lobe')).toHaveLength(
      ITEMS.length - 1
    );
    expect(spot('online')).not.toBeNull();
  });

  it('grows its look with the XP', () => {
    const spore = new RecordingRenderer();
    render(spore, 0);
    const superbug = new RecordingRenderer();
    render(superbug, RANKS[RANKS.length - 1].xp);
    expect(superbug.scenes[0].look.flagella).toBeGreaterThan(
      spore.scenes[0].look.flagella
    );
  });

  it('takes the CSS cell once the browser takes the WebGL context back', () => {
    const renderer = new RecordingRenderer();
    const { fixture, element } = render(renderer);
    expect(element.classList).not.toContain('css-cell');

    element
      .querySelector('canvas')
      ?.dispatchEvent(new Event('webglcontextlost'));
    fixture.detectChanges();

    expect(element.classList).toContain('css-cell');
    const drawn = renderer.scenes.length;
    frame(5000);
    expect(renderer.scenes).toHaveLength(drawn);
  });

  it('stops animating while the page is hidden, and goes on once shown', () => {
    let hidden = false;
    jest.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const renderer = new RecordingRenderer();
    render(renderer);
    expect(frames.size).toBeGreaterThan(0);

    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    frame(1000);
    expect(frames.size).toBe(0);

    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    const drawn = renderer.scenes.length;
    frame(2000);
    expect(renderer.scenes.length).toBeGreaterThan(drawn);
  });

  it('lights up the parts whose DNA buys something, and their lobes', () => {
    const renderer = new RecordingRenderer();
    const { element } = render(renderer);
    const ready = Array.from(element.querySelectorAll('.part.ready'));
    // ITEMS have DNA for My Colony only.
    expect(ready.map((part) => part.getAttribute('data-part'))).toEqual([
      'colony',
    ]);
    const lobes = renderer.scenes[renderer.scenes.length - 1].lobes;
    const colony = ITEMS.filter((item) => item.id !== 'play').findIndex(
      (item) => item.id === 'colony'
    );
    expect(lobes.map((lobe) => lobe.ready)).toEqual(
      lobes.map((_, index) => index === colony)
    );
  });

  it('redraws a still cell once a part gets ready', () => {
    const original = globalThis.matchMedia;
    globalThis.matchMedia = (query: string) =>
      ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList;
    try {
      const renderer = new RecordingRenderer();
      const { fixture } = render(renderer);
      fixture.componentRef.setInput(
        'items',
        bacteriumItems({
          training: true,
          online: true,
          friends: false,
          leaderboards: false,
          colonyDna: 4,
          evolveDna: 2,
          friendRequests: 0,
          gallery: { url: '/replays', external: false },
        })
      );
      fixture.detectChanges();
      const last = renderer.scenes[renderer.scenes.length - 1];
      expect(last.lobes.filter((lobe) => lobe.ready)).toHaveLength(2);
      // Held still: drawn on the change, no animation frame asked for.
      expect(frames.size).toBe(0);
    } finally {
      globalThis.matchMedia = original;
    }
  });

  it('glows the CSS lobes of ready parts too', () => {
    const { element } = render(null);
    expect(element.querySelectorAll('.css-lobe.ready')).toHaveLength(1);
  });

  it("lights its rim in the player's colony colour", () => {
    TestBed.resetTestingModule();
    const renderer = new RecordingRenderer();
    TestBed.configureTestingModule({
      providers: [{ provide: BACTERIUM_RENDERER, useValue: () => renderer }],
    });
    const fixture = TestBed.createComponent(BacteriumMenuComponent);
    fixture.componentRef.setInput('items', ITEMS);
    fixture.componentRef.setInput('player', [255, 0, 0]);
    fixture.detectChanges();
    expect(renderer.scenes[0].look.rim).toEqual([1, 0, 0]);
  });
});
