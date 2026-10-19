import { Clipboard } from '@angular/cdk/clipboard';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  provideShareTargets,
  ShareContent,
  ShareTarget,
} from '../../ports/share-target.port';
import { ShareComponent } from './share.component';

const content: ShareContent = {
  url: 'https://rollapolla.com/poll/poll-1',
  title: 'Pizza or pasta?',
  text: 'Vote now: Pizza or pasta?',
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

describe('ShareComponent', () => {
  let fixture: ComponentFixture<ShareComponent>;

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
      imports: [ShareComponent],
      providers: [provideShareTargets(...targets)],
    });
    fixture = TestBed.createComponent(ShareComponent);
    fixture.componentRef.setInput('content', content);
    await fixture.whenStable();
  }

  it('links every registered target with the content', async () => {
    await render();

    const chat = query('share-chat').nativeElement as HTMLAnchorElement;
    expect(chat.href).toBe(
      `https://chat.example/share?u=${encodeURIComponent(content.url)}&t=${encodeURIComponent('Vote now: Pizza or pasta?')}`
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

  it('opens the share sheet with the content', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    await render(share);

    query('share-native').nativeElement.click();

    expect(share).toHaveBeenCalledWith({
      url: content.url,
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
    expect(copy).toHaveBeenCalledWith(content.url);
  });

  it('copies the link and resets "Link copied" after a moment', async () => {
    await render();
    vi.useFakeTimers();
    const copy = vi.spyOn(TestBed.inject(Clipboard), 'copy');
    copy.mockReturnValue(true);
    const button = query('copy-link').nativeElement as HTMLButtonElement;

    button.click();
    fixture.detectChanges();
    expect(copy).toHaveBeenCalledWith(content.url);
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
    expect(manualLink.value).toBe(content.url);
    expect(document.activeElement).toBe(manualLink);
    expect(manualLink.selectionStart).toBe(0);
    expect(manualLink.selectionEnd).toBe(content.url.length);
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

  it('forgets a failed copy when it shows another link', async () => {
    await render();
    vi.spyOn(TestBed.inject(Clipboard), 'copy').mockReturnValue(false);
    query('copy-link').nativeElement.click();
    await fixture.whenStable();
    expect(query('copy-failed')).not.toBeNull();

    fixture.componentRef.setInput('content', {
      ...content,
      url: 'https://rollapolla.com/poll/poll-2',
    });
    await fixture.whenStable();

    expect(query('copy-failed')).toBeNull();
  });

  it('stands out when highlighted', async () => {
    await render();
    expect(fixture.nativeElement.classList).not.toContain('highlighted');

    fixture.componentRef.setInput('highlighted', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.classList).toContain('highlighted');
  });

  async function clickShare(): Promise<void> {
    query('share-native').nativeElement.click();
    await fixture.whenStable();
  }

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }
});
