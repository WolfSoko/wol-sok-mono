import { show } from '../../testing/show';
import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  it('links the privacy policy and the legal notice', () => {
    const footer = show(FooterComponent);

    const links = Array.from(footer.querySelectorAll('nav a')).map((a) => [
      a.textContent?.trim(),
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Datenschutz', '/privacy'],
      ['Impressum', '/impressum'],
    ]);
  });

  it('names the DBB as the source and says its data may lag a few minutes', () => {
    const footer = show(FooterComponent);

    const text = footer.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('Deutschen Basketball Bund');
    expect(text).toContain('einige Minuten');
    expect(
      footer.querySelector('a[href="https://www.basketball-bund.net"]')
        ?.textContent
    ).toBe('basketball-bund.net');
  });
});
