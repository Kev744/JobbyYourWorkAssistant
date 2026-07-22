import { getAuthTokenSecret } from '@/lib/env';

export const ACCESS_TOKEN_NAME = 'access';
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;
const JWT_ISSUER = 'matchingcv-ai';
const JWT_AUDIENCE = 'matchingcv-ai';

export interface AuthTokenClaims {
  sub: string;
  email: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };
let cachedSigningSecret = '';
let cachedSigningKey: CryptoKey | null = null;

function getJwtSecret() {
  return getAuthTokenSecret();
}

function toBase64Url(input: string | ArrayBuffer | Uint8Array) {
  const bytes = typeof input === 'string' ? encoder.encode(input) : new Uint8Array(input);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function getSigningKey(secret: string) {
  if (cachedSigningSecret === secret && cachedSigningKey) {
    return cachedSigningKey;
  }

  const rawKey = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    rawKey,
    ALGORITHM,
    false,
    ['sign', 'verify'],
  );

  cachedSigningSecret = secret;
  cachedSigningKey = key;
  return key;
}

async function signTokenPayload(secret: string, payload: string): Promise<string> {
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign(ALGORITHM, key, encoder.encode(payload));

  return toBase64Url(new Uint8Array(signature));
}

async function buildToken(payload: Record<string, unknown>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const unsignedPayload = `${encodedHeader}.${encodedPayload}`;
  const signature = await signTokenPayload(secret, unsignedPayload);

  return `${unsignedPayload}.${signature}`;
}

function parseToken(token: string) {
  const [encodedHeader, encodedPayload, signature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  try {
    const header = JSON.parse(decoder.decode(fromBase64Url(encodedHeader))) as {
      alg?: string;
      typ?: string;
    };
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const payload = JSON.parse(decoder.decode(fromBase64Url(encodedPayload))) as Record<
      string,
      unknown
    >;
    return { payload, signature };
  } catch {
    return null;
  }
}

function compareSignature(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

async function verifyTokenSignature(signedPayload: string, signature: string, secret: string) {
  const expected = await signTokenPayload(secret, signedPayload);

  return compareSignature(expected, signature);
}

function isTokenExpired(payload: Record<string, unknown>) {
  const exp = typeof payload.exp === 'number' ? payload.exp : Number.NaN;
  if (!Number.isFinite(exp)) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  return exp <= now;
}

function isTokenNotBeforeValid(payload: Record<string, unknown>) {
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : Number.NEGATIVE_INFINITY;
  const now = Math.floor(Date.now() / 1000);
  return nbf <= now;
}

export async function createTokenPair(user: AuthUser): Promise<TokenPair> {
  const now = Math.floor(Date.now() / 1000);
  const accessTokenExpiresAt = now + ACCESS_TOKEN_TTL_SECONDS;
  const refreshTokenExpiresAt = now + REFRESH_TOKEN_TTL_SECONDS;

  const baseClaims = {
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    email: user.email,
    type: ACCESS_TOKEN_NAME,
  };

  const accessToken = await buildToken(
    {
      ...baseClaims,
      sub: user.id,
      iat: now,
      nbf: now,
      exp: accessTokenExpiresAt,
    },
    getJwtSecret(),
  );

  const refreshToken = await buildToken(
    {
      ...baseClaims,
      type: 'refresh',
      sub: user.id,
      iat: now,
      nbf: now,
      exp: refreshTokenExpiresAt,
    },
    getJwtSecret(),
  );

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  };
}

export async function verifyAccessToken(token: string | null): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  try {
    const parsed = parseToken(token);
    if (!parsed) {
      return null;
    }

    const secret = getJwtSecret();
    const tokenParts = token.split('.');
    const signedPayload = `${tokenParts[0]}.${tokenParts[1]}`;
    if (!(await verifyTokenSignature(signedPayload, parsed.signature, secret))) {
      return null;
    }

    const payload = parsed.payload;
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) {
      return null;
    }
    if (isTokenExpired(payload) || !isTokenNotBeforeValid(payload)) {
      return null;
    }

    const userId = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const tokenType = payload.type;

    if (!userId || !email || tokenType !== ACCESS_TOKEN_NAME) {
      return null;
    }

    return { id: userId, email };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string | null): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  try {
    const parsed = parseToken(token);
    if (!parsed) {
      return null;
    }

    const secret = getJwtSecret();
    const tokenParts = token.split('.');
    const signedPayload = `${tokenParts[0]}.${tokenParts[1]}`;
    if (!(await verifyTokenSignature(signedPayload, parsed.signature, secret))) {
      return null;
    }

    const payload = parsed.payload;
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) {
      return null;
    }
    if (isTokenExpired(payload) || !isTokenNotBeforeValid(payload)) {
      return null;
    }

    const userId = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const tokenType = payload.type;

    if (!userId || !email || tokenType !== 'refresh') {
      return null;
    }

    return { id: userId, email };
  } catch {
    return null;
  }
}
