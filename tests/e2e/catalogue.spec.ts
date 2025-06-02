import { test, expect, Page } from '@playwright/test';

const login = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByRole('button', { name: /envoyer le lien/i }).click();
};

test.describe('Catalogue', () => {
  test('affichage du catalogue et ajout à la demande', async ({ page }) => {
    // Connexion utilisateur
    await login(page);

    // Accès au catalogue
    await page.getByRole('link', { name: /catalogue/i }).click();
    await expect(page.getByRole('heading', { name: /catalogue/i })).toBeVisible();
    await expect(page.getByText('article-1')).toBeVisible();
    await expect(page.getByText('article-2')).toBeVisible();

    // Ajout d'un article à la demande depuis le catalogue
    await page.getByRole('button', { name: /ajouter article-2/i }).click();
    await page.getByRole('link', { name: /mes demandes/i }).click();
    await expect(page.getByText('article-2')).toBeVisible();
  });
});
