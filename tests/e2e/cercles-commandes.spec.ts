import { test, expect } from '@playwright/test';

test.describe('Commandes par cercle', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/order_periods**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'p1', nom: 'Période Test', date_limite: '2025-01-15', status: 'open' }
        ])
      });
    });
    await page.route('**/rest/v1/circle_requests**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'r1', circle_id: 'c1', circles: { id: 'c1', nom: 'Cercle Alpha' } }
        ])
      });
    });
    await page.route('**/rest/v1/request_lines**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'l1', qty: 2, article_id: 'a1', articles: { id: 'a1', libelle: 'Stylo', ref: 'ST-01', fournisseur: 'FournA', prix_unitaire: 3 } },
          { id: 'l2', qty: 1, article_id: 'a2', articles: { id: 'a2', libelle: 'Cahier', ref: 'CAH-02', fournisseur: 'FournB', prix_unitaire: 5 } }
        ])
      });
    });
  });

  test('affiche le total de chaque commande', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /commandes/i }).click();
    await expect(page.getByText('Stylo')).toBeVisible();
    await expect(page.getByTestId('circle-total')).toHaveText(/11\.00 €/);
  });
});
