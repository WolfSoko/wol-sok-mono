export const SITE_URL = 'https://rollapolla.com';

export function pollUrl(pollId: string, origin: string = SITE_URL): string {
  return `${origin}/poll/${pollId}`;
}

export type PageTags = {
  title: string;
  description: string;
  /** og:description, the text link previews show. */
  socialDescription: string;
  url: string;
  robots: string;
};

/**
 * The site-wide tags from index.html, keep them in sync. Not read from the DOM:
 * after a server-rendered poll page the DOM already holds that poll's tags.
 */
export const SITE_TAGS: PageTags = {
  title: 'Polls for everyone | RollaPolla.com',
  description:
    'RollaPolla – easy polling for everyone: create a poll in seconds, share it and see live what others think.',
  socialDescription:
    'Easy polling for everyone: create a poll in seconds, share it and see live what others think.',
  url: `${SITE_URL}/`,
  robots: 'index, follow',
};
