import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  provideRecordingAnalytics,
  RecordingAnalytics,
} from '@wolsok/shared-analytics/testing';
import { firstValueFrom } from 'rxjs';
import { Poll } from '../../../shared/poll';
import { PollsRepoAdapterMock } from '../../adapter/polls-repo-adapter-mock.service';
import { PollsRepoPort } from '../../ports/polls-repo.port';
import { PollVoteComponent } from './poll-vote.component';

describe('PollVoteComponent', () => {
  let fixture: ComponentFixture<PollVoteComponent>;
  let repo: PollsRepoAdapterMock;
  let pollId: string;
  let analytics: RecordingAnalytics;

  beforeEach(async () => {
    localStorage.clear();
    analytics = new RecordingAnalytics();
    await TestBed.configureTestingModule({
      imports: [PollVoteComponent, NoopAnimationsModule],
      providers: [
        { provide: PollsRepoPort, useClass: PollsRepoAdapterMock },
        provideRecordingAnalytics(analytics),
      ],
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

  it('marks private polls, not public ones', async () => {
    expect(text('poll-private-badge')).toContain('Private');

    fixture.componentRef.setInput('poll', {
      ...(await currentPoll()),
      listed: true,
    });
    fixture.detectChanges();

    expect(query('poll-private-badge')).toBeNull();
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
    expect(analytics.tracked('vote')).toEqual([
      { options: 2, featured: false, just_created: false },
    ]);
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
    repo.ownVotes$.next({ [pollId]: { option: 1, round: 0 } });
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
    repo.ownVotes$.next({ [pollId]: { option: 0, round: 0 } });
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
    expect(analytics.tracked('vote_failed')).toEqual([{ late: true }]);
  });

  it('shows the stored vote when the backend rejects a second vote', async () => {
    vi.spyOn(repo, 'vote').mockImplementationOnce(async () => {
      // this visitor already voted for option 0 in another tab
      repo.ownVotes$.next({ [pollId]: { option: 0, round: 0 } });
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

  it('lets the visitor vote again once the creator edited the poll', async () => {
    query('poll-option-0').query(By.css('input')).nativeElement.click();
    fixture.detectChanges();
    query('vote-button').nativeElement.click();
    await fixture.whenStable();
    expect(query('vote-button')).toBeNull();

    repo.updatePoll(pollId, {
      question: 'Pizza, pasta or salad?',
      options: ['Pizza', 'Pasta', 'Salad'],
    });
    fixture.componentRef.setInput('poll', await currentPoll());
    await fixture.whenStable();

    expect(text('poll-question')).toBe('Pizza, pasta or salad?');
    expect(text('poll-total-votes')).toBe('0 votes');
    expect(query('vote-button')).not.toBeNull();

    query('poll-option-2').query(By.css('input')).nativeElement.click();
    fixture.detectChanges();
    query('vote-button').nativeElement.click();
    await fixture.whenStable();

    expect((await currentPoll()).counts).toEqual([0, 0, 1]);
    expect(JSON.parse(localStorage.getItem('rap-voted-polls') ?? '{}')).toEqual(
      { [pollId]: 0, [`${pollId}#1`]: 2 }
    );
  });

  it('keeps the picked option while other votes come in', async () => {
    query('poll-option-1').query(By.css('input')).nativeElement.click();
    fixture.detectChanges();

    const poll = await currentPoll();
    fixture.componentRef.setInput('poll', { ...poll, totalVotes: 5 });
    await fixture.whenStable();

    expect(query('vote-button').nativeElement.disabled).toBe(false);
  });

  it('drops the picked option when the creator edits the poll', async () => {
    query('poll-option-1').query(By.css('input')).nativeElement.click();
    fixture.detectChanges();
    expect(query('vote-button').nativeElement.disabled).toBe(false);

    repo.updatePoll(pollId, {
      question: 'Pasta or pizza?',
      options: ['Pasta', 'Pizza'],
    });
    fixture.componentRef.setInput('poll', await currentPoll());
    await fixture.whenStable();

    expect(query('vote-button').nativeElement.disabled).toBe(true);
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
    expect(analytics.tracked('vote')).toEqual([]);
    expect(analytics.tracked('vote_failed')).toEqual([{ late: false }]);
  });

  it('offers sharing below the poll, or first right after creating it', () => {
    expect(query('poll-ready')).toBeNull();
    expect(
      fixture.debugElement.query(By.css('mat-card-actions rap-poll-share'))
    ).not.toBeNull();

    fixture.componentRef.setInput('justCreated', true);
    fixture.detectChanges();

    expect(query('poll-ready')).not.toBeNull();
    expect(
      fixture.debugElement.queryAll(By.css('rap-poll-share'))
    ).toHaveLength(1);
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
