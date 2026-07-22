import { OffersWorkspace } from '@/components/offers-workspace';

export default function MyOffersPage() {
  return (
    <main className="grid w-full gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Mes offres</h1>
        <p className="mt-3 text-sm text-slate-600">
          Consultez les offres publiques et privées liées à votre profil.
        </p>
      </div>
      <OffersWorkspace />
    </main>
  );
}
