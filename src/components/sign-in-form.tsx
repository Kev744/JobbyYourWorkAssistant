 'use client';

import { type FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';

type AuthMode = 'password' | 'sign-up';

const messagesByMode: Record<AuthMode, string> = {
  password: 'Connexion en cours...',
  'sign-up': 'Création du compte...',
};

type SessionResponse = {
  nextPath?: string;
  message?: string;
  error?: string | { message: string };
  user?: { id: string; email: string } | null;
};

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = searchParams.get('next') ?? '/overview';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(messagesByMode[mode]);
    setIsSubmitting(true);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setMessage(null);
      setError('Adresse e-mail manquante.');
      setIsSubmitting(false);
      return;
    }

    if (!trimmedPassword) {
      setMessage(null);
      setError('Mot de passe manquant.');
      setIsSubmitting(false);
      return;
    }

    if (trimmedPassword.length < 8) {
      setMessage(null);
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          email: trimmedEmail,
          password: trimmedPassword,
          nextPath,
        }),
      });

      const payload = (await response.json().catch(() => null)) as SessionResponse | null;
      if (!response.ok || !payload || payload.error) {
        throw new Error(
          payload && typeof payload.error === 'string'
            ? payload.error
            : (payload?.error as { message: string } | undefined)?.message ??
                'Impossible de finaliser la demande.',
        );
      }

      if (payload.user) {
        const targetPath = (payload.nextPath ?? nextPath) as Route;
        router.push(targetPath);
        router.refresh();
        return;
      }

      setMessage(payload.message ?? messagesByMode[mode]);
    } catch {
      setMessage(null);
      setError('Impossible de finaliser la demande. Verifiez les informations saisies.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-5 rounded-md border border-slate-200 bg-white p-5">
      <div className="grid grid-cols-2 rounded-md border border-slate-200 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode('password')}
          className={mode === 'password' ? 'rounded bg-slate-950 px-3 py-2 text-white' : 'px-3 py-2'}
        >
          Mot de passe
        </button>
        <button
          type="button"
          onClick={() => setMode('sign-up')}
          className={mode === 'sign-up' ? 'rounded bg-slate-950 px-3 py-2 text-white' : 'px-3 py-2'}
        >
          Creer un compte
        </button>
      </div>

      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Adresse e-mail
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-base font-normal"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-slate-800">
        Mot de passe
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-base font-normal"
        />
      </label>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      {message ? <p className="text-sm font-medium text-blue-700">{message}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {mode === 'password' ? 'Se connecter' : 'Creer un compte'}
      </button>
    </form>
  );
}
