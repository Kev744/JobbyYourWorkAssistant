import Link from 'next/link';

const navigationItems = [
  { href: '/overview', label: 'Vue d’ensemble' },
  { href: '/profile', label: 'Profil' },
  { href: '/my-offers', label: 'Mes offres' },
  { href: '/my-applications', label: 'Mes candidatures' },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm font-medium text-blue-700">MatchingCV AI</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            Tableau de bord CV et candidatures
          </h1>
        </div>
        <Link
          href="/sign-in"
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Connexion
        </Link>
      </header>

      <section className="grid flex-1 gap-6 py-8 md:grid-cols-[240px_1fr]">
        <nav aria-label="Navigation principale" className="flex flex-col gap-2">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:border-blue-300 hover:text-blue-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Importez votre CV</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Déposez un PDF ou un DOCX pour préparer votre profil professionnel.
            </p>
          </section>
          <section className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Recherchez des offres</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Les recherches seront limitées à la France et à Monaco.
            </p>
          </section>
          <section className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Classez les résultats</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Le score PRCV-R v1 restera déterministe, explicable et vérifiable.
            </p>
          </section>
          <section className="rounded-md border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">Suivez vos candidatures</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Les statuts et fichiers générés seront rattachés à votre compte.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
