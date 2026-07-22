const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TOKEN_PATTERN = /\b(?:sk|pk|sbp|eyJ)[A-Za-z0-9._-]{12,}\b/g;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;

export function redactSensitiveText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[email]')
    .replace(TOKEN_PATTERN, '[secret]')
    .replace(PHONE_PATTERN, '[phone]');
}

export function redactLogRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === 'string' ? redactSensitiveText(value) : value,
    ]),
  ) as T;
}
