import { expect, test } from '@playwright/test';

test('local fixture pauses before final submit in supervised mode', async ({ page }) => {
  await page.setContent(`
    <main>
      <h1>Développeur TypeScript</h1>
      <label>Adresse e-mail <input name="email" /></label>
      <label>Nom complet <input name="fullName" /></label>
      <button type="button">Envoyer ma candidature</button>
    </main>
  `);

  await page.getByLabel('Adresse e-mail').fill('candidat@example.test');
  await page.getByLabel('Nom complet').fill('Candidat Test');

  await expect(page.getByRole('button', { name: 'Envoyer ma candidature' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Développeur TypeScript' })).toBeVisible();
});
