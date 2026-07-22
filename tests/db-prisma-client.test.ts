import { execFile } from 'node:child_process';

jest.mock('node:child_process', () => ({
  execFile: jest.fn(
    (
      _file: string,
      _args: string[],
      _options: Record<string, unknown>,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => callback(new Error('database shell should not be used'), '', ''),
  ),
}));

describe('local Prisma database client', () => {
  const tableFixtures: Record<
    string,
    { delegate: string; payload: Record<string, unknown>; row: Record<string, unknown> }
  > = {
    user_credentials: {
      delegate: 'userCredential',
      payload: {
        user_id: '00000000-0000-4000-8000-000000000001',
        email: 'user@example.test',
        password_hash: '$2b$12$hash',
      },
      row: {
        user_id: '00000000-0000-4000-8000-000000000001',
        email: 'user@example.test',
        password_hash: '$2b$12$hash',
      },
    },
    resume_files: {
      delegate: 'resumeFile',
      payload: {
        user_id: '00000000-0000-4000-8000-000000000001',
        original_file_name: 'cv.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 42,
        checksum_sha256: 'abc123',
        storage_bucket: 'cv-originals',
        storage_path: '00000000-0000-4000-8000-000000000001/file.pdf',
      },
      row: { id: 'file-1', storage_path: '00000000-0000-4000-8000-000000000001/file.pdf' },
    },
    resume_versions: {
      delegate: 'resumeVersion',
      payload: {
        user_id: '00000000-0000-4000-8000-000000000001',
        version_number: 1,
        title: 'CV principal',
        corpus_content: 'Experience TypeScript',
      },
      row: { id: 'version-1', title: 'CV principal' },
    },
    candidate_profiles: {
      delegate: 'candidateProfile',
      payload: {
        user_id: '00000000-0000-4000-8000-000000000001',
        resume_version_id: '00000000-0000-4000-8000-000000000002',
        summary: 'Developpeur full-stack',
        profession: 'Developpeur',
        education: [],
        professional_experiences: [],
        hobbies: [],
        certifications: [],
        skills: ['TypeScript'],
        languages: [],
        achievements: [],
        identity_contact: { email: 'user@example.test' },
        scoring_payload: {},
        rome_code: 'M1805',
        generation_warnings: [],
      },
      row: { id: 'profile-1', profession: 'Developpeur' },
    },
    profile_requirements: {
      delegate: 'profileRequirement',
      payload: {
        user_id: '00000000-0000-4000-8000-000000000001',
        profession_keywords: 'Developpeur',
        city: { label: 'Paris' },
        department: { code: '75' },
        region: { code: '11' },
        radius_km: 10,
        experience_level: 'senior',
        availability: 'immediate',
        contract_types: ['CDI'],
        disabled_accepted: false,
        remote_preference: 'hybrid',
        company_name: '',
        provider_notes: ['note'],
      },
      row: { id: 'requirements-1', user_id: '00000000-0000-4000-8000-000000000001' },
    },
    job_offer_sources: {
      delegate: 'jobOfferSource',
      payload: { source: 'france_travail', label: 'France Travail' },
      row: { source: 'france_travail', label: 'France Travail' },
    },
    job_offers: {
      delegate: 'jobOffer',
      payload: {
        source: 'france_travail',
        source_offer_id: 'source-1',
        offer_id: 'offer-1',
        title: 'Developpeur',
        description: 'Construire des produits',
        company_name: 'Acme',
        location: { city: 'Paris' },
        normalized_offer: { id: 'offer-1' },
      },
      row: { id: 'offer-row-1', source_offer_id: 'source-1' },
    },
    job_search_queries: {
      delegate: 'jobSearchQuery',
      payload: {
        user_id: '00000000-0000-4000-8000-000000000001',
        source: 'france_travail',
        query_hash: 'hash',
        query_payload: { q: 'typescript' },
        warnings: ['cached'],
        result_count: 1,
        cache_status: 'miss',
        expires_at: '2026-07-09T00:00:00.000Z',
      },
      row: { id: 'query-1', query_hash: 'hash' },
    },
    job_offer_search_results: {
      delegate: 'jobOfferSearchResult',
      payload: {
        user_id: '00000000-0000-4000-8000-000000000001',
        query_id: '00000000-0000-4000-8000-000000000003',
        job_offer_id: '00000000-0000-4000-8000-000000000004',
        rank: 1,
      },
      row: { id: 'result-1', rank: 1 },
    },
    scored_offers: {
      delegate: 'scoredOffer',
      payload: {
        user_id: '00000000-0000-4000-8000-000000000001',
        candidate_profile_id: '00000000-0000-4000-8000-000000000005',
        job_offer_id: '00000000-0000-4000-8000-000000000004',
        source: 'france_travail',
        final_score: 84,
        score_breakdown: { skills: 90 },
        matched_features: { skills: ['TypeScript'] },
        missing_must_haves: ['Docker'],
        explanation: 'Bon alignement',
      },
      row: { id: 'score-1', final_score: 84 },
    },
    generated_resumes: {
      delegate: 'generatedResume',
      payload: {
        user_id: '00000000-0000-4000-8000-000000000001',
        candidate_profile_id: '00000000-0000-4000-8000-000000000005',
        resume_version_id: '00000000-0000-4000-8000-000000000002',
        job_offer_id: '00000000-0000-4000-8000-000000000004',
        title: 'CV adapte',
        content: 'Contenu',
        evidence_map: [],
        user_instructions: '',
      },
      row: { id: 'generated-1', title: 'CV adapte' },
    },
    applications: {
      delegate: 'application',
      payload: {
        user_id: '00000000-0000-4000-8000-000000000001',
        generated_resume_id: '00000000-0000-4000-8000-000000000006',
        job_offer_id: '00000000-0000-4000-8000-000000000004',
        offer_snapshot: { title: 'Developpeur' },
        current_status: 'pending',
      },
      row: { id: 'application-1', current_status: 'pending' },
    },
    application_status_events: {
      delegate: 'applicationStatusEvent',
      payload: {
        user_id: '00000000-0000-4000-8000-000000000001',
        application_id: '00000000-0000-4000-8000-000000000007',
        from_status: null,
        to_status: 'pending',
        note: '',
      },
      row: { id: 'event-1', to_status: 'pending' },
    },
    resume_section_extractions: {
      delegate: 'resumeSectionExtraction',
      payload: {
        user_id: '00000000-0000-4000-8000-000000000001',
        resume_file_id: '00000000-0000-4000-8000-000000000008',
        source_content_sha256: 'abc123',
        model: 'test-model',
        sections: { experience: 'TypeScript' },
        markdown_content: '## Experience',
        warnings: ['low confidence'],
      },
      row: { id: 'section-1', warnings: ['low confidence'] },
    },
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/matchingcv_ai';
  });

  it('inserts and returns user credentials through Prisma without shelling out', async () => {
    const create = jest.fn().mockResolvedValue({
      user_id: '00000000-0000-4000-8000-000000000001',
      email: 'user@example.test',
      password_hash: '$2b$12$hash',
    });
    mockPrisma({ userCredential: { create } });

    const { createLocalDatabaseClient } = await import('@/lib/db/local-client');
    const result = await createLocalDatabaseClient()
      .from('user_credentials')
      .insert({
        user_id: '00000000-0000-4000-8000-000000000001',
        email: 'user@example.test',
        password_hash: '$2b$12$hash',
      })
      .select('user_id, email, password_hash')
      .single();

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      user_id: '00000000-0000-4000-8000-000000000001',
      email: 'user@example.test',
      password_hash: '$2b$12$hash',
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        user_id: '00000000-0000-4000-8000-000000000001',
        email: 'user@example.test',
        password_hash: '$2b$12$hash',
      },
      select: {
        user_id: true,
        email: true,
        password_hash: true,
      },
    });
    expect(execFile).not.toHaveBeenCalled();
  });

  it('selects filtered resume files through Prisma without shelling out', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'file-1',
        storage_path: 'user-1/file.pdf',
      },
    ]);
    mockPrisma({ resumeFile: { findMany } });

    const { createLocalDatabaseClient } = await import('@/lib/db/local-client');
    const result = await createLocalDatabaseClient()
      .from('resume_files')
      .select('id, storage_path')
      .eq('user_id', 'user-1')
      .order('created_at', { ascending: false });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: 'file-1', storage_path: 'user-1/file.pdf' }]);
    expect(findMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      orderBy: [{ created_at: 'desc' }],
      select: {
        id: true,
        storage_path: true,
      },
    });
    expect(execFile).not.toHaveBeenCalled();
  });

  it('upserts profile requirements using the requested conflict column', async () => {
    const upsert = jest.fn().mockResolvedValue({
      user_id: 'user-1',
      profession_keywords: 'Developpeur',
      contract_types: ['CDI'],
    });
    mockPrisma({ profileRequirement: { upsert } });

    const { createLocalDatabaseClient } = await import('@/lib/db/local-client');
    const result = await createLocalDatabaseClient()
      .from('profile_requirements')
      .upsert(
        {
          user_id: 'user-1',
          profession_keywords: 'Developpeur',
          contract_types: ['CDI'],
        },
        { onConflict: 'user_id' },
      )
      .select('user_id, profession_keywords, contract_types')
      .single();

    expect(result.error).toBeNull();
    expect(upsert).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      create: {
        user_id: 'user-1',
        profession_keywords: 'Developpeur',
        contract_types: ['CDI'],
      },
      update: {
        profession_keywords: 'Developpeur',
        contract_types: ['CDI'],
      },
      select: {
        user_id: true,
        profession_keywords: true,
        contract_types: true,
      },
    });
    expect(execFile).not.toHaveBeenCalled();
  });

  it.each(Object.entries(tableFixtures))(
    'uses the Prisma delegate for insert and select on %s',
    async (tableName, fixture) => {
      const create = jest.fn().mockResolvedValue(fixture.row);
      const findMany = jest.fn().mockResolvedValue([fixture.row]);
      mockPrisma({ [fixture.delegate]: { create, findMany } });

      const { createLocalDatabaseClient } = await import('@/lib/db/local-client');
      const db = createLocalDatabaseClient();
      const inserted = await db.from(tableName).insert(fixture.payload).select('*').single();
      const selected = await db.from(tableName).select('*');

      expect(inserted.error).toBeNull();
      expect(selected.error).toBeNull();
      expect(inserted.data).toEqual(fixture.row);
      expect(selected.data).toEqual([fixture.row]);
      expect(create).toHaveBeenCalledWith({ data: fixture.payload });
      expect(findMany).toHaveBeenCalledWith({});
      expect(execFile).not.toHaveBeenCalled();
    },
  );
});

function mockPrisma(delegateOverrides: Record<string, Record<string, jest.Mock>>) {
  jest.doMock('@/lib/db/prisma', () => ({
    prisma: delegateOverrides,
  }));
}
