export interface ScriptOptions {
  readonly id: string;
  readonly src: string;
  readonly crossOrigin?: 'anonymous';
  /** Called where the script does not load, an ad blocker for one. */
  readonly onError?: () => void;
}

/** Adds an ad network's script to the page's head, loaded async. */
export function addScript(
  document: Document,
  { id, src, crossOrigin, onError }: ScriptOptions
): void {
  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  if (crossOrigin) script.crossOrigin = crossOrigin;
  if (onError) script.onerror = onError;
  script.src = src;
  document.head.appendChild(script);
}
