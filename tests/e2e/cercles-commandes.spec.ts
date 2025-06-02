import { test, expect, Page } from '@playwright/test';

const login = async (page: Page) => {
  await page.goto('/?test=1'); // Mode test
};

test.describe('Commandes par cercle', () => {
  test('affiche les commandes de chaque cercle pour la période en cours', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /mes demandes/i }).click();
    await expect(page.getByRole('heading', { name: /commandes par cercle/i })).toBeVisible();
    await expect(page.getByText(/période/i)).toBeVisible();
    // Vérifie l'affichage des cercles simulés
    await expect(page.getByRole('heading', { name: /cercle alpha/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /cercle beta/i })).toBeVisible();
    // Vérifie qu'il y a bien un message ou une liste d'articles pour chaque cercle
    await expect(page.locator('div').filter({ hasText: 'Cercle Alpha' })).toBeVisible();
    await expect(page.locator('div').filter({ hasText: 'Cercle Beta' })).toBeVisible();
  });
});
