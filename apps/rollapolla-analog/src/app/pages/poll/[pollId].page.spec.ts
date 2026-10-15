import { ApplicationRef, DebugElement } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By, Meta, Title } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject, map, NEVER } from 'rxjs';
import { AccountAdapterMock } from '../../adapter/account-adapter-mock.service';
import { CREATED_POLL_ID } from '../../core/create-poll/created-poll-id';
import { PollsRepoAdapterMock } from '../../adapter/polls-repo-adapter-mock.service';
import { AccountPort } from '../../ports/account.port';
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
        { provide: AccountPort, useClass: AccountAdapterMock },
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

  it('gives the poll page its own title and keeps unlisted polls out of search indexes', async () => {
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

  it('lets search engines index listed polls', async () => {
    const pollId = await repo.createPoll({
      question: 'Pizza or pasta?',
      options: ['Pizza', 'Pasta'],
      listed: true,
    });

    await render(pollId);

    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe(
      'index, follow'
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

  describe('for the creator', () => {
    let pollId: string;

    beforeEach(async () => {
      pollId = await repo.createPoll({
        question: 'Pizza or pasta?',
        options: ['Pizza', 'Pasta'],
      });
      await repo.vote(repo.polls()[pollId], 0);
    });

    it('offers editing and deleting only to the creator', async () => {
      const element = await render(pollId);
      expect(byTestId(element, 'edit-poll-button')).toBeNull();

      signInAs('mock-user');
      await TestBed.inject(ApplicationRef).whenStable();
      expect(byTestId(element, 'edit-poll-button')).not.toBeNull();
      expect(byTestId(element, 'delete-poll-button')).not.toBeNull();

      signInAs('someone-else');
      await TestBed.inject(ApplicationRef).whenStable();
      expect(byTestId(element, 'delete-poll-button')).toBeNull();
    });

    it('edits the poll in place and resets its votes', async () => {
      signInAs('mock-user');
      const element = await render(pollId);
      byTestId(element, 'edit-poll-button').nativeElement.click();
      await TestBed.inject(ApplicationRef).whenStable();

      expect(byTestId(element, 'poll-question')).toBeNull();
      expect(text(element, 'create-poll-subtitle')).toContain('its 1 vote is');
      const question = byTestId(element, 'poll-question-input').nativeElement;
      expect(question.value).toBe('Pizza or pasta?');
      question.value = 'Pizza, pasta or salad?';
      question.dispatchEvent(new Event('input'));
      byTestId(element, 'add-option-button').nativeElement.click();
      await TestBed.inject(ApplicationRef).whenStable();
      const salad = byTestId(element, 'poll-option-input-2').nativeElement;
      salad.value = 'Salad';
      salad.dispatchEvent(new Event('input'));
      await TestBed.inject(ApplicationRef).whenStable();
      byTestId(element, 'save-poll-button').nativeElement.click();
      await TestBed.inject(ApplicationRef).whenStable();

      expect(repo.polls()[pollId]).toMatchObject({
        question: 'Pizza, pasta or salad?',
        options: ['Pizza', 'Pasta', 'Salad'],
        counts: [0, 0, 0],
        totalVotes: 0,
        round: 1,
      });
      expect(text(element, 'poll-question')).toBe('Pizza, pasta or salad?');
      expect(byTestId(element, 'vote-button')).not.toBeNull();
    });

    it('cancels editing without changing the poll', async () => {
      signInAs('mock-user');
      const element = await render(pollId);
      byTestId(element, 'edit-poll-button').nativeElement.click();
      await TestBed.inject(ApplicationRef).whenStable();
      byTestId(element, 'cancel-edit-button').nativeElement.click();
      await TestBed.inject(ApplicationRef).whenStable();

      expect(text(element, 'poll-question')).toBe('Pizza or pasta?');
      expect(repo.polls()[pollId].totalVotes).toBe(1);
    });

    it('deletes the poll after asking and goes to "My polls"', async () => {
      const navigate = vi
        .spyOn(TestBed.inject(Router), 'navigate')
        .mockResolvedValue(true);
      signInAs('mock-user');
      const element = await render(pollId);
      byTestId(element, 'delete-poll-button').nativeElement.click();
      await TestBed.inject(ApplicationRef).whenStable();
      byTestId(element, 'delete-poll-cancel').nativeElement.click();
      await TestBed.inject(ApplicationRef).whenStable();
      expect(repo.polls()[pollId]).toBeDefined();

      byTestId(element, 'delete-poll-button').nativeElement.click();
      await TestBed.inject(ApplicationRef).whenStable();
      byTestId(element, 'delete-poll-confirm-button').nativeElement.click();

      expect(repo.polls()[pollId]).toBeUndefined();
      expect(navigate).toHaveBeenCalledWith(['/my-polls']);
    });

    it('offers no editing once the poll closed', async () => {
      repo.polls()[pollId].closesAt = new Date(Date.now() - 1000);
      signInAs('mock-user');
      const element = await render(pollId);

      expect(byTestId(element, 'edit-poll-button')).toBeNull();
      expect(byTestId(element, 'delete-poll-button')).not.toBeNull();
    });

    function signInAs(uid: string): void {
      (TestBed.inject(AccountPort) as AccountAdapterMock).accountSubject.next({
        uid,
        isAnonymous: true,
        displayName: null,
        photoUrl: null,
      });
    }

    function text(element: DebugElement, testId: string): string {
      return byTestId(element, testId).nativeElement.textContent.trim();
    }
  });

  function byTestId(element: DebugElement, testId: string): DebugElement {
    return element.query(By.css(`[data-testid="${testId}"]`));
  }

  async function render(pollId: string) {
    routePollId.next(pollId);
    const fixture = TestBed.createComponent(PollPageComponent);
    await fixture.whenStable();
    return fixture.debugElement;
  }
});

describe('PollPageComponent after creating a poll', () => {
  it('greets the creator with the share box, but not other visitors', async () => {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [
        provideRouter([{ path: 'poll/:pollId', component: PollPageComponent }]),
        { provide: PollsRepoPort, useClass: PollsRepoAdapterMock },
        { provide: AccountPort, useClass: AccountAdapterMock },
      ],
    });
    const repo = TestBed.inject(PollsRepoPort);
    const pollId = await repo.createPoll({
      question: 'Pizza or pasta?',
      options: ['Pizza', 'Pasta'],
    });
    const harness = await RouterTestingHarness.create();
    const ready = () =>
      harness.routeDebugElement?.query(By.css('[data-testid="poll-ready"]'));

    await TestBed.inject(Router).navigate(['/poll', pollId], {
      state: { [CREATED_POLL_ID]: pollId },
    });
    await harness.fixture.whenStable();
    expect(ready()).not.toBeNull();

    // a navigation without the state, as when following a shared link
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/');
    await harness.navigateByUrl(`/poll/${pollId}`);
    await harness.fixture.whenStable();
    expect(ready()).toBeNull();
  });
});
