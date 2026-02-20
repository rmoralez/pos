import { test, expect } from '@playwright/test';
import { PageActions, generateTestData } from '../utils/test-helpers';

test.describe('POS Keyboard Shortcuts', () => {
  let productSku: string;
  let productName: string;
  let productId: string;
  let cashRegisterId: string;

  // Create product and cash register once for all tests
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: '.auth/user.json' });
    const page = await context.newPage();

    // Create product via API
    productSku = `TEST-${Date.now()}`;
    productName = `Test Product ${Date.now()}`;

    const productRes = await page.request.post('http://localhost:3000/api/products', {
      data: {
        sku: productSku,
        name: productName,
        costPrice: 100,
        salePrice: 150,
        taxRate: 21,
        trackStock: true,
        minStock: 5,
        initialStock: 50,
      },
    });

    if (productRes.ok()) {
      const product = await productRes.json();
      productId = product.id;
    }

    // Open cash register via API
    const cashRegisterRes = await page.request.post('http://localhost:3000/api/cash-registers', {
      data: {
        openingBalance: 10000,
        notes: 'E2E test cash register for keyboard shortcuts',
      },
    });

    if (cashRegisterRes.ok()) {
      const cashRegister = await cashRegisterRes.json();
      cashRegisterId = cashRegister.id;
    }

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: '.auth/user.json' });
    const page = await context.newPage();

    // Clean up: close cash register
    if (cashRegisterId) {
      await page.request.post(`http://localhost:3000/api/cash-registers/${cashRegisterId}/close`, {
        data: {
          finalBalance: 10000,
          notes: 'E2E test cleanup',
        },
      }).catch(() => {});
    }

    // Delete product
    if (productId) {
      await page.request.delete(`http://localhost:3000/api/products/${productId}`).catch(() => {});
    }

    await context.close();
  });

  test.describe('Keyboard Shortcuts Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard/pos');
    });

    test('should focus search field with F1', async ({ page }) => {
      // Click somewhere else first to ensure search is not focused
      await page.click('body');

      const searchInput = page.getByPlaceholder('Buscar producto...');

      // Press F1
      await page.keyboard.press('F1');

      // Search field should now be focused
      await expect(searchInput).toBeFocused();
    });

    test('should show shortcuts legend with F9', async ({ page }) => {
      // Click body to ensure page is focused and ready
      await page.click('body');

      // Shortcuts legend should not be visible initially
      await expect(page.getByText('Atajos de Teclado')).not.toBeVisible();

      // Press F9 to show shortcuts
      await page.keyboard.press('F9');

      // Shortcuts legend should be visible
      await expect(page.getByText('Atajos de Teclado')).toBeVisible();
      await expect(page.getByText('Enfocar búsqueda')).toBeVisible();
      await expect(page.locator('span', { hasText: 'Limpiar carrito' }).first()).toBeVisible();

      // Press F9 again to hide shortcuts
      await page.keyboard.press('F9');

      // Shortcuts legend should be hidden
      await expect(page.getByText('Atajos de Teclado')).not.toBeVisible();
    });

    test('should clear cart with F7', async ({ page }) => {
      // Add product to cart
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).first().click();

      // Verify product in cart
      await expect(page.getByText('1 producto en el carrito')).toBeVisible();

      // Press F7 to clear cart
      await page.keyboard.press('F7');

      // Cart should be empty
      await expect(page.getByText('El carrito está vacío')).toBeVisible();
    });

    test('should open payment dialog with F2', async ({ page }) => {
      // Add product to cart
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).first().click();

      // Verify product in cart
      await expect(page.getByText('1 producto en el carrito')).toBeVisible();

      // Press F2 to open payment dialog (Efectivo)
      await page.keyboard.press('F2');

      // Payment dialog should be visible
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Procesar Pago' })).toBeVisible();
    });

    test('should not trigger F2 when cart is empty', async ({ page }) => {
      // Cart is empty
      await expect(page.getByText('El carrito está vacío')).toBeVisible();

      // Press F2
      await page.keyboard.press('F2');

      // Payment dialog should not open
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should not trigger F7 when cart is empty', async ({ page }) => {
      // Cart is empty
      await expect(page.getByText('El carrito está vacío')).toBeVisible();

      // Press F7 (should not do anything since cart is already empty)
      await page.keyboard.press('F7');

      // Cart should still be empty
      await expect(page.getByText('El carrito está vacío')).toBeVisible();
    });

    test('should not trigger shortcuts when typing in input field', async ({ page }) => {
      // Focus on search input
      const searchInput = page.getByPlaceholder('Buscar producto...');
      await searchInput.click();

      // Type text in the search field
      await searchInput.type('test text');

      // The search input should contain the typed text
      await expect(searchInput).toHaveValue('test text');

      // Shortcuts legend should not be visible
      await expect(page.getByText('Atajos de Teclado')).not.toBeVisible();

      // Payment dialog should not open
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should display visual indicators for shortcuts', async ({ page }) => {
      // Verify F1 badge on search input
      await expect(page.getByText('F1').first()).toBeVisible();

      // Verify F2 badge on Efectivo button
      const efectivoButton = page.locator('button').filter({ hasText: 'Efectivo' });
      await expect(efectivoButton.locator('text=F2')).toBeVisible();

      // Verify F7 badge on clear cart button
      const clearButtonArea = page.locator('button').filter({ hasText: 'Limpiar Carrito' });
      await expect(clearButtonArea.locator('text=F7')).toBeVisible();

      // Verify F9 badge on shortcuts toggle button
      const shortcutsButtonArea = page.locator('button').filter({ hasText: 'Mostrar' });
      await expect(shortcutsButtonArea.locator('text=F9')).toBeVisible();
    });
  });
});
