import { test, expect, Page } from '@playwright/test';

const login = async (page: Page) => {
  await page.goto('/?test=1'); // Active le mode test (utilisateur simulé)
};

const getFirstArticle = async (page: Page) => {
  await page.getByRole('link', { name: /catalogue/i }).click();
  await expect(page.getByRole('heading', { name: /catalogue/i })).toBeVisible();
  // Attendre qu'au moins un bouton "Ajouter ..." soit visible
  const boutonAjouter = page.locator('ul li button');
  await expect(boutonAjouter.first()).toBeVisible();
  const firstArticle = await boutonAjouter.first().textContent();
  return firstArticle?.replace(/^Ajouter /i, '') ?? '';
};

test.describe('Catalogue', () => {
  test('affichage du catalogue et ajout à la demande', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /catalogue/i }).click();
    await expect(page.getByRole('heading', { name: /catalogue/i })).toBeVisible();
    const boutonAjouter = page.locator('ul li button');
    await expect(boutonAjouter.first()).toBeVisible();
    const firstArticle = await boutonAjouter.first().textContent();
    const articleName = firstArticle?.replace(/^Ajouter /i, '') ?? '';
    await expect(page.getByText(articleName)).toBeVisible();
    await page.getByRole('button', { name: new RegExp(`ajouter ${articleName}`, 'i') }).click();
    await page.getByRole('link', { name: /mes demandes/i }).click();
    await expect(page.getByText(articleName)).toBeVisible();
  });
});
