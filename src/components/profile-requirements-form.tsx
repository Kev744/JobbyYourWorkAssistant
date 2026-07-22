'use client';

import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useMemo, useState } from 'react';

import type { CandidateProfile, LocationOption, ProfileRequirements } from '@/types';

interface ProfileRequirementsFormProps {
  profile: CandidateProfile | null;
  initialRequirements: ProfileRequirements | null;
  cities: LocationOption[];
  departments: LocationOption[];
  regions: LocationOption[];
}

interface RequirementsResponse {
  requirements?: ProfileRequirements | null;
  error?: string;
}

const CONTRACT_TYPE_OPTIONS: Array<[string, string]> = [
  ['CDI', 'CDI'],
  ['CDD', 'CDD'],
  ['INTERIM', 'Intérim'],
  ['APPRENTISSAGE', 'Apprentissage'],
  ['STAGE', 'Stage'],
  ['POE', 'POE'],
];

export function ProfileRequirementsForm({
  profile,
  initialRequirements,
  cities,
  departments,
  regions,
}: ProfileRequirementsFormProps) {
  const router = useRouter();
  const [professionKeywords, setProfessionKeywords] = useState(
    initialRequirements?.professionKeywords || profile?.profession || '',
  );
  const [cityCode, setCityCode] = useState(initialRequirements?.city?.code ?? '');
  const [departmentCode, setDepartmentCode] = useState(initialRequirements?.department?.code ?? '');
  const [regionCode, setRegionCode] = useState(initialRequirements?.region?.code ?? '');
  const [radiusKm, setRadiusKm] = useState(initialRequirements?.radiusKm ?? 10);
  const [experienceLevel, setExperienceLevel] = useState(initialRequirements?.experienceLevel ?? '');
  const [availability, setAvailability] = useState(initialRequirements?.availability ?? '');
  const [contractTypes, setContractTypes] = useState(initialRequirements?.contractTypes ?? []);
  const [disabledAccepted, setDisabledAccepted] = useState(
    initialRequirements?.disabledAccepted ?? false,
  );
  const [salaryMinAnnualGrossEur, setSalaryMinAnnualGrossEur] = useState(
    initialRequirements?.salaryMinAnnualGrossEur?.toString() ?? '',
  );
  const [remotePreference, setRemotePreference] = useState(
    initialRequirements?.remotePreference ?? '',
  );
  const [fullTime, setFullTime] = useState(booleanToSelect(initialRequirements?.fullTime));
  const [permanent, setPermanent] = useState(booleanToSelect(initialRequirements?.permanent));
  const [companyName, setCompanyName] = useState(initialRequirements?.companyName ?? '');
  const [providerNotes, setProviderNotes] = useState(initialRequirements?.providerNotes ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const cityOptions = useMemo(() => cities.slice(0, 2500), [cities]);
  const selectedCity = cities.find((city) => city.code === cityCode) ?? null;
  const selectedDepartment =
    departments.find((department) => department.code === departmentCode) ?? null;
  const selectedRegion = regions.find((region) => region.code === regionCode) ?? null;

  async function saveRequirements(redirectToOffers: boolean) {
    setIsSaving(true);
    setError(null);
    setMessage('Enregistrement des critères...');

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: 'requirements',
          candidateProfileId: profile?.id ?? null,
          professionKeywords,
          city: selectedCity,
          department: selectedDepartment,
          region: selectedRegion,
          radiusKm,
          experienceLevel,
          availability,
          contractTypes,
          disabledAccepted,
          salaryMinAnnualGrossEur: salaryMinAnnualGrossEur || null,
          remotePreference,
          fullTime: selectToBoolean(fullTime),
          permanent: selectToBoolean(permanent),
          companyName,
        }),
      });
      const payload = (await response.json()) as RequirementsResponse;

      if (!response.ok || !payload.requirements) {
        throw new Error(payload.error ?? 'Impossible d’enregistrer les critères.');
      }

      setProviderNotes(payload.requirements.providerNotes);
      setMessage('Critères enregistrés.');

      if (redirectToOffers) {
        router.push('/my-offers' as Route);
        router.refresh();
      }
    } catch (saveError) {
      setMessage(null);
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer les critères.');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleContractType(value: string) {
    setContractTypes((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-950">Critères de recherche</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Ces critères seront réutilisés pour France Travail et Adzuna. Les filtres non compatibles
        avec une source seront ignorés ou appliqués après récupération quand c’est fiable.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FormSectionIntro
          title="Recherche"
          description="Base de recherche commune à France Travail et Adzuna."
        />
        <TextInput
          label="Métier ou mots-clés"
          value={professionKeywords}
          onChange={setProfessionKeywords}
        />
        <NumberTextInput
          label="Expérience"
          value={experienceLevel}
          onChange={setExperienceLevel}
          min={0}
        />
        <DateInput label="Disponibilité" value={availability} onChange={setAvailability} />
        <TextInput label="Nom de l’entreprise" value={companyName} onChange={setCompanyName} />

        <FormSectionIntro
          title="Localisation"
          description="Le rayon est appliqué avec une commune quand le fournisseur le permet."
        />
        <label className="grid gap-2 text-sm font-medium text-slate-800">
          Commune
          <input
            list="city-options"
            value={cityCode}
            onChange={(event) => setCityCode(event.target.value)}
            placeholder="Code INSEE ou sélection"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
          />
          <datalist id="city-options">
            {cityOptions.map((city) => (
              <option key={city.code} value={city.code}>
                {city.name} ({city.departmentCode})
              </option>
            ))}
          </datalist>
        </label>
        <SelectInput
          label="Département"
          value={departmentCode}
          onChange={setDepartmentCode}
          options={departments}
        />
        <SelectInput label="Région" value={regionCode} onChange={setRegionCode} options={regions} />
        <RadiusSlider label="Rayon (km)" value={radiusKm} onChange={setRadiusKm} min={0} max={100} />

        <FormSectionIntro
          title="Conditions"
          description="Préférences utilisées pour filtrer et classer les offres."
        />
        <NumberTextInput
          label="Salaire annuel brut minimum"
          value={salaryMinAnnualGrossEur}
          onChange={setSalaryMinAnnualGrossEur}
          min={1}
        />
        <SelectRawInput
          label="Télétravail"
          value={remotePreference}
          onChange={setRemotePreference}
          options={[
            ['', 'Indifférent'],
            ['onsite', 'Sur site'],
            ['hybrid', 'Hybride'],
            ['remote', 'Télétravail'],
          ]}
        />
        <SelectRawInput
          label="Temps de travail"
          value={fullTime}
          onChange={setFullTime}
          options={[
            ['', 'Indifférent'],
            ['true', 'Temps plein'],
            ['false', 'Temps partiel'],
          ]}
        />
        <SelectRawInput
          label="Type Adzuna"
          value={permanent}
          onChange={setPermanent}
          options={[
            ['', 'Indifférent'],
            ['true', 'Permanent'],
            ['false', 'Contrat'],
          ]}
        />
      </div>

      <fieldset className="mt-5 rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-800">Types de contrat</legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {CONTRACT_TYPE_OPTIONS.map(([type, label]) => (
            <label key={type} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={contractTypes.includes(type)}
                onChange={() => toggleContractType(type)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-800">
        <input
          type="checkbox"
          checked={disabledAccepted}
          onChange={(event) => setDisabledAccepted(event.target.checked)}
        />
        Handicap accepté
      </label>

      {providerNotes.length > 0 ? (
        <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-950">Compatibilité des sources</h3>
          <ul className="mt-2 grid gap-1 text-sm text-blue-900">
            {providerNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm font-medium text-red-700">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-medium text-blue-700">{message}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void saveRequirements(false)}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Enregistrer les critères
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void saveRequirements(true)}
          className="rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          Rechercher des offres
        </button>
      </div>
    </section>
  );
}

function FormSectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 md:col-span-2">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
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
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
      />
    </label>
  );
}

function NumberTextInput({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
      />
    </label>
  );
}

function DateInput({
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
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
      />
    </label>
  );
}

function RadiusSlider({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="grid gap-3 text-sm font-medium text-slate-800">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {value} km
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-blue-700"
      />
      <span className="flex justify-between text-xs font-normal text-slate-500">
        <span>{min} km</span>
        <span>{max} km</span>
      </span>
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: LocationOption[];
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
      >
        <option value="">Indifférent</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectRawInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-800">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue || 'empty'} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function booleanToSelect(value: boolean | null | undefined): string {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
}

function selectToBoolean(value: string): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}
