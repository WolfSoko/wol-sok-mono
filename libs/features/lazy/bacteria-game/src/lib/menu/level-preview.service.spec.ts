import { TestBed } from '@angular/core/testing';
import {
  drawPreviews,
  FakePreviewRenderer,
  fakePreviewUrl,
  provideFakePreviews,
} from '../../testing/fake-preview-renderer';
import {
  canvasPreviewRenderer,
  LevelPreviewRenderer,
  LevelPreviewService,
  PREVIEW_CACHE_LIMIT,
} from './level-preview.service';

describe('LevelPreviewService', () => {
  function setUp(renderer: LevelPreviewRenderer): LevelPreviewService {
    TestBed.configureTestingModule({
      providers: [provideFakePreviews(renderer)],
    });
    return TestBed.inject(LevelPreviewService);
  }

  it('draws a preview once asked for, and hands it out from then on', async () => {
    const renderer = new FakePreviewRenderer();
    const previews = setUp(renderer);

    expect(previews.url('petri-dish')).toBeNull();
    expect(previews.url('petri-dish')).toBeNull();
    await drawPreviews();

    expect(previews.url('petri-dish')).toBe(fakePreviewUrl('petri-dish'));
    expect(previews.url('petri-dish')).toBe(fakePreviewUrl('petri-dish'));
    expect(renderer.drawn).toEqual(['petri-dish']);
  });

  it('draws them one after the other, in the order asked for', async () => {
    const renderer = new FakePreviewRenderer();
    const previews = setUp(renderer);

    previews.url('hourglass');
    previews.url('corridors');
    previews.url('expanse');
    // Not before the browser idles: the menu comes first.
    expect(renderer.drawn).toEqual([]);
    await drawPreviews();

    expect(renderer.drawn).toEqual(['hourglass', 'corridors', 'expanse']);
  });

  it('does not try again a preview that failed', async () => {
    const renderer = new FakePreviewRenderer(true, ['pistons']);
    const previews = setUp(renderer);

    previews.url('pistons');
    await drawPreviews();
    expect(previews.url('pistons')).toBeNull();
    await drawPreviews();

    expect(renderer.drawn).toEqual(['pistons']);
  });

  it('keeps only the latest previews', async () => {
    const renderer = new FakePreviewRenderer();
    const previews = setUp(renderer);
    const ids = Array.from(
      { length: PREVIEW_CACHE_LIMIT + 1 },
      (_, i) => `gen:cave:${i}:5`
    );

    ids.forEach((id) => previews.url(id));
    await drawPreviews(PREVIEW_CACHE_LIMIT + 4);

    expect(previews.url(ids[PREVIEW_CACHE_LIMIT])).not.toBeNull();
    // The first one was let go, and is drawn again once asked for.
    expect(previews.url(ids[0])).toBeNull();
    await drawPreviews();
    expect(renderer.drawn.filter((id) => id === ids[0])).toHaveLength(2);
  });

  it('draws nothing where previews are not supported', async () => {
    const renderer = new FakePreviewRenderer(false);
    const previews = setUp(renderer);

    expect(previews.supported).toBe(false);
    expect(previews.url('petri-dish')).toBeNull();
    await drawPreviews();

    expect(renderer.drawn).toEqual([]);
  });

  it('knows no canvas off the page in the test DOM, so draws nothing there', async () => {
    const renderer = canvasPreviewRenderer();

    expect(renderer.supported).toBe(false);
    await expect(renderer.render('petri-dish')).resolves.toBeNull();
    expect(setUp(renderer).supported).toBe(false);
  });
});
