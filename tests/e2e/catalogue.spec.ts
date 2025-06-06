import { test, expect } from '@playwright/test';

test.describe('Catalogue', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/articles**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'a1', libelle: 'Stylo', ref: 'ST-01', fournisseur: 'FournA', prix_unitaire: 3, url: null }
        ])
      });
    });
    await page.route('**/rest/v1/user_circles**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { circles: { id: 'c1', nom: 'Cercle Test' } }
        ])
      });
    });
    await page.route('**/rest/v1/order_periods**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'p1', nom: 'Période Test', date_limite: '2025-01-15', status: 'open' }
        ])
      });
    });
    await page.route('**/rest/v1/circle_requests**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/rest/v1/request_lines**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  });

  test('affiche le total et le bouton de validation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /catalogue/i }).click();
    await page.getByRole('button', { name: /ajouter stylo/i }).click();
    await expect(page.getByTestId('drawer-total')).toHaveText(/3\.00 €/);
    await expect(page.getByRole('button', { name: /valider ma commande/i })).toBeVisible();
    await expect(page.getByText(/Période :/)).toBeVisible();
  });
});

