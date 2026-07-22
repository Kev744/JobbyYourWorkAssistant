import {
  createPastedWebOffer,
  PastedOfferValidationError,
  WEB_OFFER_SOURCE,
} from '@/lib/offers/pasted-offer';

describe('pasted web offers', () => {
  it('normalizes a pasted job offer for the existing generation pipeline', () => {
    const offer = createPastedWebOffer({
      text: `Indeed
Développeur Full Stack TypeScript
Entreprise : Acme
75010 Paris
CDI hybride

Vous travaillerez avec React, Next.js, Node.js, PostgreSQL, Docker et AWS.`,
      applicationUrl: 'https://fr.indeed.com/viewjob?jk=123',
      now: new Date('2026-07-22T10:00:00.000Z'),
    });

    expect(offer.source).toBe(WEB_OFFER_SOURCE);
    expect(offer.offerId).toMatch(/^web:/);
    expect(offer.title).toBe('Développeur Full Stack TypeScript');
    expect(offer.company?.name).toBe('Acme');
    expect(offer.location).toEqual({ postalCode: '75010', city: 'Paris' });
    expect(offer.contract?.type).toBe('CDI');
    expect(offer.remoteMode).toBe('hybrid');
    expect(offer.skills.map((skill) => skill.raw)).toEqual(
      expect.arrayContaining(['TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Docker', 'AWS']),
    );
    expect(offer.applicationUrl).toBe('https://fr.indeed.com/viewjob?jk=123');
  });

  it('rejects text that cannot describe a meaningful offer', () => {
    expect(() => createPastedWebOffer({ text: 'Développeur' })).toThrow(PastedOfferValidationError);
  });
});
