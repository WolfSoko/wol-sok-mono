export class ResizedEvent {
  readonly element: HTMLElement;
  readonly newWidth: number;
  readonly newHeight: number;

  constructor(entry: ResizeObserverEntry) {
    this.element = entry.target as HTMLElement;
    ({ width: this.newWidth, height: this.newHeight } = entry.contentRect);
  }
}
