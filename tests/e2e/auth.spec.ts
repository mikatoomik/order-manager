import { test, expect, Page } from '@playwright/test';

const login = async (page: Page) => {
  await page.goto('/?test=1'); // Active le mode test (utilisateur simulé)
};

test.describe('Authentification', () => {
  test('l’utilisateur simulé voit le bouton de déconnexion', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('button', { name: /se déconnecter/i })).toBeVisible();
  });
});
