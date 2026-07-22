import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('profile requirements form', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/profile-requirements-form.tsx'),
    'utf8',
  );

  it('uses a slider for radius and a date picker for availability', () => {
    expect(source).toContain('type="range"');
    expect(source).toContain('label="Rayon (km)"');
    expect(source).toContain('type="date"');
    expect(source).toContain('label="Disponibilit');
  });

  it('renders experience and minimum salary as constrained numeric fields', () => {
    expect(source).toContain('label="Exp');
    expect(source).toContain('value={experienceLevel}');
    expect(source).toContain('min={0}');
    expect(source).toContain('label="Salaire annuel brut minimum"');
    expect(source).toContain('min={1}');
  });

  it('renders France Travail-compatible contract choices', () => {
    expect(source).toContain("['INTERIM', 'Int");
    expect(source).toContain("['APPRENTISSAGE', 'Apprentissage']");
    expect(source).toContain("['STAGE', 'Stage']");
    expect(source).toContain("['POE', 'POE']");
  });
});
