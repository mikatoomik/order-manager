import { test, expect } from '@playwright/test';

test.describe('Gestion des périodes', () => {
  test.beforeEach(async ({ page }) => {
    // Mock l'utilisateur FinAdmin et les périodes
    await page.route('**/rest/v1/user_circles**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { circles: { id: 'finadmin', nom: 'FinAdmin' } }
      ])
    }));
    await page.route('**/rest/v1/order_periods**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'p1', nom: 'Période 1', date_limite: '2025-06-15', status: 'open' },
        { id: 'p2', nom: 'Période 2', date_limite: '2025-05-31', status: 'closed' }
      ])
    }));
    await page.goto('/');
    // Aller sur la page Périodes
    await page.getByRole('button', { name: /périodes/i }).click();
  });

  test('affiche la liste des périodes', async ({ page }) => {
    await expect(page.getByText('Période 1')).toBeVisible();
    await expect(page.getByText('Période 2')).toBeVisible();
    await expect(page.getByRole('button', { name: /créer une nouvelle période/i })).toBeVisible();
  });

  test('crée une nouvelle période', async ({ page }) => {
    await page.getByRole('button', { name: /créer une nouvelle période/i }).click();
    // Vérifie l'affichage du message de succès
    await expect(page.getByText(/période créée/i)).toBeVisible();
  });

  test('change l\'état d\'une période', async ({ page }) => {
    await page.getByRole('button', { name: /créer une nouvelle période/i }); // S'assurer que la page est chargée
    const select = page.getByRole('combobox').first();
    await select.selectOption('closed');
    await expect(page.getByText(/état modifié/i)).toBeVisible();
  });
});
