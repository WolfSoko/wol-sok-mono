import { TestBed } from '@angular/core/testing';
import { By, Title } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PollsRepoAdapterMock } from '../adapter/polls-repo-adapter-mock.service';
import { PollsRepoPort } from '../ports/polls-repo.port';
import PollsPageComponent from './polls.page';

describe('PollsPageComponent', () => {
  let repo: PollsRepoAdapterMock;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [
        provideRouter([{ path: 'polls', component: PollsPageComponent }]),
        { provide: PollsRepoPort, useClass: PollsRepoAdapterMock },
      ],
    });
    repo = TestBed.inject(PollsRepoPort) as PollsRepoAdapterMock;
    const pizza = await repo.createPoll({
      question: 'Pizza or pasta?',
      options: ['Pizza', 'Pasta'],
      listed: true,
    });
    await repo.createPoll({
      question: 'Best hiking area?',
      options: ['Alps', 'Pyrenees'],
      listed: true,
    });
    await repo.createPoll({
      question: 'Secret team lunch?',
      options: ['Pizza', 'Sushi'],
    });
    await repo.vote(repo.polls()[pizza], 0);
    // created in the same millisecond otherwise, which leaves "new" undecided
    repo.polls()[pizza].createdAt = new Date(Date.now() - 60_000);
    harness = await RouterTestingHarness.create();
  });

  it('lists the open listed polls, hottest first', async () => {
    await harness.navigateByUrl('/polls');

    expect(results()).toEqual(['Pizza or pasta?', 'Best hiking area?']);
    expect(TestBed.inject(Title).getTitle()).toBe('Browse polls | RollaPolla');
  });

  it('searches as you type and keeps the search in the URL', async () => {
    await harness.navigateByUrl('/polls');

    type('PIZZA');
    await harness.fixture.whenStable();

    expect(results()).toEqual(['Pizza or pasta?']);
    expect(TestBed.inject(Router).url).toBe('/polls?q=PIZZA');
  });

  it('starts from the search in the URL and sorts by newest', async () => {
    await harness.navigateByUrl('/polls?q=a&sort=new');

    expect(results()).toEqual(['Best hiking area?', 'Pizza or pasta?']);
  });

  it('offers to create a poll when nothing matches', async () => {
    await harness.navigateByUrl('/polls?q=unicorns');

    expect(query('poll-search-empty')).not.toBeNull();
    expect(query('poll-search-count').nativeElement.textContent).toContain(
      '0 polls'
    );
  });

  function results(): string[] {
    return harness
      .routeDebugElement!.queryAll(
        By.css('[data-testid^="search-result-"] .question')
      )
      .map((question) => question.nativeElement.textContent.trim());
  }

  function type(text: string): void {
    const input = query('poll-search-input').nativeElement as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  function query(testId: string) {
    return harness.routeDebugElement!.query(
      By.css(`[data-testid="${testId}"]`)
    );
  }
});
