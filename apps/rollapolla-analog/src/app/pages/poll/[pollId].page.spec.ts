import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By, Meta, Title } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject, map, NEVER } from 'rxjs';
import { PollsRepoAdapterMock } from '../../adapter/polls-repo-adapter-mock.service';
import { PollsRepoPort } from '../../ports/polls-repo.port';
import PollPageComponent from './[pollId].page';

describe('PollPageComponent', () => {
  let repo: PollsRepoAdapterMock;
  const routePollId = new BehaviorSubject('');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PollPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: PollsRepoPort, useClass: PollsRepoAdapterMock },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routePollId.pipe(
              map((pollId) => convertToParamMap({ pollId }))
            ),
          },
        },
      ],
    });
    repo = TestBed.inject(PollsRepoPort) as PollsRepoAdapterMock;
  });

  it('shows the poll from the route', async () => {
    const pollId = await repo.createPoll({
      question: 'Pizza or pasta?',
      options: ['Pizza', 'Pasta'],
    });
    const element = await render(pollId);

    expect(
      element.query(By.css('[data-testid="poll-question"]')).nativeElement
        .textContent
    ).toContain('Pizza or pasta?');
    expect(element.query(By.css('[data-testid="poll-not-found"]'))).toBeNull();
  });

  it('shows a hint when the poll does not exist', async () => {
    const element = await render('unknown');

    expect(
      element.query(By.css('[data-testid="poll-not-found"]'))
    ).not.toBeNull();
  });

  it('gives the poll page its own title and keeps it out of search indexes', async () => {
    const title = TestBed.inject(Title);
    const meta = TestBed.inject(Meta);
    // as after server rendering: the DOM already holds a poll page's tags
    title.setTitle('Some poll | RollaPolla');
    meta.updateTag({ name: 'robots', content: 'noindex' });
    const pollId = await repo.createPoll({
      question: 'Pizza or pasta?',
      options: ['Pizza', 'Pasta'],
    });

    await render(pollId);

    expect(title.getTitle()).toBe('Pizza or pasta? | RollaPolla');
    expect(meta.getTag('property="og:title"')?.content).toBe(
      'Pizza or pasta? | RollaPolla'
    );
    expect(meta.getTag('property="og:description"')?.content).toBe(
      'Vote now: Pizza · Pasta'
    );
    expect(meta.getTag('property="og:url"')?.content).toBe(
      `https://rollapolla.com/poll/${pollId}`
    );
    expect(meta.getTag('name="robots"')?.content).toBe('noindex');

    TestBed.resetTestingModule();

    expect(title.getTitle()).toBe('Polls for everyone | RollaPolla.com');
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');
    expect(meta.getTag('property="og:url"')?.content).toBe(
      'https://rollapolla.com/'
    );
  });

  it('drops the previous poll while the next one loads', async () => {
    const pollId = await repo.createPoll({
      question: 'Pizza or pasta?',
      options: ['Pizza', 'Pasta'],
    });
    vi.spyOn(repo, 'watchPoll').mockImplementation((id) =>
      id === 'slow-poll' ? NEVER : repo.polls$.pipe(map((p) => p[id] ?? null))
    );
    const element = await render(pollId);
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Pizza or pasta? | RollaPolla'
    );

    routePollId.next('slow-poll');
    await TestBed.inject(ApplicationRef).whenStable();

    expect(element.query(By.css('[data-testid="poll-question"]'))).toBeNull();
    expect(element.query(By.css('mat-spinner'))).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).not.toContain('Pizza or pasta?');
  });

  async function render(pollId: string) {
    routePollId.next(pollId);
    const fixture = TestBed.createComponent(PollPageComponent);
    await fixture.whenStable();
    return fixture.debugElement;
  }
});
