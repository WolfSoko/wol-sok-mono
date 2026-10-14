import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject, map } from 'rxjs';
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
    const pollId = repo.createPoll({
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

  async function render(pollId: string) {
    routePollId.next(pollId);
    const fixture = TestBed.createComponent(PollPageComponent);
    await fixture.whenStable();
    return fixture.debugElement;
  }
});
