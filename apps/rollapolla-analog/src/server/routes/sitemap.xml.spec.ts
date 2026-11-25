import { H3Event, setResponseHeaders } from 'h3';
import { listedPolls } from '../sitemap/listed-polls';
import sitemapRoute from './sitemap.xml';

vi.mock('h3', () => ({
  defineEventHandler: <T>(handler: T) => handler,
  setResponseHeaders: vi.fn(),
}));

vi.mock('../sitemap/listed-polls', () => ({
  listedPolls: vi.fn(),
}));

const event = {} as H3Event;

async function requestSitemap(): Promise<string> {
  return (await sitemapRoute(event)) as string;
}

describe('GET /sitemap.xml', () => {
  beforeEach(() => {
    vi.mocked(setResponseHeaders).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists a newly created open poll and lets the CDN keep it an hour', async () => {
    vi.mocked(listedPolls).mockResolvedValue([
      { id: 'brand-new', closesAt: new Date(Date.now() + 60_000) },
    ]);

    expect(await requestSitemap()).toContain(
      '<loc>https://rollapolla.com/poll/brand-new</loc>'
    );
    expect(setResponseHeaders).toHaveBeenCalledWith(event, {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    });
  });

  it('still lists the static pages for a minute when Firestore fails', async () => {
    const logError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const failure = new Error('unavailable');
    vi.mocked(listedPolls).mockRejectedValue(failure);

    const xml = await requestSitemap();

    expect(xml).toContain('<loc>https://rollapolla.com/polls</loc>');
    expect(logError).toHaveBeenCalledWith(
      'sitemap.xml: could not read the listed polls',
      failure
    );
    expect(setResponseHeaders).toHaveBeenCalledWith(event, {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=60',
    });
  });
});
