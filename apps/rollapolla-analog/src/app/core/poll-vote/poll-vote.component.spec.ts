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
    pollId = repo.createPoll({
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
