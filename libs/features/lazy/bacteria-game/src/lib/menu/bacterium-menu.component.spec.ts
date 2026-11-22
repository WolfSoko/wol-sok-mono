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
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    jest
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((callback) => frames.push(callback));
    // Angular cancels a frame of its own scheduler too: keep the cell's.
    jest
      .spyOn(globalThis, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  /** Runs the animation frames asked for so far, at `now`. */
  function frame(now: number): void {
    const due = frames;
    frames = [];
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

    spot('online')?.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    frame(1000);
    // Online is the first lobe after the nucleus.
    expect(last().hot).toBe(0);

    spot('play')?.dispatchEvent(new Event('pointerenter'));
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
});
