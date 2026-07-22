import {
  buildProviderWarning,
  fetchProviderResponse,
  ProviderHttpError,
  throwProviderResponseError,
} from '@/lib/providers/http';

describe('provider HTTP hardening', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('retries safe GET requests on temporary provider errors', async () => {
    const fetchMock = jest.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response('temporary', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const request = fetchProviderResponse('https://provider.test/offers', {}, { retryDelayMs: 1 });

    await jest.runOnlyPendingTimersAsync();

    const response = await request;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry unsafe POST requests', async () => {
    const fetchMock = jest.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response('temporary', { status: 503 }));

    const response = await fetchProviderResponse(
      'https://provider.test/token',
      { method: 'POST' },
      { retryDelayMs: 1 },
    );

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('normalizes provider rate-limit warnings in French', () => {
    const response = new Response('rate limited', {
      status: 429,
      headers: { 'retry-after': '60' },
    });

    expect(() => throwProviderResponseError('Adzuna', response)).toThrow(ProviderHttpError);

    try {
      throwProviderResponseError('Adzuna', response);
    } catch (error) {
      expect(buildProviderWarning('Adzuna', error)).toBe(
        'Adzuna limite temporairement les recherches. Réessayez dans quelques minutes.',
      );
    }
  });
});
