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

  test('le profil affiche display name, avatar, surnom et cercles', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: /profil/i }).click();
    // Display name
    await expect(page.getByTestId('profil-displayname')).toHaveText(/Nom affiché\s*:\s*Test Utilisateur/i);
    // Avatar
    const avatar = page.getByTestId('profil-avatar');
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveAttribute('src', /ui-avatars/);
    // Surnom
    await expect(page.getByTestId('profil-nickname')).toHaveText(/Surnom\s*:\s*SuperTest/i);
    // Cercles
    const cercles = page.getByTestId('profil-cercles');
    await expect(cercles).toContainText('Cercle Alpha');
    await expect(cercles).toContainText('Cercle Beta');
  });
});
