import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { PollsRepoAdapterMock } from '../../adapter/polls-repo-adapter-mock.service';
import { PollsRepoPort } from '../../ports/polls-repo.port';
import { CreatePollComponent } from './create-poll.component';
import { CREATED_POLL_ID } from './created-poll-id';

describe('CreatePollComponent', () => {
  let fixture: ComponentFixture<CreatePollComponent>;
  let repo: PollsRepoAdapterMock;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    navigate = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [CreatePollComponent, NoopAnimationsModule],
      providers: [
        { provide: PollsRepoPort, useClass: PollsRepoAdapterMock },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    repo = TestBed.inject(PollsRepoPort) as PollsRepoAdapterMock;
    fixture = TestBed.createComponent(CreatePollComponent);
    fixture.detectChanges();
  });

  it('starts with two options and a disabled create button', () => {
    expect(optionInputs()).toHaveLength(2);
    expect(button('create-poll-button').disabled).toBe(true);
  });

  it('adds options up to the maximum', () => {
    for (let i = 0; i < 20; i++) {
      button('add-option-button').click();
      fixture.detectChanges();
    }
    expect(optionInputs()).toHaveLength(PollsRepoPort.MAX_OPTIONS);
    expect(button('add-option-button').disabled).toBe(true);
  });

  it('creates the poll and navigates to it', async () => {
    type('poll-question-input', '  Pizza or pasta?  ');
    type('poll-option-input-0', 'Pizza');
    type('poll-option-input-1', ' Pasta ');

    expect(button('create-poll-button').disabled).toBe(false);
    button('create-poll-button').click();
    await fixture.whenStable();

    const polls = Object.values(repo.polls());
    expect(polls).toHaveLength(1);
    expect(polls[0]).toMatchObject({
      question: 'Pizza or pasta?',
      options: ['Pizza', 'Pasta'],
      counts: [0, 0],
      totalVotes: 0,
      listed: true,
    });
    expect(navigate).toHaveBeenCalledWith(['/poll', polls[0].id], {
      state: { [CREATED_POLL_ID]: polls[0].id },
    });
  });

  it('creates a private poll, found only through its link', async () => {
    type('poll-question-input', 'Only for my team?');
    type('poll-option-input-0', 'Yes');
    type('poll-option-input-1', 'No');
    fixture.debugElement
      .query(By.css('[data-testid="poll-visibility-private"] button'))
      .nativeElement.click();
    fixture.detectChanges();
    expect(text('poll-visibility-hint')).toBe(
      'Only people with the link can see it and vote.'
    );

    button('create-poll-button').click();
    await fixture.whenStable();

    expect(Object.values(repo.polls())[0].listed).toBe(false);
  });

  it('does not create a poll with a blank option', () => {
    type('poll-question-input', 'Pizza or pasta?');
    type('poll-option-input-0', 'Pizza');
    type('poll-option-input-1', '   ');

    expect(button('create-poll-button').disabled).toBe(true);
  });

  it('does not accept a question that is too short once trimmed', () => {
    type('poll-option-input-0', 'Pizza');
    type('poll-option-input-1', 'Pasta');

    type('poll-question-input', '   ab   ');
    expect(button('create-poll-button').disabled).toBe(true);

    type('poll-question-input', '          ');
    expect(button('create-poll-button').disabled).toBe(true);

    type('poll-question-input', '  Pizza?  ');
    expect(button('create-poll-button').disabled).toBe(false);
  });

  it('shows an error when the poll cannot be created', async () => {
    vi.spyOn(repo, 'createPoll').mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    type('poll-question-input', 'Pizza or pasta?');
    type('poll-option-input-0', 'Pizza');
    type('poll-option-input-1', 'Pasta');

    button('create-poll-button').click();
    await fixture.whenStable();

    expect(
      fixture.debugElement.query(By.css('[data-testid="create-poll-error"]'))
    ).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(button('create-poll-button').disabled).toBe(false);
  });

  function optionInputs(): HTMLInputElement[] {
    return fixture.debugElement
      .queryAll(By.css('[data-testid^="poll-option-input-"]'))
      .map((el) => el.nativeElement);
  }

  function button(testId: string): HTMLButtonElement {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`))
      .nativeElement;
  }

  function text(testId: string): string {
    return fixture.debugElement
      .query(By.css(`[data-testid="${testId}"]`))
      .nativeElement.textContent.trim();
  }

  function type(testId: string, value: string): void {
    const input: HTMLInputElement = fixture.debugElement.query(
      By.css(`[data-testid="${testId}"]`)
    ).nativeElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
});
