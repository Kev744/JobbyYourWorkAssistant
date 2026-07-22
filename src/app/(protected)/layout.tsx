import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { getAuthenticatedUser } from '@/lib/auth';

const navigationItems = [
  { href: '/overview', label: "Vue d'ensemble" },
  { href: '/profile', label: 'Profil' },
  { href: '/my-offers', label: 'Mes offres' },
  { href: '/my-applications', label: 'Mes candidatures' },
] as const;

export default async function ProtectedLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-blue-800 focus:shadow"
      >
        Aller au contenu
      </a>
      <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-4 sm:px-6 sm:py-6 md:grid-cols-[250px_1fr]">
        <aside className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:sticky md:top-6 md:h-[calc(100vh-3rem)]">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-slate-950">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 text-sm font-bold text-white">M</span>
            <span>MatchingCV <span className="text-indigo-600">AI</span></span>
          </Link>
          <nav aria-label="Navigation principale" className="flex flex-col gap-2">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="mt-auto w-full rounded-xl border border-slate-200 px-4 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              Se déconnecter
            </button>
          </form>
        </aside>
        <div id="contenu" tabIndex={-1}>
          {children}
        </div>
      </div>
    </>
  );
}
