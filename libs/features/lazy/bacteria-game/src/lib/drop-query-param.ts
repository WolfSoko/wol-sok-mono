/** Takes a query parameter out of the page's address, everything else as it was. */
export function dropQueryParam(name: string): void {
  if (typeof location === 'undefined' || typeof history === 'undefined') {
    return;
  }
  const url = new URL(location.href);
  if (!url.searchParams.has(name)) {
    return;
  }
  url.searchParams.delete(name);
  history.replaceState(history.state, '', url);
}
