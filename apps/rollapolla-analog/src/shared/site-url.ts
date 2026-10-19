export const SITE_URL = 'https://rollapolla.com';

export function homeUrl(origin: string = SITE_URL): string {
  return `${origin}/`;
}

export function pollUrl(pollId: string, origin: string = SITE_URL): string {
  return `${origin}/poll/${pollId}`;
}
