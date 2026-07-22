import {
  buildProviderNotes,
  normalizeRequirementsPayload,
} from '@/lib/profile/profile-requirements';

describe('profile requirements', () => {
  it('normalizes saved search filters and clamps radius', () => {
    const payload = normalizeRequirementsPayload({
      professionKeywords: ' Développeur ',
      city: { code: '75056', name: 'Paris' },
      radiusKm: 140,
      experienceLevel: '4',
      contractTypes: ['CDI', '', 'CDD'],
      disabledAccepted: true,
      salaryMinAnnualGrossEur: '52000',
      fullTime: 'true',
      permanent: 'false',
    });

    expect(payload.profession_keywords).toBe('Développeur');
    expect(payload.radius_km).toBe(100);
    expect(payload.experience_level).toBe('4');
    expect(payload.contract_types).toEqual(['CDI', 'CDD']);
    expect(payload.salary_min_annual_gross_eur).toBe(52000);
    expect(payload.full_time).toBe(true);
    expect(payload.permanent).toBe(false);
  });

  it('normalizes numeric experience and keeps salary positive or null', () => {
    const negativePayload = normalizeRequirementsPayload({
      experienceLevel: '-2',
      salaryMinAnnualGrossEur: '-45000',
    });
    const decimalPayload = normalizeRequirementsPayload({
      experienceLevel: '3.8',
      salaryMinAnnualGrossEur: '42000.6',
    });
    const blankPayload = normalizeRequirementsPayload({
      experienceLevel: '',
      salaryMinAnnualGrossEur: '',
    });

    expect(negativePayload.experience_level).toBe('0');
    expect(negativePayload.salary_min_annual_gross_eur).toBeNull();
    expect(decimalPayload.experience_level).toBe('4');
    expect(decimalPayload.salary_min_annual_gross_eur).toBe(42001);
    expect(blankPayload.experience_level).toBe('');
    expect(blankPayload.salary_min_annual_gross_eur).toBeNull();
  });

  it('adds provider compatibility notes for source-specific filters', () => {
    const notes = buildProviderNotes({
      city: null,
      department: { code: '75', name: 'Paris' },
      region: null,
      radiusKm: 10,
      disabledAccepted: true,
      companyName: 'Acme',
      remotePreference: 'hybrid',
    });

    expect(notes).toContain('Le rayon est appliqué uniquement quand une commune est sélectionnée.');
    expect(notes).toContain('Le filtre handicap sera transmis à France Travail si disponible.');
    expect(notes).toContain(
      'Le nom d’entreprise sera transmis à Adzuna et filtré côté serveur pour les sources qui ne le gèrent pas.',
    );
  });
});
