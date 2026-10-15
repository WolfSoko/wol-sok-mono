import { TestBed } from '@angular/core/testing';
import { By, Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, defer, throwError } from 'rxjs';

import { PollsRepoAdapterMock } from '../adapter/polls-repo-adapter-mock.service';
import { PollPage, PollsRepoPort } from '../ports/polls-repo.port';
import { stubIntersectionObserver } from '../core/endless-scroll/intersection-observer.mock';
import MyPollsPageComponent from './my-polls.page';

describe('MyPollsPageComponent', () => {
  let repo: PollsRepoAdapterMock;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MyPollsPageComponent],
      providers: [
        provideRouter([]),
        { provide: PollsRepoPort, useClass: PollsRepoAdapterMock },
      ],
    });
    repo = TestBed.inject(PollsRepoPort) as PollsRepoAdapterMock;
  });

  async function render() {
    const fixture = TestBed.createComponent(MyPollsPageComponent);
    await fixture.whenStable();
    return fixture.debugElement;
  }

  it('lists the polls the visitor created, newest first, with links', async () => {
    const older = await repo.createPoll({
      question: 'Older poll?',
      options: ['a', 'b'],
    });
    const newer = await repo.createPoll({
      question: 'Newer poll?',
      options: ['a', 'b'],
    });
    repo.polls()[older].createdAt = new Date(Date.now() - 60_000);

    const page = await render();

    const links = page.queryAll(By.css('[data-testid^="my-poll-"]'));
    expect(links.map((link) => link.nativeElement.textContent)).toEqual([
      expect.stringContaining('Newer poll?'),
      expect.stringContaining('Older poll?'),
    ]);
    expect(links[0].nativeElement.getAttribute('href')).toBe(`/poll/${newer}`);
    expect(links[0].nativeElement.textContent).toContain('open until');
  });

  it('marks closed polls as closed', async () => {
    const id = await repo.createPoll({
      question: 'Old poll?',
      options: ['a', 'b'],
    });
    repo.polls()[id].closesAt = new Date(Date.now() - 24 * 3600_000);

    const page = await render();

    expect(
      page.query(By.css(`[data-testid="my-poll-${id}"]`)).nativeElement
        .textContent
    ).toContain('closed');
  });

  it('loads more polls when the end of the list comes into view', async () => {
    const endInView = stubIntersectionObserver();
    for (let i = 1; i <= 21; i++) {
      await repo.createPoll({ question: `Poll ${i}?`, options: ['a', 'b'] });
    }
    const fixture = TestBed.createComponent(MyPollsPageComponent);
    await fixture.whenStable();
    const polls = () =>
      fixture.debugElement.queryAll(By.css('[data-testid^="my-poll-"]'));
    expect(polls()).toHaveLength(20);

    endInView(true);
    await fixture.whenStable();

    expect(polls()).toHaveLength(21);
  });

  it('shows an empty state without polls or account', async () => {
    repo.creatorUid$.next(null);

    const page = await render();

    expect(page.query(By.css('[data-testid="my-polls-empty"]'))).not.toBeNull();
  });

  it("hides the previous account's polls while the next account loads", async () => {
    await repo.createPoll({ question: "Ada's poll?", options: ['a', 'b'] });
    const myPolls$ = new BehaviorSubject<PollPage | null | undefined>({
      polls: Object.values(repo.polls()),
      hasMore: false,
    });
    vi.spyOn(repo, 'watchMyPolls').mockReturnValue(myPolls$);
    const fixture = TestBed.createComponent(MyPollsPageComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain("Ada's poll?");

    myPolls$.next(undefined);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).not.toContain("Ada's poll?");
  });

  it('says so when the polls cannot be loaded and recovers by itself', async () => {
    vi.useFakeTimers();
    try {
      let failures = 1;
      const watchMyPolls = repo.watchMyPolls.bind(repo);
      vi.spyOn(repo, 'watchMyPolls').mockReturnValue(
        defer(() =>
          failures-- > 0
            ? throwError(() => new Error('failed-precondition: index building'))
            : watchMyPolls(20)
        )
      );
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await repo.createPoll({ question: "Ada's poll?", options: ['a', 'b'] });

      const fixture = TestBed.createComponent(MyPollsPageComponent);
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css('[data-testid="my-polls-error"]'))
      ).not.toBeNull();

      await vi.advanceTimersByTimeAsync(10_000);
      fixture.detectChanges();

      expect(
        fixture.debugElement.query(By.css('[data-testid="my-polls-error"]'))
      ).toBeNull();
      expect(fixture.nativeElement.textContent).toContain("Ada's poll?");
    } finally {
      vi.useRealTimers();
    }
  });

  it('is not for search engines and restores the site tags on leaving', async () => {
    await render();
    expect(TestBed.inject(Title).getTitle()).toBe('My polls | RollaPolla');
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe(
      'noindex'
    );
    const title = TestBed.inject(Title);
    const meta = TestBed.inject(Meta);

    TestBed.resetTestingModule();

    expect(title.getTitle()).toBe('Polls for everyone | RollaPolla.com');
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');
  });
});
