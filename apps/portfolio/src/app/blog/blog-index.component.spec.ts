import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appRoutes } from '../app.routes';
import { I18nService } from '../i18n/i18n.service';
import { BLOG_POSTS } from './posts';

describe('BlogIndexComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(appRoutes)] });
  });

  afterEach(() => localStorage.clear());

  it('links every post with its title, date and summary', async () => {
    const harness = await RouterTestingHarness.create('/blog');
    const root = harness.routeNativeElement as HTMLElement;
    const cards = root.querySelectorAll('.post-card');
    expect(cards).toHaveLength(BLOG_POSTS.length);
    BLOG_POSTS.forEach((post, index) => {
      const card = cards[index];
      expect(card.querySelector('h2 a')?.getAttribute('href')).toBe(
        `/blog/${post.slug}`
      );
      expect(card.textContent).toContain(post.title.en);
      expect(card.textContent).toContain(post.summary.en);
      expect(card.querySelector('time')?.getAttribute('datetime')).toBe(
        post.published
      );
    });
    expect(root.querySelector('time')?.textContent).toContain(
      'Published 20 November 2026'
    );
  });

  it('speaks German after a switch', async () => {
    const harness = await RouterTestingHarness.create('/blog');
    TestBed.inject(I18nService).setLanguage('de');
    harness.detectChanges();
    const root = harness.routeNativeElement as HTMLElement;
    expect(root.textContent).toContain(BLOG_POSTS[0].title.de);
    expect(root.querySelector('time')?.textContent).toContain(
      'Veröffentlicht am 20. November 2026'
    );
  });
});
