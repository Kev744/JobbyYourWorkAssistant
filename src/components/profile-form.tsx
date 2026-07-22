'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { sortLanguageItems } from '@/lib/language-levels';
import { extractEducationItems, extractProfessionalExperiences } from '@/lib/profile/profile-item-parser';
import { ProfileRequirementsForm } from '@/components/profile-requirements-form';
import type {
  CandidateProfile,
  CertificationItem,
  EducationItem,
  LanguageItem,
  LocationOption,
  ProfileRequirements,
  SkillItem,
} from '@/types';

interface ProfileFormProps {
  initialProfile: CandidateProfile | null;
}

interface ProfileWorkspaceProps {
  initialProfiles: CandidateProfile[];
  initialRequirements: ProfileRequirements | null;
  cities: LocationOption[];
  departments: LocationOption[];
  regions: LocationOption[];
}

interface ProfileResponse {
  profile?: CandidateProfile | null;
  error?: string;
}

interface EditableExperience {
  id: string;
  titleRaw: string;
  companyName: string;
  location: string;
  summary: string;
  startDate: string;
  endDate: string;
}

interface EditableEducation {
  id: string;
  degreeLabel: string;
  schoolName: string;
  field: string;
  graduationDate: string;
}

interface EditableLanguage {
  id: string;
  code: string;
  cecrl: NonNullable<LanguageItem['cecrl']> | '';
}

interface EditableProject {
  id: string;
  title: string;
  summary: string;
  startDate: string;
  endDate: string;
}

export function ProfileWorkspace({
  initialProfiles,
  initialRequirements,
  cities,
  departments,
  regions,
}: ProfileWorkspaceProps) {
  const router = useRouter();
  const [selectedProfileId, setSelectedProfileId] = useState(initialProfiles[0]?.id ?? '');
  const [isCreatingManualProfile, setIsCreatingManualProfile] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const selectedProfile =
    initialProfiles.find((profile) => profile.id === selectedProfileId) ?? initialProfiles[0] ?? null;

  async function createManualProfile() {
    setIsCreatingManualProfile(true);
    setCreationError(null);

    try {
      const response = await fetch('/api/profile', { method: 'POST' });
      const payload = (await response.json()) as ProfileResponse;

      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? 'Impossible de creer le profil manuel.');
      }

      setSelectedProfileId(payload.profile.id);
      router.refresh();
    } catch (error) {
      setCreationError(error instanceof Error ? error.message : 'Impossible de creer le profil manuel.');
    } finally {
      setIsCreatingManualProfile(false);
    }
  }

  return (
    <section className="grid gap-6">
      {!selectedProfile ? (
        <section className="profile-empty-state overflow-hidden rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm md:p-8">
          <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
            Votre point de départ
          </span>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Créez un profil qui vous ressemble</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Vous n&apos;avez pas besoin d&apos;importer un CV. Commencez par vos coordonnées, votre métier et vos expériences : tout restera modifiable.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void createManualProfile()}
              disabled={isCreatingManualProfile}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isCreatingManualProfile ? 'Préparation...' : 'Saisir mon profil'}
            </button>
          </div>
          {creationError ? <p className="mt-4 text-sm font-medium text-red-700">{creationError}</p> : null}
        </section>
      ) : null}
      {initialProfiles.length > 1 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="grid gap-2 text-sm font-medium text-slate-800">
            Profil actif
            <select
              value={selectedProfile?.id ?? ''}
              onChange={(event) => setSelectedProfileId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
            >
              {initialProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profileOptionLabel(profile)}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      <ProfileForm
        key={selectedProfile ? `profile-form-${selectedProfile.id}` : 'empty-profile'}
        initialProfile={selectedProfile}
      />
      <ProfileRequirementsForm
        key={selectedProfile ? `profile-requirements-${selectedProfile.id}` : 'empty-requirements'}
        profile={selectedProfile}
        initialRequirements={initialRequirements}
        cities={cities}
        departments={departments}
        regions={regions}
      />
    </section>
  );
}

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [fullName, setFullName] = useState(initialProfile?.identityContact.fullName ?? '');
  const [email, setEmail] = useState(initialProfile?.identityContact.email ?? '');
  const [phone, setPhone] = useState(initialProfile?.identityContact.phone ?? '');
  const [additionalInformation, setAdditionalInformation] = useState(
    initialProfile?.identityContact.additionalInformation ?? '',
  );
  const [city, setCity] = useState(initialProfile?.scoringPayload.location?.city ?? '');
  const [summary, setSummary] = useState(initialProfile?.summary ?? '');
  const [profession, setProfession] = useState(initialProfile?.profession ?? '');
  const [skills, setSkills] = useState(toSkillText(initialProfile?.skills ?? []));
  const [educationItems, setEducationItems] = useState(() =>
    toEditableEducation(initialProfile?.education ?? []),
  );
  const [experienceItems, setExperienceItems] = useState(() =>
    toEditableExperiences(initialProfile?.professionalExperiences ?? []),
  );
  const [languageItems, setLanguageItems] = useState(() =>
    toEditableLanguages(initialProfile?.languages ?? []),
  );
  const [certifications, setCertifications] = useState(
    (initialProfile?.certifications ?? []).map((item) => item.label).join('\n'),
  );
  const [projectItems, setProjectItems] = useState(() =>
    toEditableProjects(initialProfile?.achievements ?? []),
  );
  const [hobbies, setHobbies] = useState((initialProfile?.hobbies ?? []).join('\n'));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const completion = useMemo(
    () =>
      getProfileCompletion({
        fullName,
        email,
        phone,
        city,
        summary,
        profession,
        skills,
        languageItems,
        educationItems,
        experienceItems,
      }),
    [
      city,
      educationItems,
      email,
      experienceItems,
      fullName,
      languageItems,
      phone,
      profession,
      skills,
      summary,
    ],
  );

  async function saveProfile() {
    if (!profile) {
      setError('Générez un profil depuis une version de CV avant de l’enregistrer.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage('Enregistrement du profil...');

    const skillsPayload = toLines(skills).map((raw): SkillItem => ({ raw }));
    const educationPayload = educationItems
      .map(toEducationItem)
      .filter((item): item is EducationItem => Boolean(item));
    const experiencesPayload = experienceItems
      .map(toExperienceItem)
      .filter((item): item is CandidateProfile['professionalExperiences'][number] => Boolean(item));
    const languagesPayload = sortLanguageItems(
      languageItems
        .filter((item) => item.code.trim())
        .map((item): LanguageItem => ({
          code: canonicalLanguageName(item.code),
          cecrl: item.cecrl || undefined,
        })),
    );
    const certificationsPayload = toLines(certifications).map(
      (label): CertificationItem => ({ label }),
    );
    const identityContact = {
      fullName: fullName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      additionalInformation: additionalInformation.trim() || undefined,
    };
    const location = {
      ...(profile.scoringPayload.location ?? {}),
      city: city.trim() || undefined,
    };
    const scoringPayload = {
      ...profile.scoringPayload,
      headline: profession,
      location,
      titles: profession ? [{ raw: profession, canonicalRomeCode: profile.romeCode }] : [],
      skills: skillsPayload,
      education: educationPayload,
      experiences: experiencesPayload,
      certifications: certificationsPayload,
      languages: languagesPayload,
    };

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: profile.id,
          summary,
          profession,
          skills: skillsPayload,
          education: educationPayload,
          professionalExperiences: experiencesPayload,
          languages: languagesPayload,
          certifications: certificationsPayload,
          achievements: projectItems
            .map(toProjectAchievement)
            .filter((item): item is string => Boolean(item)),
          hobbies: toLines(hobbies),
          identityContact,
          scoringPayload,
          romeCode: profile.romeCode,
          romePredictionScore: profile.romePredictionScore,
          generationWarnings: profile.generationWarnings,
          confirmationStatus: 'confirmed',
        }),
      });
      const payload = (await response.json()) as ProfileResponse;

      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? 'Impossible d’enregistrer le profil.');
      }

      setProfile(payload.profile);
      setMessage('Profil enregistré.');
    } catch (saveError) {
      setMessage(null);
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer le profil.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!profile) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Détails du profil</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Aucun profil généré. Depuis la page Vue d’ensemble, enregistrez une version de CV puis
          cliquez sur Générer le profil.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="profile-form-hero grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Profil candidat</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Donnez de la force à votre candidature</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Les informations les plus utiles au matching sont toujours visibles et faciles à modifier.</p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/80 p-4 shadow-sm md:min-w-48">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-slate-800">Profil complété</span>
              <span className="text-xl font-bold text-indigo-700">{completion}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>
        <div className="p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Détails du profil</h2>
            <p className="mt-2 text-sm text-slate-600">
              Code ROME : <span className="font-medium text-slate-900">{profile.romeCode}</span>
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {profile.confirmationStatus === 'confirmed' ? 'Confirmé' : 'Brouillon'}
          </span>
        </div>

        {profile.generationWarnings.length > 0 ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-950">Points à vérifier</h3>
            <ul className="mt-2 grid gap-1 text-sm text-amber-900">
              {profile.generationWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 grid gap-5">
          <ProfileAccordion
            title="Coordonnées"
            description="Les informations utilisées pour vous contacter."
            defaultOpen
          >
            <section className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Coordonnées</h3>
              <p className="mt-1 text-sm text-slate-600">
                Informations extraites localement depuis le CV. Elles ne sont pas envoyées au modèle IA.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Nom complet" value={fullName} onChange={setFullName} />
              <TextInput label="Email" value={email} onChange={setEmail} />
              <TextInput label="Téléphone" value={phone} onChange={setPhone} />
              <TextInput label="Ville" value={city} onChange={setCity} />
            </div>
            <TextArea
              label="Informations complémentaires (facultatif)"
              value={additionalInformation}
              rows={3}
              onChange={setAdditionalInformation}
            />
            <p className="text-xs text-slate-600">
              Ajoutez vos liens LinkedIn, GitHub, portfolio, réseaux sociaux ou toute autre information
              utile. Une ligne est affichée par information sur le CV.
            </p>
          </section>
          </ProfileAccordion>

          <ProfileAccordion
            title="Présentation professionnelle"
            description="Votre métier cible et le résumé de votre parcours."
            defaultOpen
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
            <TextArea label="Profil" value={summary} onChange={setSummary} rows={5} />
            <TextInput label="Profession" value={profession} onChange={setProfession} />
            </div>
          </ProfileAccordion>

          <ProfileAccordion
            title="Expériences professionnelles"
            description="Mettez en avant vos missions et résultats."
            defaultOpen
          >
            <ExperienceEditor items={experienceItems} onChange={setExperienceItems} />
          </ProfileAccordion>
          <ProfileAccordion title="Formation" description="Diplômes, parcours et établissements.">
            <EducationEditor items={educationItems} onChange={setEducationItems} />
          </ProfileAccordion>

          <ProfileAccordion
            title="Compétences et informations complémentaires"
            description="Compétences, langues, certifications, réalisations et centres d’intérêt."
          >
            <div className="grid gap-4">
              <ProfileAccordion title="Compétences" description="Ajoutez une compétence par ligne.">
                <TextArea label="Compétences" value={skills} onChange={setSkills} />
              </ProfileAccordion>
              <ProfileAccordion title="Langues" description="Ajoutez un niveau CECR pour chaque langue.">
                <LanguageEditor items={languageItems} onChange={setLanguageItems} />
              </ProfileAccordion>
              <ProfileAccordion title="Certifications" description="Ajoutez une certification par ligne.">
                <TextArea label="Certifications" value={certifications} onChange={setCertifications} />
              </ProfileAccordion>
              <ProfileAccordion title="Réalisations" description="Présentez vos projets et résultats notables.">
                <ProjectEditor items={projectItems} onChange={setProjectItems} />
              </ProfileAccordion>
              <ProfileAccordion title="Centres d’intérêt" description="Ajoutez les éléments personnels à partager.">
                <TextArea label="Centres d’intérêt" value={hobbies} onChange={setHobbies} />
              </ProfileAccordion>
            </div>
          </ProfileAccordion>
        </div>

        {error ? <p className="mt-4 text-sm font-medium text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 text-sm font-medium text-blue-700">{message}</p> : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-500">Vos données restent modifiables à tout moment.</p>
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={isSaving}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 hover:shadow-md disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSaving ? 'Enregistrement...' : 'Enregistrer et confirmer'}
          </button>
        </div>
        </div>
      </section>
    </section>
  );
}

function ExperienceEditor({
  items,
  onChange,
}: {
  items: EditableExperience[];
  onChange: (items: EditableExperience[]) => void;
}) {
  return (
    <section className="grid gap-3">
      <SectionHeader
        title="Expériences professionnelles"
        actionLabel="Ajouter une expérience"
        onAdd={() => onChange([...items, createExperienceItem()])}
      />
      {items.map((item, index) => (
        <div
          key={item.id}
          className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[220px_minmax(0,1fr)]"
        >
          <PictureDescription
            title={`Expérience ${index + 1}`}
            description={buildExperiencePictureDescription(item)}
          />
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-950">Expérience {index + 1}</h3>
              <button
                type="button"
                onClick={() => onChange(removeItem(items, item.id))}
                className="text-sm font-medium text-red-700 hover:text-red-800 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={items.length === 1 && isEmptyExperience(item)}
              >
                Retirer
              </button>
            </div>
            <TextInput
              label="Poste ou mission"
              value={item.titleRaw}
              onChange={(value) => onChange(updateItem(items, item.id, { titleRaw: value }))}
            />
            <TextInput
              label="Entreprise ou client"
              value={item.companyName}
              onChange={(value) => onChange(updateItem(items, item.id, { companyName: value }))}
            />
            <TextInput
              label="Lieu"
              value={item.location}
              onChange={(value) => onChange(updateItem(items, item.id, { location: value }))}
            />
            <TextArea
              label="Description"
              value={item.summary}
              rows={3}
              onChange={(value) => onChange(updateItem(items, item.id, { summary: value }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <ExperienceDateInput
                label="Début"
                value={item.startDate}
                onChange={(value) => onChange(updateItem(items, item.id, { startDate: value }))}
              />
              <ExperienceDateInput
                label="Fin"
                value={item.endDate}
                onChange={(value) => onChange(updateItem(items, item.id, { endDate: value }))}
              />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function EducationEditor({
  items,
  onChange,
}: {
  items: EditableEducation[];
  onChange: (items: EditableEducation[]) => void;
}) {
  return (
    <section className="grid gap-3">
      <SectionHeader
        title="Formation"
        actionLabel="Ajouter une formation"
        onAdd={() => onChange([...items, createEducationItem()])}
      />
      {items.map((item, index) => (
        <div
          key={item.id}
          className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[220px_minmax(0,1fr)]"
        >
          <PictureDescription
            title={`Formation ${index + 1}`}
            description={buildEducationPictureDescription(item)}
          />
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-950">Formation {index + 1}</h3>
              <button
                type="button"
                onClick={() => onChange(removeItem(items, item.id))}
                className="text-sm font-medium text-red-700 hover:text-red-800 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={items.length === 1 && isEmptyEducation(item)}
              >
                Retirer
              </button>
            </div>
            <TextInput
              label="Diplôme ou formation"
              value={item.degreeLabel}
              onChange={(value) => onChange(updateItem(items, item.id, { degreeLabel: value }))}
            />
            <TextInput
              label="École ou établissement"
              value={item.schoolName}
              onChange={(value) => onChange(updateItem(items, item.id, { schoolName: value }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="Domaine"
                value={item.field}
                onChange={(value) => onChange(updateItem(items, item.id, { field: value }))}
              />
              <TextInput
                label="Date d’obtention"
                value={item.graduationDate}
                onChange={(value) =>
                  onChange(updateItem(items, item.id, { graduationDate: value }))
                }
              />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function ProjectEditor({
  items,
  onChange,
}: {
  items: EditableProject[];
  onChange: (items: EditableProject[]) => void;
}) {
  return (
    <section className="grid gap-3">
      <SectionHeader
        title="Projets et réalisations"
        actionLabel="Ajouter un projet"
        onAdd={() => onChange([...items, createProjectItem()])}
      />
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-600">
          Ajoutez les projets ou réalisations que vous souhaitez mettre en avant.
        </p>
      ) : null}
      {items.map((item, index) => (
        <div
          key={item.id}
          className="grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[220px_minmax(0,1fr)]"
        >
          <PictureDescription
            title={`Projet ${index + 1}`}
            description={buildProjectPictureDescription(item)}
          />
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-950">Projet {index + 1}</h3>
              <button
                type="button"
                onClick={() => onChange(items.filter((project) => project.id !== item.id))}
                className="text-sm font-medium text-red-700 hover:text-red-800"
              >
                Retirer
              </button>
            </div>
            <TextInput
              label="Nom du projet"
              value={item.title}
              onChange={(value) => onChange(updateItem(items, item.id, { title: value }))}
            />
            <TextArea
              label="Description"
              value={item.summary}
              rows={4}
              onChange={(value) => onChange(updateItem(items, item.id, { summary: value }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <ExperienceDateInput
                label="Début (facultatif)"
                value={item.startDate}
                onChange={(value) => onChange(updateItem(items, item.id, { startDate: value }))}
              />
              <ExperienceDateInput
                label="Fin (facultatif)"
                value={item.endDate}
                onChange={(value) => onChange(updateItem(items, item.id, { endDate: value }))}
              />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function ProfileAccordion({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold text-slate-950">{title}</span>
          <span className="mt-1 block text-sm text-slate-600">{description}</span>
        </span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-50 text-lg font-medium text-indigo-700 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="border-t border-slate-100 p-4">{children}</div>
    </details>
  );
}

const LANGUAGE_LEVEL_OPTIONS: Array<[EditableLanguage['cecrl'], string]> = [
  ['A1', 'Débutant — A1'],
  ['A2', 'Élémentaire — A2'],
  ['B1', 'Intermédiaire — B1'],
  ['B2', 'Intermédiaire avancé — B2'],
  ['C1', 'Avancé — C1'],
  ['C2', 'Expert — C2'],
  ['langue maternelle', 'Langue maternelle'],
];

function LanguageEditor({
  items,
  onChange,
}: {
  items: EditableLanguage[];
  onChange: (items: EditableLanguage[]) => void;
}) {
  return (
    <section className="grid content-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 border-b border-slate-200 pb-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-950">Langues</h3>
          <p className="mt-1 text-sm text-slate-600">Ajoutez chaque langue et sélectionnez son niveau CECR.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...items, createLanguageItem()])}
          className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-800 transition hover:bg-blue-50 sm:w-auto sm:shrink-0"
        >
          Ajouter une langue
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-600">
          Aucune langue ajoutée pour le moment.
        </p>
      ) : null}

      {items.map((item, index) => (
        <div key={item.id} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)_auto] lg:items-end">
          <TextInput
            label={`Langue ${index + 1}`}
            value={item.code}
            onChange={(value) => onChange(updateItem(items, item.id, { code: value }))}
          />
          <label className="grid gap-2 text-sm font-medium text-slate-800">
            Niveau
            <select
              value={item.cecrl}
              onChange={(event) =>
                onChange(
                  updateItem(items, item.id, {
                    cecrl: event.target.value as EditableLanguage['cecrl'],
                  }),
                )
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
            >
              <option value="">Sélectionnez un niveau</option>
              {LANGUAGE_LEVEL_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => onChange(items.filter((language) => language.id !== item.id))}
            className="w-full rounded-md px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 hover:text-red-800 lg:w-auto"
            aria-label={`Retirer la langue ${index + 1}`}
          >
            Retirer
          </button>
        </div>
      ))}
    </section>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAdd,
}: {
  title: string;
  actionLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <button
        type="button"
        onClick={onAdd}
        className="rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function PictureDescription({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid content-start gap-2 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-blue-50 text-sm font-bold text-blue-800">
        {title
          .split(' ')
          .map((part) => part[0])
          .join('')
          .slice(0, 2)}
      </div>
      <p className="text-xs font-semibold uppercase text-slate-500">Description d’image</p>
      <p className="text-sm leading-5 text-slate-700">{description}</p>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
      />
    </label>
  );
}

type DatePrecision = 'month' | 'year';

function ExperienceDateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [precision, setPrecision] = useState<DatePrecision>(() =>
    isYearOnly(value) ? 'year' : 'month',
  );
  const calendarValue = toCalendarMonthValue(value);
  const recognizedValue = Boolean(value.trim()) && (isYearOnly(value) || Boolean(calendarValue));

  function changePrecision(nextPrecision: DatePrecision) {
    setPrecision(nextPrecision);

    if (!value.trim()) return;

    onChange(nextPrecision === 'year' ? getDateYear(value) : calendarValue ? fromCalendarMonthValue(calendarValue) : '');
  }

  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      {label}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
        <select
          value={precision}
          onChange={(event) => changePrecision(event.target.value as DatePrecision)}
          aria-label={`Précision de ${label}`}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
        >
          <option value="month">Mois et année</option>
          <option value="year">Année seulement</option>
        </select>
        {precision === 'month' ? (
          <input
            type="month"
            value={calendarValue}
            onChange={(event) => onChange(fromCalendarMonthValue(event.target.value))}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
          />
        ) : (
          <input
            type="number"
            min="1900"
            max="2100"
            inputMode="numeric"
            placeholder="AAAA"
            value={getDateYear(value)}
            onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
          />
        )}
      </div>
      {!recognizedValue ? (
        <span className="text-xs font-normal text-amber-700">
          Date existante : {value}. Sélectionnez une date pour la normaliser.
        </span>
      ) : null}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      {label}
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm font-normal leading-6"
      />
    </label>
  );
}

function isYearOnly(value: string): boolean {
  return /^(?:19|20)\d{2}$/.test(value.trim());
}

function getDateYear(value: string): string {
  const match = value.match(/(?:19|20)\d{2}/);
  return match?.[0] ?? '';
}

function toCalendarMonthValue(value: string): string {
  const trimmed = value.trim();
  const monthYearMatch = /^(0[1-9]|1[0-2])\/(19|20)(\d{2})$/.exec(trimmed);

  if (monthYearMatch) {
    return `${monthYearMatch[2]}${monthYearMatch[3]}-${monthYearMatch[1]}`;
  }

  const yearMonthMatch = /^(19|20)(\d{2})-(0[1-9]|1[0-2])$/.exec(trimmed);
  return yearMonthMatch ? trimmed : '';
}

function fromCalendarMonthValue(value: string): string {
  const match = /^(19|20)(\d{2})-(0[1-9]|1[0-2])$/.exec(value);

  return match ? `${match[3]}/${match[1]}${match[2]}` : '';
}

function toLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function toSkillText(skills: SkillItem[]): string {
  return skills.map((skill) => skill.raw).join('\n');
}

function toEditableLanguages(languages: LanguageItem[]): EditableLanguage[] {
  return sortLanguageItems(languages).map((language) => ({
    id: createItemId(),
    code: canonicalLanguageName(language.code),
    cecrl: language.cecrl ?? '',
  }));
}

function canonicalLanguageName(value: string): string {
  const normalized = normalizeProfileFormText(value);

  if (normalized.includes('anglais') || normalized.includes('english') || normalized === 'en') return 'Anglais';
  if (normalized.includes('espagnol') || normalized.includes('spanish') || normalized === 'es') return 'Espagnol';
  if (normalized.includes('allemand') || normalized.includes('german') || normalized === 'de') return 'Allemand';
  if (normalized.includes('italien') || normalized.includes('italian') || normalized === 'it') return 'Italien';
  if (normalized.includes('francais') || normalized.includes('french') || normalized === 'fr') return 'Français';
  if (normalized.includes('portugais') || normalized.includes('portuguese') || normalized === 'pt') return 'Portugais';

  return value.split(/\s+/)[0]?.trim() || 'unknown';
}

function normalizeProfileFormText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function toEditableExperiences(
  experiences: CandidateProfile['professionalExperiences'],
): EditableExperience[] {
  const hasStructuredItems = experiences.some(
    (item) =>
      item.location ||
      item.startDate ||
      item.endDate ||
      (item.summary && item.summary !== item.titleRaw),
  );
  const sourceItems = hasStructuredItems
    ? experiences
    : extractProfessionalExperiences(experiences.map((item) => item.titleRaw ?? item.summary ?? '').join('\n'));
  const items = sourceItems.map((item) => ({
    id: createItemId(),
    titleRaw: item.titleRaw ?? '',
    companyName: item.companyName ?? '',
    location: item.location ?? '',
    summary: item.summary ?? '',
    startDate: item.startDate ?? '',
    endDate: item.endDate ?? '',
  }));

  return items.length > 0 ? items : [createExperienceItem()];
}

function toEditableEducation(education: EducationItem[]): EditableEducation[] {
  const hasStructuredItems = education.some(
    (item) => item.schoolName || item.field || item.graduationDate,
  );

  if (hasStructuredItems) {
    const items = education.map((item) => ({
      id: createItemId(),
      degreeLabel: item.degreeLabel ?? '',
      schoolName: item.schoolName ?? '',
      field: item.field ?? '',
      graduationDate: item.graduationDate ?? '',
    }));

    return items.length > 0 ? items : [createEducationItem()];
  }

  const items = extractEducationItems(education.map((item) => item.degreeLabel ?? '').join('\n')).map(
    (item) => ({
      id: createItemId(),
      degreeLabel: item.degreeLabel ?? '',
      schoolName: item.schoolName ?? '',
      field: item.field ?? '',
      graduationDate: item.graduationDate ?? '',
    }),
  );

  return items.length > 0 ? items : [createEducationItem()];
}

function toEditableProjects(achievements: string[]): EditableProject[] {
  return achievements
    .map((achievement) => {
      const [title, ...details] = achievement.split(' — ');
      const dateDetailsIndex = details.findIndex((detail) => detail.startsWith('Période :'));
      const dateDetails = dateDetailsIndex >= 0 ? details[dateDetailsIndex] : '';
      const summaryParts = dateDetailsIndex >= 0 ? details.slice(0, dateDetailsIndex) : details;
      const { startDate, endDate } = parseProjectDates(dateDetails);

      return {
        id: createItemId(),
        title: title.trim(),
        summary: summaryParts.join(' — ').trim(),
        startDate,
        endDate,
      };
    })
    .filter((item) => item.title || item.summary);
}

function toExperienceItem(
  item: EditableExperience,
): CandidateProfile['professionalExperiences'][number] | null {
  const titleRaw = item.titleRaw.trim();
  const companyName = item.companyName.trim();
  const location = item.location.trim();
  const summary = item.summary.trim();
  const startDate = item.startDate.trim();
  const endDate = item.endDate.trim();

  if (!titleRaw && !companyName && !location && !summary && !startDate && !endDate) return null;

  return {
    titleRaw: titleRaw || summary,
    companyName: companyName || undefined,
    location: location || undefined,
    summary: summary || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };
}

function toEducationItem(item: EditableEducation): EducationItem | null {
  const degreeLabel = item.degreeLabel.trim();
  const schoolName = item.schoolName.trim();
  const field = item.field.trim();
  const graduationDate = item.graduationDate.trim();

  if (!degreeLabel && !schoolName && !field && !graduationDate) return null;

  return {
    degreeLabel: degreeLabel || undefined,
    schoolName: schoolName || undefined,
    field: field || undefined,
    graduationDate: graduationDate || undefined,
  };
}

function toProjectAchievement(item: EditableProject): string | null {
  const title = item.title.trim();
  const summary = item.summary.replace(/\s+/g, ' ').trim();
  const period = formatProjectDates(item.startDate, item.endDate);

  if (!title && !summary) return null;

  return [title, summary, period].filter(Boolean).join(' — ');
}

function formatProjectDates(startDateValue: string, endDateValue: string): string {
  const startDate = startDateValue.trim();
  const endDate = endDateValue.trim();
  const values = [
    startDate ? `début : ${startDate}` : '',
    endDate ? `fin : ${endDate}` : '',
  ].filter(Boolean);

  return values.length > 0 ? `Période : ${values.join('; ')}` : '';
}

function parseProjectDates(value: string): Pick<EditableProject, 'startDate' | 'endDate'> {
  const startDate = /début\s*:\s*([^;]+)/i.exec(value)?.[1]?.trim() ?? '';
  const endDate = /fin\s*:\s*([^;]+)/i.exec(value)?.[1]?.trim() ?? '';

  return { startDate, endDate };
}

function createExperienceItem(): EditableExperience {
  return {
    id: createItemId(),
    titleRaw: '',
    companyName: '',
    location: '',
    summary: '',
    startDate: '',
    endDate: '',
  };
}

function createEducationItem(): EditableEducation {
  return {
    id: createItemId(),
    degreeLabel: '',
    schoolName: '',
    field: '',
    graduationDate: '',
  };
}

function createProjectItem(): EditableProject {
  return {
    id: createItemId(),
    title: '',
    summary: '',
    startDate: '',
    endDate: '',
  };
}

function createLanguageItem(): EditableLanguage {
  return {
    id: createItemId(),
    code: '',
    cecrl: '',
  };
}

function createItemId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function updateItem<T extends { id: string }>(items: T[], id: string, patch: Partial<T>): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function removeItem<T extends { id: string }>(items: T[], id: string): T[] {
  const nextItems = items.filter((item) => item.id !== id);

  return nextItems.length > 0 ? nextItems : items;
}

function isEmptyExperience(item: EditableExperience): boolean {
  return (
    !item.titleRaw.trim() &&
    !item.companyName.trim() &&
    !item.location.trim() &&
    !item.summary.trim() &&
    !item.startDate.trim() &&
    !item.endDate.trim()
  );
}

function isEmptyEducation(item: EditableEducation): boolean {
  return (
    !item.degreeLabel.trim() &&
    !item.schoolName.trim() &&
    !item.field.trim() &&
    !item.graduationDate.trim()
  );
}

function getProfileCompletion(values: {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  summary: string;
  profession: string;
  skills: string;
  languageItems: EditableLanguage[];
  educationItems: EditableEducation[];
  experienceItems: EditableExperience[];
}): number {
  const checks = [
    values.fullName.trim(),
    values.email.trim(),
    values.phone.trim(),
    values.city.trim(),
    values.summary.trim(),
    values.profession.trim(),
    values.skills.trim(),
    values.languageItems.some((item) => item.code.trim() && item.cecrl),
    values.educationItems.some((item) => !isEmptyEducation(item)),
    values.experienceItems.some((item) => !isEmptyExperience(item)),
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function profileOptionLabel(profile: CandidateProfile): string {
  const identity = profile.identityContact.fullName?.trim();
  const profession = profile.profession.trim();
  const label = [identity, profession].filter(Boolean).join(' · ') || 'Profil sans nom';
  const updatedAt = formatProfileDate(profile.updatedAt);

  return updatedAt ? `${label} · ${updatedAt}` : label;
}

function formatProfileDate(value: string): string {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function buildExperiencePictureDescription(item: EditableExperience): string {
  const label =
    [item.titleRaw.trim(), item.companyName.trim()].filter(Boolean).join(' chez ') ||
    item.location.trim() ||
    item.summary.trim();

  if (!label) {
    return 'Visuel suggéré : environnement de travail, équipe ou livrable représentatif de cette expérience.';
  }

  return `Visuel suggéré : contexte professionnel lié à ${label.slice(0, 90)}.`;
}

function buildEducationPictureDescription(item: EditableEducation): string {
  const label = item.schoolName.trim() || item.degreeLabel.trim() || item.field.trim();

  if (!label) {
    return 'Visuel suggéré : diplôme, établissement ou support de formation associé à cette entrée.';
  }

  return `Visuel suggéré : diplôme, école ou support de formation lié à ${label.slice(0, 90)}.`;
}

function buildProjectPictureDescription(item: EditableProject): string {
  const label = item.title.trim() || item.summary.trim();

  if (!label) {
    return 'Visuel suggéré : prototype, interface, livrable ou résultat représentatif du projet.';
  }

  return `Visuel suggéré : livrable ou résultat représentatif de ${label.slice(0, 90)}.`;
}
