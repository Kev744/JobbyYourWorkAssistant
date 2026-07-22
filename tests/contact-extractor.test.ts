import { extractConfidentialContactInfo } from '@/lib/profile/contact-extractor';

describe('extractConfidentialContactInfo', () => {
  it('ignores PDF extraction noise instead of rendering bogus contact data', () => {
    const contact = extractConfidentialContactInfo(`
ÃŠ\u000bA\u000be\u000bÃ¾\fL
garbage binary stream with 0123456789 hidden inside
Profile
Developpeur TypeScript
`);

    expect(contact.fullName).toBeUndefined();
    expect(contact.phone).toBeUndefined();
    expect(contact.city).toBeUndefined();
  });

  it('extracts explicit contact fields without using the name as the city', () => {
    const contact = extractConfidentialContactInfo(`
Kévin ESTEVES
kevin.esteves@example.test
06 12 34 56 78
75000 Paris
`);

    expect(contact.fullName).toBe('Kévin ESTEVES');
    expect(contact.email).toBe('kevin.esteves@example.test');
    expect(contact.phone).toBe('06 12 34 56 78');
    expect(contact.city).toBe('Paris');
    expect(contact.postalCode).toBe('75000');
  });

  it('keeps only the commune when a location line also contains a region and country', () => {
    const contact = extractConfidentialContactInfo(`
Kevin Esteves
Localisation : Bordeaux, Nouvelle-Aquitaine, France
`);

    expect(contact.city).toBe('Bordeaux');
    expect(contact.postalCode).toBeUndefined();
  });

  it('does not use a French region as a city when no commune is present', () => {
    const contact = extractConfidentialContactInfo(`
Kevin Esteves
Adresse : Nouvelle-Aquitaine, France
`);

    expect(contact.city).toBeUndefined();
  });

  it('finds a commune in an unpunctuated location line with region and country', () => {
    const contact = extractConfidentialContactInfo(`
Kevin Esteves
Bordeaux Nouvelle-Aquitaine France
`);

    expect(contact.city).toBe('Bordeaux');
  });

  it('does not treat a street name as a city without a location context', () => {
    const contact = extractConfidentialContactInfo(`
Kevin Esteves
Adresse : rue de Paris
`);

    expect(contact.city).toBeUndefined();
  });
});
