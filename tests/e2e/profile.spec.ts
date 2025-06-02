import { test, expect, Page } from '@playwright/test';

const login = async (page: Page) => {
  await page.goto('/?test=1'); // Active le mode test (utilisateur simulé)
};

test.describe('Profil utilisateur', () => {
  test('l’utilisateur connecté peut accéder à la page profil et voir son email', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /profil/i }).click();
    await expect(page.getByRole('heading', { name: /mon profil/i })).toBeVisible();
    await expect(page.getByTestId('profil-email')).toBeVisible();
  });
});
