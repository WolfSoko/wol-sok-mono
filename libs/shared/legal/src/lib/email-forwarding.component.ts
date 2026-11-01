import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { EMAIL_FORWARDING } from './email-forwarding';

/**
 * What happens to an email to an address at wolsok.de, as a privacy policy
 * says it: who forwards it, where it lands, what is processed and on which
 * legal basis. Inline text in the page's language, so the page puts it into
 * a paragraph of its own and styles it like the rest.
 */
@Component({
  selector: 'wolsok-email-forwarding',
  template: `
    @switch (lang()) {
      @case ('de') {
        Schreibst du an eine Adresse unter wolsok.de, leitet der Dienst
        {{ forwarder.service }} (Anbieter: {{ forwarder.company }},
        {{ forwarder.address }}) die Nachricht an unser Postfach bei
        {{ inbox.service }} weiter (Anbieter: {{ inbox.company }},
        {{ inboxAddress() }}). Beide verarbeiten dabei deine E-Mail-Adresse, den
        Inhalt der Nachricht und technische Angaben zu ihrer Zustellung.
        {{ forwarder.service }} ist ein Unternehmen in den USA, deine Nachricht
        kann also dorthin übermittelt werden. Wir nutzen sie nur, um deine
        Anfrage zu beantworten, und bewahren sie auf, solange das dafür nötig
        ist. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (unser berechtigtes
        Interesse, Anfragen zu beantworten), bei Anfragen zu deinen Rechten Art.
        6 Abs. 1 lit. c DSGVO.
      }
      @case ('en') {
        When you write to an address at wolsok.de, the service
        {{ forwarder.service }} (provider: {{ forwarder.company }},
        {{ forwarder.address }}) forwards the message to our
        {{ inbox.service }} inbox (provider: {{ inbox.company }},
        {{ inboxAddress() }}). Both process your email address, the content of
        the message and technical details of its delivery.
        {{ forwarder.service }} is a company in the USA, so your message may be
        transferred there. We use it only to answer your request and keep it as
        long as that takes. The legal basis is Art. 6(1)(f) GDPR, our legitimate
        interest in answering requests, and Art. 6(1)(c) GDPR for requests about
        your rights.
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailForwardingComponent {
  /** The language of the page around it. */
  public readonly lang = input.required<'de' | 'en'>();

  protected readonly forwarder = EMAIL_FORWARDING.forwarder;
  protected readonly inbox = EMAIL_FORWARDING.inbox;
  protected readonly inboxAddress = computed(
    () => EMAIL_FORWARDING.inbox.address[this.lang()]
  );
}
