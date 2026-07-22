import {
  ApplicationValidationError,
  isApplicationStatus,
  mapApplicationRow,
  mapApplicationStatusEventRow,
  normalizeApplicationStatus,
  normalizeApplicationUrl,
} from '@/lib/applications/applications';
import type { JobOffer } from '@/types';

const offer: JobOffer = {
  offerId: 'france_travail:123',
  source: 'france_travail',
  sourceOfferId: '123',
  title: 'Développeur TypeScript',
  description: 'Poste TypeScript à Paris.',
  location: { city: 'Paris' },
  jobTarget: { rawTitle: 'Développeur TypeScript', canonicalRomeCode: 'M1805' },
  skills: [{ raw: 'TypeScript', importance: 'must' }],
  applicationUrl: 'https://entreprise.test/jobs/123',
};

describe('application helpers', () => {
  it('accepts only supported application statuses', () => {
    expect(isApplicationStatus('accepted')).toBe(true);
    expect(isApplicationStatus('pending')).toBe(true);
    expect(isApplicationStatus('refused')).toBe(true);
    expect(isApplicationStatus('archived')).toBe(false);
  });

  it('normalizes statuses with a fallback and French validation errors', () => {
    expect(normalizeApplicationStatus(undefined, 'pending')).toBe('pending');
    expect(normalizeApplicationStatus('accepted', 'pending')).toBe('accepted');

    expect(() => normalizeApplicationStatus('archived', 'pending')).toThrow(
      new ApplicationValidationError('Statut de candidature invalide.'),
    );
  });

  it('normalizes only HTTP application URLs', () => {
    expect(normalizeApplicationUrl(' https://entreprise.test/jobs/123 ')).toBe(
      'https://entreprise.test/jobs/123',
    );
    expect(normalizeApplicationUrl('http://entreprise.test/jobs/123')).toBe(
      'http://entreprise.test/jobs/123',
    );

    expect(() => normalizeApplicationUrl('javascript:alert(1)')).toThrow(
      new ApplicationValidationError('URL de candidature invalide.'),
    );
    expect(() => normalizeApplicationUrl('mailto:recrutement@example.test')).toThrow(
      new ApplicationValidationError('URL de candidature invalide.'),
    );
  });

  it('maps application rows with offer snapshots and status history', () => {
    const event = mapApplicationStatusEventRow({
      id: 'event-1',
      application_id: 'application-1',
      from_status: 'pending',
      to_status: 'accepted',
      note: 'Réponse positive reçue.',
      created_at: '2026-05-05T10:00:00.000Z',
    });
    const application = mapApplicationRow(
      {
        id: 'application-1',
        generated_resume_id: 'generated-1',
        job_offer_id: 'offer-1',
        offer_snapshot: offer,
        generated_resume_pdf_path: 'user/generated-1/cv.pdf',
        generated_resume_docx_path: 'user/generated-1/cv.docx',
        application_url: 'https://entreprise.test/jobs/123',
        current_status: 'accepted',
        created_at: '2026-05-05T09:00:00.000Z',
        updated_at: '2026-05-05T10:00:00.000Z',
      },
      [event],
    );

    expect(application.offerSnapshot.title).toBe('Développeur TypeScript');
    expect(application.currentStatus).toBe('accepted');
    expect(application.statusHistory).toHaveLength(1);
    expect(application.statusHistory[0]?.note).toBe('Réponse positive reçue.');
  });
});
