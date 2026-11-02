import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SITE_OWNER } from './site-owner';
import { SiteOwnerComponent } from './site-owner.component';

@Component({
  imports: [SiteOwnerComponent],
  template: `<wolsok-site-owner emailLabel="E-Mail" />`,
})
class HostComponent {}

/** Whether the last of the 9 digits of a German VAT ID is its check digit. */
function isGermanVatIdChecksumValid(vatId: string): boolean {
  const digits = vatId.slice(2).split('').map(Number);
  let product = 10;
  for (const digit of digits.slice(0, 8)) {
    const sum = (digit + product) % 10 || 10;
    product = (2 * sum) % 11;
  }
  return (11 - product) % 10 === digits[8];
}

/** The text between the `<br>`s of an element, a line each. */
function linesOf(element: Element | null): string[] {
  const lines = [''];
  for (const node of Array.from(element?.childNodes ?? [])) {
    if (node.nodeName === 'BR') {
      lines.push('');
    } else if (node.nodeType !== Node.COMMENT_NODE) {
      lines[lines.length - 1] += node.textContent ?? '';
    }
  }
  return lines.map((line) => line.replace(/\s+/g, ' ').trim());
}

describe('SiteOwnerComponent', () => {
  it('names the owner with the postal address and the email, a line each', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const address = (fixture.nativeElement as HTMLElement).querySelector(
      'address'
    );

    expect(linesOf(address)).toEqual([
      SITE_OWNER.name,
      ...SITE_OWNER.addressLines,
      `E-Mail: ${SITE_OWNER.email}`,
    ]);
    expect(address?.querySelector('a')?.getAttribute('href')).toBe(
      `mailto:${SITE_OWNER.email}`
    );
  });

  it('has a postal address legal mail reaches: street and number, then postal code and town', () => {
    const [street, town] = SITE_OWNER.addressLines;

    expect(street).toMatch(/\S \d+\w?$/);
    expect(town).toMatch(/^\d{5} \S/);
  });

  it('has a German VAT ID whose check digit fits (ISO 7064 MOD 11,10)', () => {
    expect(SITE_OWNER.vatId).toMatch(/^DE\d{9}$/);
    expect(isGermanVatIdChecksumValid(SITE_OWNER.vatId)).toBe(true);
  });
});
