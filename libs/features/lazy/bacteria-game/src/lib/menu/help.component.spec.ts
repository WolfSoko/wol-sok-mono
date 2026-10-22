import { TestBed } from '@angular/core/testing';
import { HelpComponent, PRIVACY_POLICY_URL } from './help.component';

describe('HelpComponent', () => {
  it('links to the privacy policy in a tab of its own', () => {
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.componentRef.setInput('colorNames', ['Orange', 'Blue']);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    const link = host.querySelector<HTMLAnchorElement>(
      `a[href="${PRIVACY_POLICY_URL}"]`
    );

    expect(link?.textContent?.trim()).toBe('privacy policy');
    expect(link?.target).toBe('_blank');
  });
});
