export function envOrDie(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`Environment variable ${key} is required`);
    process.exit(1);
  }
  return value;
}
