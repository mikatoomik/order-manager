import { test, expect, Page } from '@playwright/test';

const login = async (page: Page) => {
  await page.goto('/?test=1'); // Active le mode test (utilisateur simulé)
};

test.describe('Gestion des demandes', () => {
  test('ajout d’un article à une demande', async ({ page }) => {
    await login(page);
    // Aller sur le catalogue et récupérer le premier article
    await page.getByRole('link', { name: /catalogue/i }).click();
    await expect(page.getByRole('heading', { name: /catalogue/i })).toBeVisible();
    const boutonAjouter = page.locator('ul li button');
    await expect(boutonAjouter.first()).toBeVisible();
    const firstArticle = await boutonAjouter.first().textContent();
    const articleName = firstArticle?.replace(/^Ajouter /i, '') ?? '';
    await page.getByRole('link', { name: /mes demandes/i }).click();
    await expect(page.getByRole('heading', { name: /mes demandes/i })).toBeVisible();
    await expect(page.getByText('Aucune demande')).toBeVisible();
    await page.getByRole('button', { name: /ajouter un article/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Article').selectOption(articleName);
    await page.getByRole('button', { name: /valider/i }).click();
    await expect(page.getByText(articleName)).toBeVisible();
  });
});
