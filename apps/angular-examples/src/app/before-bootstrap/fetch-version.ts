export async function fetchVersion(): Promise<string> {
  try {
    const response = await fetch('/version');
    if (!response.ok) {
      console.warn(
        `
      Error response fetching version: ${response.status},
      statusText: ${response.statusText}.
      Falling back to next as version
      `
      );
      return 'next';
    } else {
      return await response.json();
    }
  } catch (error) {
    console.warn('version not defined, falling back to "next"', error);
    return 'next';
  }
}
