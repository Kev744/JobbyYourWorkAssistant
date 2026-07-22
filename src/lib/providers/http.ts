export class ProviderHttpError extends Error {
  readonly status?: number;
  readonly retryAfterSeconds?: number;

  constructor(message: string, options: { status?: number; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = 'ProviderHttpError';
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

export interface ProviderFetchOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAY_MS = 250;

export async function fetchProviderResponse(
  input: URL | string,
  init: RequestInit = {},
  options: ProviderFetchOptions = {},
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const retries = method === 'GET' ? (options.retries ?? 1) : 0;
  let attempt = 0;

  while (true) {
    try {
      const response = await fetchOnce(input, init, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

      if (!shouldRetryResponse(response, method) || attempt >= retries) {
        return response;
      }

      await delay(getRetryDelayMs(response, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS));
    } catch (error) {
      if (attempt >= retries || method !== 'GET') {
        throw toProviderHttpError(error);
      }

      await delay(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
    }

    attempt += 1;
  }
}

export function buildProviderWarning(providerLabel: string, error: unknown): string {
  if (error instanceof ProviderHttpError && error.isRateLimited) {
    return `${providerLabel} limite temporairement les recherches. Réessayez dans quelques minutes.`;
  }

  if (error instanceof ProviderHttpError && error.status) {
    return `${providerLabel} a renvoyé une erreur temporaire.`;
  }

  return `${providerLabel} est momentanément indisponible.`;
}

export function throwProviderResponseError(providerLabel: string, response: Response): never {
  throw new ProviderHttpError(`${providerLabel} request failed`, {
    status: response.status,
    retryAfterSeconds: parseRetryAfter(response.headers.get('retry-after')),
  });
}

function shouldRetryResponse(response: Response, method: string): boolean {
  return method === 'GET' && (response.status === 429 || response.status >= 500);
}

async function fetchOnce(input: URL | string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function toProviderHttpError(error: unknown): ProviderHttpError {
  if (error instanceof ProviderHttpError) {
    return error;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ProviderHttpError('Provider request timed out');
  }

  return new ProviderHttpError('Provider request failed');
}

function getRetryDelayMs(response: Response, fallbackMs: number): number {
  const retryAfter = parseRetryAfter(response.headers.get('retry-after'));

  if (!retryAfter) {
    return fallbackMs;
  }

  return Math.min(retryAfter * 1000, 2_000);
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
