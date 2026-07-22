import { ProfileWorkspace } from '@/components/profile-form';
import { getCachedProfileWorkspace } from '@/lib/cache/user-workspaces';
import { getLocationOptions } from '@/lib/profile/location-options';
import { getAuthenticatedUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default function ProfilePage() {
  return <ProfilePageContent />;
}

async function ProfilePageContent() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/sign-in');
  }

  const { profiles, requirements } = await getCachedProfileWorkspace(user.id);
  const locations = getLocationOptions();

  return (
    <main className="grid w-full gap-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Espace candidat</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Profil</h1>
        <p className="mt-3 text-sm text-slate-600">
          Vérifiez et confirmez les informations extraites de votre CV.
        </p>
      </div>
      <ProfileWorkspace
        initialProfiles={profiles}
        initialRequirements={requirements}
        cities={locations.cities}
        departments={locations.departments}
        regions={locations.regions}
      />
    </main>
  );
}
