import { test, expect } from '@playwright/test';

// Scénario :
// 1. L’utilisateur se connecte via magic-link.
// 2. Il voit la page « Mes demandes » vide.
// 3. Il clique « Ajouter un article » → modal s’affiche.
// 4. Il sélectionne un article fictif et valide → la ligne apparaît.

test.describe('Gestion des demandes', () => {
  test('ajout d’un article à une demande', async ({ page }) => {
    // 1. Connexion via magic-link (mockée)
    await page.goto('/');
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByRole('button', { name: /envoyer le lien/i }).click();
    // Supposons que la connexion est simulée

    // 2. Page « Mes demandes » vide
    await expect(page.getByRole('heading', { name: /mes demandes/i })).toBeVisible();
    await expect(page.getByText('Aucune demande')).toBeVisible();

    // 3. Ouvre la modal d’ajout
    await page.getByRole('button', { name: /ajouter un article/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // 4. Sélection d’un article fictif et validation
    await page.getByLabel('Article').selectOption('article-1');
    await page.getByRole('button', { name: /valider/i }).click();

    // 5. La ligne apparaît dans la liste
    await expect(page.getByText('article-1')).toBeVisible();
  });
});
