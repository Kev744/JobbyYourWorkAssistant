import { ResumeOverviewWorkspace } from '@/components/resume-overview-workspace';
import { getAuthenticatedUser } from '@/lib/auth';
import { getCachedResumeFiles } from '@/lib/cache/user-workspaces';
import { redirect } from 'next/navigation';

export default async function OverviewPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/sign-in');
  }

  const files = await getCachedResumeFiles(user.id);

  return (
    <main className="grid w-full gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Vue d’ensemble</h1>
        <p className="mt-3 text-sm text-slate-600">
          Ajoutez votre CV source. Les fichiers restent privés et rattachés à votre compte.
        </p>
      </div>
      <ResumeOverviewWorkspace initialFiles={files} />
    </main>
  );
}
