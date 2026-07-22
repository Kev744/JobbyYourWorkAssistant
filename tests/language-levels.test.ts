import { normalizeLanguageLevel, sortLanguageItems, toComparableCecrl } from '@/lib/language-levels';

describe('language level normalization', () => {
  it('keeps explicit CEFR levels before textual levels', () => {
    expect(normalizeLanguageLevel('Anglais B2 courant')).toBe('B2');
  });

  it('normalizes native language wording', () => {
    expect(normalizeLanguageLevel('Francais langue maternelle')).toBe('langue maternelle');
    expect(normalizeLanguageLevel('Anglais natif')).toBe('langue maternelle');
    expect(normalizeLanguageLevel('Espagnol langue de naissance')).toBe('langue maternelle');
  });

  it('maps French textual levels to CEFR levels', () => {
    expect(normalizeLanguageLevel('Anglais courant')).toBe('C1');
    expect(normalizeLanguageLevel('Anglais avance')).toBe('B2');
    expect(normalizeLanguageLevel('Anglais intermediaire')).toBe('B1');
    expect(normalizeLanguageLevel('Anglais d\u00e9butant')).toBe('A1');
  });

  it('treats native level as C2 for comparisons', () => {
    expect(toComparableCecrl('langue maternelle')).toBe('C2');
  });

  it('sorts languages by proficiency from native to beginner', () => {
    expect(
      sortLanguageItems([
        { code: 'it', cecrl: 'A1' },
        { code: 'en', cecrl: 'B2' },
        { code: 'fr', cecrl: 'langue maternelle' },
        { code: 'de', cecrl: 'C1' },
        { code: 'es', cecrl: 'A2' },
        { code: 'pt', cecrl: 'C2' },
        { code: 'nl', cecrl: 'B1' },
      ]).map((language) => language.cecrl),
    ).toEqual(['langue maternelle', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1']);
  });
});
