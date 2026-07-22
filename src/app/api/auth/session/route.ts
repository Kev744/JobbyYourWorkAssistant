import { randomUUID } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { setAuthCookies } from '@/lib/auth/cookies';
import { createTokenPair } from '@/lib/auth/jwt';
import { comparePassword, hashPassword } from '@/lib/auth/password';
import { sendWelcomeEmail } from '@/lib/email/smtp';
import { createServerDbClient } from '@/lib/db/server';
import { getDatabaseUrl } from '@/lib/env';

type AuthMode = 'password' | 'sign-up';

type SessionPayload = {
  mode?: AuthMode;
  email?: string;
  password?: string;
  nextPath?: string;
};

function getNextPath(nextPath?: string) {
  return nextPath && nextPath.startsWith('/') ? nextPath : '/overview';
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as SessionPayload | null;
  const mode = payload?.mode;
  const email = payload?.email?.trim() ?? '';
  const password = payload?.password?.trim() ?? '';
  const nextPath = getNextPath(payload?.nextPath);

  if (!mode || !email) {
    return NextResponse.json({ error: 'Informations manquantes.' }, { status: 400 });
  }

  if (password.length > 0 && password.length < 8) {
    return NextResponse.json(
      { error: 'Le mot de passe doit contenir au moins 8 caracteres.' },
      { status: 400 },
    );
  }

  if (!getDatabaseUrl()) {
    return NextResponse.json(
      { error: "Configuration PostgreSQL incomplete pour l'authentification." },
      { status: 500 },
    );
  }

  const db = await createServerDbClient();
  const normalizedEmail = email.toLowerCase();

  if (mode === 'password') {
    if (!password) {
      return NextResponse.json({ error: 'Mot de passe manquant.' }, { status: 400 });
    }

    const credential = await loadCredentialByEmail(db, normalizedEmail);
    if (!credential) {
      return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
    }

    const matches = await comparePassword(password, credential.password_hash);
    if (!matches) {
      return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
    }

    const tokens = await createTokenPair({
      id: credential.user_id,
      email: credential.email,
    });
    const response = NextResponse.json({
      user: { id: credential.user_id, email: credential.email },
      nextPath,
    });
    setAuthCookies(response, tokens);

    return response;
  }

  if (mode === 'sign-up') {
    if (!password) {
      return NextResponse.json({ error: 'Mot de passe manquant.' }, { status: 400 });
    }

    const existing = await loadCredentialByEmail(db, normalizedEmail);
    if (existing) {
      return NextResponse.json({ error: 'Cet email est deja utilise.' }, { status: 409 });
    }

    const userId = randomUUID();
    const passwordHash = await hashPassword(password);

    const { error: credentialsError } = await db.from('user_credentials').insert({
      user_id: userId,
      email: normalizedEmail,
      password_hash: passwordHash,
    });

    if (credentialsError) {
      return NextResponse.json({ error: 'Impossible de creer le mot de passe.' }, { status: 500 });
    }

    const welcomeEmailSent = await sendWelcomeEmail(normalizedEmail);
    const tokens = await createTokenPair({
      id: userId,
      email: normalizedEmail,
    });
    const response = NextResponse.json({
      user: { id: userId, email: normalizedEmail },
      nextPath,
      message: welcomeEmailSent
        ? 'Compte cree. Connexion effectuee. Un email de bienvenue a bien ete envoye.'
        : 'Compte cree. Connexion effectuee.',
    });
    setAuthCookies(response, tokens);

    return response;
  }

  return NextResponse.json({ error: "Mode d'authentification inconnu." }, { status: 400 });
}

async function loadCredentialByEmail(
  db: Awaited<ReturnType<typeof createServerDbClient>>,
  email: string,
) {
  const { data, error } = await db
    .from('user_credentials')
    .select('user_id, email, password_hash')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as
    | {
        user_id: string;
        email: string;
        password_hash: string;
      }
    | null;
}

