import { readJsonResponse } from '@/lib/http/json-response';

describe('readJsonResponse', () => {
  it('returns an empty object for an empty response body', async () => {
    await expect(readJsonResponse(new Response('', { status: 502 }))).resolves.toEqual({});
  });

  it('returns an empty object for a non-JSON response body', async () => {
    await expect(
      readJsonResponse(new Response('<!doctype html><p>Erreur serveur</p>', { status: 500 })),
    ).resolves.toEqual({});
  });

  it('returns parsed JSON when the response body is valid JSON', async () => {
    await expect(
      readJsonResponse<{ error?: string }>(
        Response.json({ error: 'Impossible de générer le CV ciblé.' }, { status: 502 }),
      ),
    ).resolves.toEqual({ error: 'Impossible de générer le CV ciblé.' });
  });
});
