import { Suspense } from 'react';

import { SignInForm } from '@/components/sign-in-form';

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-950">Connexion</h1>
      <p className="mt-3 text-sm text-slate-600">
        Connectez-vous avec votre e-mail et votre mot de passe.
      </p>
      <Suspense fallback={<p className="mt-6 text-sm text-slate-600">Chargement du formulaire...</p>}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
