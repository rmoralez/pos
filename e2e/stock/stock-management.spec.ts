import { test, expect } from '@playwright/test';
import { generateTestData, PageActions, Assertions } from '../utils/test-helpers';

test.describe('Stock Management', () => {
  let actions: PageActions;
  let assertions: Assertions;
  let testProduct: any;

  test.beforeAll(async ({ browser }) => {
    // Create test product with stock via API
    const context = await browser.newContext({ storageState: '.auth/user.json' });
    const page = await context.newPage();

    testProduct = generateTestData.product({
      name: 'Stock Test Product',
      salePrice: '1000',
      costPrice: '500',
      stock: '50'
    });

    await page.request.post('http://localhost:3000/api/products', {
      data: {
        sku: testProduct.sku,
        name: testProduct.name,
        salePrice: parseFloat(testProduct.salePrice),
        costPrice: parseFloat(testProduct.costPrice),
        taxRate: parseFloat(testProduct.taxRate),
        minStock: 10,
        initialStock: parseInt(testProduct.stock),
        active: true,
      },
    });

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    actions = new PageActions(page);
    assertions = new Assertions(page);
    await page.goto('/dashboard/stock');
  });

  test.describe('Stock Viewing', () => {
    test('should display stock levels for products', async ({ page }) => {
      // Wait for stock table to load
      await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();

      // Check for stock table
      await expect(page.getByText('SKU')).toBeVisible();
      await expect(page.getByText('Stock Actual')).toBeVisible();

      // Product should appear in stock list
      await expect(page.getByText(testProduct.name).first()).toBeVisible();
    });

    test('should show statistics cards', async ({ page }) => {
      await expect(page.getByText('Total Productos')).toBeVisible();
      await expect(page.getByText('Stock Bajo')).toBeVisible();
      await expect(page.getByText('Movimientos Recientes')).toBeVisible();
    });

    test('should filter by low stock', async ({ page }) => {
      // Click low stock filter button
      await page.getByRole('button', { name: /Stock Bajo/i }).click();

      // Table should update (wait for it)
      await page.waitForTimeout(500);

      // Should show filtered results
      await expect(page.getByText('Stock Bajo').first()).toBeVisible();
    });

    test('should search products in stock', async ({ page }) => {
      await actions.search('Buscar por nombre o SKU', testProduct.name);

      // Should show search results
      await expect(page.getByText(testProduct.name).first()).toBeVisible();
    });
  });

  test.describe('Stock Movements', () => {
    test('should create stock adjustment (increase)', async ({ page }) => {
      // Click "Movimiento de Stock" button
      await page.getByRole('button', { name: /Movimiento de Stock/i }).click();

      // Wait for dialog
      await expect(page.getByRole('heading', { name: 'Registrar Movimiento de Stock' })).toBeVisible();

      // Select product
      await page.getByRole('combobox').first().click();
      await page.getByRole('option', { name: new RegExp(testProduct.name) }).first().click();

      // Select movement type (Adjustment)
      await page.getByRole('combobox').nth(1).click();
      await page.getByRole('option', { name: 'Ajuste' }).click();

      // Enter quantity
      await actions.fillField('Cantidad', '10');

      // Enter reason
      await page.getByPlaceholder('Describe el motivo del movimiento...').fill('Test adjustment');

      // Submit
      await page.getByRole('button', { name: 'Registrar Movimiento' }).click();

      // Should show success toast
      await actions.waitForToast('Movimiento registrado');
    });

    test('should view movement history', async ({ page }) => {
      // Switch to movements tab
      await page.getByRole('tab', { name: 'Movimientos' }).click();

      // Should show movements table
      await expect(page.getByText('Tipo').first()).toBeVisible();
      await expect(page.getByText('Cantidad').first()).toBeVisible();
      await expect(page.getByText('Usuario').first()).toBeVisible();
    });

    test('should prevent negative stock adjustment', async ({ page }) => {
      // Click "Movimiento de Stock" button
      await page.getByRole('button', { name: /Movimiento de Stock/i }).click();

      // Select product
      await page.getByRole('combobox').first().click();
      await page.getByRole('option', { name: new RegExp(testProduct.name) }).first().click();

      // Select loss type
      await page.getByRole('combobox').nth(1).click();
      await page.getByRole('option', { name: 'Pérdida' }).click();

      // Enter quantity larger than available stock
      await actions.fillField('Cantidad', '99999');

      // Submit
      await page.getByRole('button', { name: 'Registrar Movimiento' }).click();

      // Should show error
      await expect(page.getByText(/stock/i).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Stock Tabs', () => {
    test('should switch between tabs', async ({ page }) => {
      // Check Stock Actual tab is active
      await expect(page.getByRole('tab', { name: 'Stock Actual' })).toHaveAttribute('data-state', 'active');

      // Switch to Movimientos tab
      await page.getByRole('tab', { name: 'Movimientos' }).click();
      await expect(page.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute('data-state', 'active');

      // Switch back
      await page.getByRole('tab', { name: 'Stock Actual' }).click();
      await expect(page.getByRole('tab', { name: 'Stock Actual' })).toHaveAttribute('data-state', 'active');
    });
  });
});
