import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmailForwardingComponent } from './email-forwarding.component';

@Component({
  imports: [EmailForwardingComponent],
  template: `
    <p id="de"><wolsok-email-forwarding lang="de" /></p>
    <p id="en"><wolsok-email-forwarding lang="en" /></p>
  `,
})
class HostComponent {}

describe('EmailForwardingComponent', () => {
  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return fixture.nativeElement;
  }

  function text(page: HTMLElement, id: string): string {
    return (page.querySelector(`#${id}`)?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  it('names the forwarder and the inbox with their addresses, in German', async () => {
    const de = text(await render(), 'de');

    expect(de).toContain(
      'leitet der Dienst ImprovMX (Anbieter: ImprovMX Incorporated, 8 The Green STE D, Dover, Delaware 19901, USA) die Nachricht an unser Postfach bei Gmail weiter (Anbieter: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland).'
    );
    expect(de).toContain('kann also dorthin übermittelt werden');
    expect(de).toContain('Art. 6 Abs. 1 lit. f DSGVO');
  });

  it('names the forwarder and the inbox with their addresses, in English', async () => {
    const en = text(await render(), 'en');

    expect(en).toContain(
      'the service ImprovMX (provider: ImprovMX Incorporated, 8 The Green STE D, Dover, Delaware 19901, USA) forwards the message to our Gmail inbox (provider: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland).'
    );
    expect(en).toContain('may be transferred there');
    expect(en).toContain('Art. 6(1)(f) GDPR');
  });
});
