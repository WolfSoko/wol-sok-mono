import { ShareContent } from '../../ports/share-target.port';
import {
  emailShareTarget,
  LINK_SHARE_TARGETS,
  teamsShareTarget,
  telegramShareTarget,
  whatsAppShareTarget,
  xShareTarget,
} from './link-share-targets';

const content: ShareContent = {
  url: 'https://rollapolla.com/poll/abc',
  title: 'Pizza & pasta?',
  text: 'Vote now: Pizza & pasta?',
};

describe('link share targets', () => {
  it('builds the WhatsApp link with text and url in one message', () => {
    const url = new URL(whatsAppShareTarget.shareUrl(content));
    expect(url.origin + url.pathname).toBe('https://wa.me/');
    expect(url.searchParams.get('text')).toBe(
      'Vote now: Pizza & pasta?\nhttps://rollapolla.com/poll/abc'
    );
  });

  it('builds the Telegram link', () => {
    const url = new URL(telegramShareTarget.shareUrl(content));
    expect(url.origin + url.pathname).toBe('https://t.me/share/url');
    expect(url.searchParams.get('url')).toBe(content.url);
    expect(url.searchParams.get('text')).toBe(content.text);
  });

  it('builds the Teams link', () => {
    const url = new URL(teamsShareTarget.shareUrl(content));
    expect(url.origin + url.pathname).toBe('https://teams.microsoft.com/share');
    expect(url.searchParams.get('href')).toBe(content.url);
    expect(url.searchParams.get('msgText')).toBe(content.text);
  });

  it('builds the X link', () => {
    const url = new URL(xShareTarget.shareUrl(content));
    expect(url.origin + url.pathname).toBe('https://x.com/intent/post');
    expect(url.searchParams.get('url')).toBe(content.url);
    expect(url.searchParams.get('text')).toBe(content.text);
  });

  it('builds a mailto link with spaces as %20', () => {
    expect(emailShareTarget.shareUrl(content)).toBe(
      'mailto:?subject=Pizza%20%26%20pasta%3F&body=Vote%20now%3A%20Pizza%20%26%20pasta%3F%0Ahttps%3A%2F%2Frollapolla.com%2Fpoll%2Fabc'
    );
  });

  it('has unique ids and an icon for every target', () => {
    const ids = LINK_SHARE_TARGETS.map((target) => target.id);
    expect(new Set(ids).size).toBe(ids.length);
    const svgIcons = LINK_SHARE_TARGETS.flatMap(({ icon }) =>
      icon.kind === 'svg' ? [icon.svg] : []
    );
    expect(svgIcons.length).toBeGreaterThan(0);
    expect(svgIcons.every((svg) => svg.startsWith('<svg'))).toBe(true);
  });
});
