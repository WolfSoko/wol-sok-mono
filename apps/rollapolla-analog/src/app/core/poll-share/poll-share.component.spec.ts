import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Poll } from '../../../shared/poll';
import {
  provideShareTargets,
  ShareContent,
  ShareTarget,
} from '../../ports/share-target.port';
import { PollShareComponent } from './poll-share.component';

const poll: Poll = {
  id: 'poll-1',
  question: 'Pizza or pasta?',
  options: ['Pizza', 'Pasta'],
  counts: [0, 0],
  totalVotes: 0,
  createdAt: new Date(),
  closesAt: new Date(Date.now() + 24 * 3600_000),
  creatorUid: 'creator',
  listed: true,
  round: 0,
};

const chatTarget: ShareTarget = {
  id: 'chat',
  label: 'Chat',
  icon: { kind: 'svg', svg: '<svg viewBox="0 0 1 1"></svg>' },
  shareUrl: ({ url, text }: ShareContent) =>
    `https://chat.example/share?u=${encodeURIComponent(url)}&t=${encodeURIComponent(text)}`,
};

const mailTarget: ShareTarget = {
  id: 'mail',
  label: 'Mail',
  icon: { kind: 'font', name: 'mail' },
  shareUrl: ({ title }: ShareContent) =>
    `mailto:?subject=${encodeURIComponent(title)}`,
};

describe('PollShareComponent', () => {
  let fixture: ComponentFixture<PollShareComponent>;
  const pollUrl = `${location.origin}/poll/poll-1`;

  afterEach(() => {
    delete (navigator as Partial<Navigator>).share;
    vi.useRealTimers();
  });

  async function render(
    share?: Navigator['share'],
    targets: ShareTarget[] = [chatTarget, mailTarget]
  ): Promise<void> {
    // jsdom has no share sheet; a phone browser would.
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    });
    TestBed.configureTestingModule({
      imports: [PollShareComponent],
      providers: [provideShareTargets(...targets)],
    });
    fixture = TestBed.createComponent(PollShareComponent);
    fixture.componentRef.setInput('poll', poll);
    await fixture.whenStable();
  }

  it('links every registered target with the poll', async () => {
    await render();

    const chat = query('share-chat').nativeElement as HTMLAnchorElement;
    expect(chat.href).toBe(
      `https://chat.example/share?u=${encodeURIComponent(pollUrl)}&t=${encodeURIComponent('Vote now: Pizza or pasta?')}`
    );
    expect(chat.target).toBe('_blank');
    expect(chat.rel).toBe('noopener noreferrer');
    expect(chat.getAttribute('aria-label')).toBe('Share on Chat');

    const mail = query('share-mail').nativeElement as HTMLAnchorElement;
    expect(mail.href).toBe('mailto:?subject=Pizza%20or%20pasta%3F');
    expect(mail.hasAttribute('target')).toBe(false);
    expect(mail.querySelector('mat-icon')?.textContent).toBe('mail');
    expect(
      chat.querySelector('mat-icon')?.getAttribute('data-mat-icon-name')
    ).toBe('chat');
  });

  it('works without any target', async () => {
    await render(undefined, []);

    expect(query('copy-link')).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.targets'))).toBeNull();
  });

  it('hides the share sheet button where the browser has none', async () => {
    await render(undefined);

    expect(query('share-native')).toBeNull();
  });

  it('opens the share sheet with the poll', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    await render(share);

    query('share-native').nativeElement.click();

    expect(share).toHaveBeenCalledWith({
      url: pollUrl,
      title: 'Pizza or pasta?',
      text: 'Vote now: Pizza or pasta?',
    });
  });

  it('copies the link when the share sheet fails, not when it is closed', async () => {
    const share = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('closed', 'AbortError'))
      .mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    await render(share);
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await clickShare();
    expect(copy).not.toHaveBeenCalled();

    await clickShare();
    expect(copy).toHaveBeenCalledWith(pollUrl);
  });

  it('copies the poll link and resets "Link copied" after a moment', async () => {
    await render();
    vi.useFakeTimers();
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy');
    copy.mockReturnValue(true);
    const button = query('copy-link').nativeElement as HTMLButtonElement;

    button.click();
    fixture.detectChanges();
    expect(copy).toHaveBeenCalledWith(pollUrl);
    expect(button.textContent).toContain('Link copied');

    vi.advanceTimersByTime(2000);
    fixture.detectChanges();
    expect(button.textContent).toContain('Copy link');
  });

  it('hands over the link selected when copying fails', async () => {
    await render();
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy');
    copy.mockReturnValue(false);

    query('copy-link').nativeElement.click();
    await fixture.whenStable();

    expect(query('copy-failed').nativeElement.textContent).toContain(
      'Could not copy the link'
    );
    const manualLink = query('manual-link').nativeElement as HTMLInputElement;
    expect(manualLink.value).toBe(pollUrl);
    expect(document.activeElement).toBe(manualLink);
    expect(manualLink.selectionStart).toBe(0);
    expect(manualLink.selectionEnd).toBe(pollUrl.length);
    expect(query('copy-link').nativeElement.textContent).toContain('Copy link');

    copy.mockReturnValue(true);
    query('copy-link').nativeElement.click();
    await fixture.whenStable();

    expect(query('copy-failed')).toBeNull();
  });

  it('falls back to the link to copy by hand when the share sheet fails', async () => {
    await render(
      vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    );
    vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(false);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await clickShare();
    fixture.detectChanges();

    expect(query('copy-failed')).not.toBeNull();
  });

  it('forgets a failed copy when it shows another poll', async () => {
    await render();
    vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(false);
    query('copy-link').nativeElement.click();
    await fixture.whenStable();
    expect(query('copy-failed')).not.toBeNull();

    fixture.componentRef.setInput('poll', { ...poll, id: 'poll-2' });
    await fixture.whenStable();

    expect(query('copy-failed')).toBeNull();
  });

  it('greets the creator when highlighted', async () => {
    await render();
    expect(query('poll-ready')).toBeNull();

    fixture.componentRef.setInput('highlighted', true);
    fixture.detectChanges();

    expect(query('poll-ready').nativeElement.textContent).toContain(
      'Your poll is ready'
    );
  });

  async function clickShare(): Promise<void> {
    query('share-native').nativeElement.click();
    await fixture.whenStable();
  }

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }
});
