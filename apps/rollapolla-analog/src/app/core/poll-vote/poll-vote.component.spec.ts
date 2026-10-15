import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { firstValueFrom } from 'rxjs';
import { Poll } from '../../../shared/poll';
import { PollsRepoAdapterMock } from '../../adapter/polls-repo-adapter-mock.service';
import { PollsRepoPort } from '../../ports/polls-repo.port';
import { PollVoteComponent } from './poll-vote.component';

describe('PollVoteComponent', () => {
  let fixture: ComponentFixture<PollVoteComponent>;
  let repo: PollsRepoAdapterMock;
  let pollId: string;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [PollVoteComponent, NoopAnimationsModule],
      providers: [{ provide: PollsRepoPort, useClass: PollsRepoAdapterMock }],
    }).compileComponents();

    repo = TestBed.inject(PollsRepoPort) as PollsRepoAdapterMock;
    pollId = await repo.createPoll({
      question: 'Pizza or pasta?',
      options: ['Pizza', 'Pasta'],
    });
    const poll = await currentPoll();
    fixture = TestBed.createComponent(PollVoteComponent);
    fixture.componentRef.setInput('poll', poll);
    fixture.detectChanges();
  });

  it('shows the question and the options', () => {
    expect(text('poll-question')).toBe('Pizza or pasta?');
    expect(text('poll-option-0')).toContain('Pizza');
    expect(text('poll-option-1')).toContain('Pasta');
    expect(query('poll-results')).toBeNull();
  });

  it('votes once and shows the results', async () => {
    query('poll-option-1').query(By.css('input')).nativeElement.click();
    fixture.detectChanges();
    query('vote-button').nativeElement.click();
    await fixture.whenStable();

    const poll = await currentPoll();
    expect(poll.counts).toEqual([0, 1]);
    fixture.componentRef.setInput('poll', poll);
    fixture.detectChanges();

    expect(query('vote-button')).toBeNull();
    expect(text('poll-total-votes')).toBe('1 vote');
    expect(text('poll-result-0')).toContain('0% (0)');
    expect(text('poll-result-1')).toContain('100% (1)');
    expect(JSON.parse(localStorage.getItem('rap-voted-polls') ?? '{}')).toEqual(
      { [pollId]: 1 }
    );
  });

  it('ignores unusable stored votes', async () => {
    localStorage.setItem('rap-voted-polls', 'null');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PollVoteComponent, NoopAnimationsModule],
      providers: [{ provide: PollsRepoPort, useValue: repo }],
    });
    const poll = await currentPoll();
    fixture = TestBed.createComponent(PollVoteComponent);
    fixture.componentRef.setInput('poll', poll);
    fixture.detectChanges();

    expect(query('vote-button')).not.toBeNull();
  });

  it('marks the vote stored on the server, not the local hint', async () => {
    localStorage.setItem('rap-voted-polls', JSON.stringify({ [pollId]: 0 }));
    repo.ownVotes$.next({ [pollId]: 1 });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PollVoteComponent, NoopAnimationsModule],
      providers: [{ provide: PollsRepoPort, useValue: repo }],
    });
    const poll = await currentPoll();
    fixture = TestBed.createComponent(PollVoteComponent);
    fixture.componentRef.setInput('poll', poll);
    await fixture.whenStable();

    expect(query('poll-result-1').nativeElement.classList).toContain(
      'own-vote'
    );
    expect(query('poll-result-0').nativeElement.classList).not.toContain(
      'own-vote'
    );
  });

  it('shows the results when the server knows the vote but this browser does not', async () => {
    repo.ownVotes$.next({ [pollId]: 0 });
    await fixture.whenStable();

    expect(query('vote-button')).toBeNull();
    expect(query('poll-result-0').nativeElement.classList).toContain(
      'own-vote'
    );
  });

  it('forgets the vote and offers a retry when the backend rejects it', async () => {
    vi.spyOn(repo, 'vote').mockResolvedValueOnce({
      saved: Promise.reject(new Error('permission-denied')),
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    query('poll-option-1').query(By.css('input')).nativeElement.click();
    fixture.detectChanges();
    query('vote-button').nativeElement.click();
    await fixture.whenStable();

    expect(query('vote-error')).not.toBeNull();
    expect(query('vote-button')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('rap-voted-polls') ?? '{}')).toEqual(
      {}
    );
  });

  it('shows the stored vote when the backend rejects a second vote', async () => {
    vi.spyOn(repo, 'vote').mockImplementationOnce(async () => {
      // this visitor already voted for option 0 in another tab
      repo.ownVotes$.next({ [pollId]: 0 });
      return { saved: Promise.reject(new Error('permission-denied')) };
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    query('poll-option-1').query(By.css('input')).nativeElement.click();
    fixture.detectChanges();
    query('vote-button').nativeElement.click();
    await fixture.whenStable();

    expect(query('vote-error')).toBeNull();
    expect(query('poll-result-0').nativeElement.classList).toContain(
      'own-vote'
    );
    expect(JSON.parse(localStorage.getItem('rap-voted-polls') ?? '{}')).toEqual(
      {}
    );
  });

  it('shows an error and lets the visitor retry when voting fails', async () => {
    vi.spyOn(repo, 'vote').mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    query('poll-option-0').query(By.css('input')).nativeElement.click();
    fixture.detectChanges();
    query('vote-button').nativeElement.click();
    await fixture.whenStable();

    expect(query('vote-error')).not.toBeNull();
    expect(query('vote-button').nativeElement.disabled).toBe(false);
    expect(localStorage.getItem('rap-voted-polls')).toBeNull();
  });

  it('resets "Link copied" after a moment', () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(true);
      const shareButton = fixture.debugElement.query(
        By.css('mat-card-actions button')
      ).nativeElement as HTMLButtonElement;

      shareButton.click();
      fixture.detectChanges();
      expect(shareButton.textContent).toContain('Link copied');

      vi.advanceTimersByTime(2000);
      fixture.detectChanges();
      expect(shareButton.textContent).toContain('Copy link');
    } finally {
      vi.useRealTimers();
    }
  });

  function currentPoll(): Promise<Poll> {
    return firstValueFrom(repo.watchPoll(pollId)) as Promise<Poll>;
  }

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }

  function text(testId: string): string {
    return query(testId).nativeElement.textContent.trim();
  }
});
