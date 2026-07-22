import type { RomePrediction } from '@/types';

const TOKEN_URL =
  'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';
const ROMEO_BASE_URL = 'https://api.francetravail.io/partenaire/romeo/v2';
const ROMEO_SCOPE = 'api_romeov2';
const UNKNOWN_PREDICTION: RomePrediction = {
  romeCode: 'Inconnu',
  scorePrediction: 0,
};

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

interface FranceTravailTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface RomeoPredictionResponse {
  metiersRome?: Array<{
    codeRome?: string;
    libelleRome?: string;
    scorePrediction?: number;
  }>;
}

export async function predictRomeCode(profession: string): Promise<RomePrediction> {
  const cleanedProfession = profession.trim();

  if (!cleanedProfession) {
    return { ...UNKNOWN_PREDICTION, warning: 'Profession manquante.' };
  }

  try {
    const token = await getFranceTravailAccessToken();
    const response = await fetch(`${ROMEO_BASE_URL}/predictionMetiers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        appellations: [
          {
            identifiant: 'matchingcv-ai',
            intitule: cleanedProfession,
            contexte: cleanedProfession,
          },
        ],
        options: {
          nomAppelant: 'matchingcv-ai',
        },
      }),
    });

    if (!response.ok) {
      return {
        ...UNKNOWN_PREDICTION,
        warning: 'Prédiction ROME indisponible.',
      };
    }

    const payload = (await response.json()) as RomeoPredictionResponse[];
    const firstPrediction = payload[0]?.metiersRome?.[0];
    const scorePrediction = firstPrediction?.scorePrediction ?? 0;
    const romeCode =
      firstPrediction?.codeRome && scorePrediction >= 0.7 ? firstPrediction.codeRome : 'Inconnu';

    return {
      romeCode,
      scorePrediction,
      label: firstPrediction?.libelleRome,
    };
  } catch {
    return {
      ...UNKNOWN_PREDICTION,
      warning: 'Prédiction ROME indisponible.',
    };
  }
}

async function getFranceTravailAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_KEY;

  if (!clientId || !clientSecret) {
    throw new Error('France Travail credentials are missing');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: ROMEO_SCOPE,
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error('France Travail token request failed');
  }

  const payload = (await response.json()) as FranceTravailTokenResponse;

  if (!payload.access_token) {
    throw new Error('France Travail token response is missing access_token');
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 300) * 1000,
  };

  return cachedToken.accessToken;
}
