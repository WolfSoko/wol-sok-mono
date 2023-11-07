export const QA_SELECTOR = 'data-qa';

export function qaSelector(qaValue: string) {
  return `[${QA_SELECTOR}="${qaValue}"]`;
}
