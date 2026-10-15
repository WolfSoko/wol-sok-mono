import { icon, IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faMicrosoft,
  faTelegram,
  faWhatsapp,
  faXTwitter,
} from '@fortawesome/free-brands-svg-icons';
import {
  ShareContent,
  ShareIcon,
  ShareTarget,
} from '../../ports/share-target.port';

function brandIcon(definition: IconDefinition): ShareIcon {
  return { kind: 'svg', svg: icon(definition).html.join('') };
}

function withQuery(base: string, params: Record<string, string>): string {
  return `${base}?${new URLSearchParams(params)}`;
}

/** The text with the link on its own line, for targets that take one message. */
function message({ text, url }: ShareContent): string {
  return `${text}\n${url}`;
}

export const whatsAppShareTarget: ShareTarget = {
  id: 'whatsapp',
  label: 'WhatsApp',
  icon: brandIcon(faWhatsapp),
  shareUrl: (content) =>
    withQuery('https://wa.me/', { text: message(content) }),
};

export const telegramShareTarget: ShareTarget = {
  id: 'telegram',
  label: 'Telegram',
  icon: brandIcon(faTelegram),
  shareUrl: ({ url, text }) =>
    withQuery('https://t.me/share/url', { url, text }),
};

export const teamsShareTarget: ShareTarget = {
  id: 'teams',
  label: 'Microsoft Teams',
  icon: brandIcon(faMicrosoft),
  shareUrl: ({ url, text }) =>
    withQuery('https://teams.microsoft.com/share', {
      href: url,
      msgText: text,
    }),
};

export const emailShareTarget: ShareTarget = {
  id: 'email',
  label: 'Email',
  icon: { kind: 'font', name: 'mail' },
  // mailto wants %20 for spaces, URLSearchParams would write "+".
  shareUrl: (content) =>
    `mailto:?subject=${encodeURIComponent(content.title)}&body=${encodeURIComponent(message(content))}`,
};

export const xShareTarget: ShareTarget = {
  id: 'x',
  label: 'X',
  icon: brandIcon(faXTwitter),
  shareUrl: ({ url, text }) =>
    withQuery('https://x.com/intent/post', { text, url }),
};

export const LINK_SHARE_TARGETS: readonly ShareTarget[] = [
  whatsAppShareTarget,
  telegramShareTarget,
  teamsShareTarget,
  emailShareTarget,
  xShareTarget,
];
