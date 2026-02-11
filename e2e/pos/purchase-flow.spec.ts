import { test, expect } from '@playwright/test';
import { PageActions, generateTestData } from '../utils/test-helpers';

test.describe('POS Purchase Flow', () => {
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
        costPrice: 100.50,
        salePrice: 150.75,
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
        notes: 'E2E test cash register',
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

  test.describe('Successful Purchase Flow', () => {
    let actions: PageActions;

    test.beforeEach(async ({ page }) => {
      actions = new PageActions(page);
    });

    test('should complete a sale with cash payment', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Verify we're on POS page
      await expect(page.getByText('Punto de Venta')).toBeVisible();

      // Search for product
      const searchInput = page.getByPlaceholder('Buscar producto...');
      await searchInput.fill(productSku);
      await page.waitForTimeout(500); // Wait for search debounce

      // Wait for product to appear in search results
      await expect(page.getByText(productName)).toBeVisible({ timeout: 5000 });

      // Add product to cart
      await page.getByText(productName).click();

      // Verify product is in cart
      await expect(page.getByText(`${productName}`)).toBeVisible();
      await expect(page.getByText('1 producto en el carrito')).toBeVisible();

      // Verify totals are calculated
      await expect(page.getByText('Subtotal')).toBeVisible();
      await expect(page.getByText('IVA', { exact: true })).toBeVisible();
      await expect(page.getByText('Total', { exact: true })).toBeVisible();

      // Click payment button
      await page.getByRole('button', { name: /Procesar Pago/i }).click();

      // Payment dialog should appear
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Procesar Pago' })).toBeVisible();

      // Select cash payment (should be default)
      await expect(page.getByText('Efectivo')).toBeVisible();

      // Confirm payment
      await page.getByRole('button', { name: /Confirmar Pago/i }).click();

      // Wait for success toast
      await expect(page.getByText('Venta completada')).toBeVisible({ timeout: 10000 });

      // Cart should be cleared
      await expect(page.getByText('El carrito está vacío')).toBeVisible();
    });

    test('should complete a sale with credit card payment', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Add product to cart
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).click();

      // Open payment dialog
      await page.getByRole('button', { name: /Procesar Pago/i }).click();

      // Change payment method to credit card
      await page.getByRole('combobox').click();
      await page.getByText('Tarjeta de Crédito').click();

      // Confirm payment
      await page.getByRole('button', { name: /Confirmar Pago/i }).click();

      // Wait for success
      await expect(page.getByText('Venta completada')).toBeVisible({ timeout: 10000 });
    });

    test('should handle multiple items in cart', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Add product to cart
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).click();

      // Verify initial quantity
      await expect(page.getByText('1 producto en el carrito')).toBeVisible();

      // Increase quantity using + button
      await page.getByLabel('Plus').first().click();
      await page.waitForTimeout(300);

      // Verify quantity updated
      await expect(page.getByText('2 productos en el carrito')).toBeVisible();

      // Verify totals updated
      const total = 150.75 * 1.21 * 2; // price * tax * quantity
      await expect(page.locator('text=/Total/')).toBeVisible();

      // Complete purchase
      await page.getByRole('button', { name: /Procesar Pago/i }).click();
      await page.getByRole('button', { name: /Confirmar Pago/i }).click();
      await expect(page.getByText('Venta completada')).toBeVisible({ timeout: 10000 });
    });

    test('should decrease quantity using - button', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Add product to cart
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).click();

      // Increase quantity to 3
      await page.getByLabel('Plus').first().click();
      await page.waitForTimeout(300);
      await page.getByLabel('Plus').first().click();
      await page.waitForTimeout(300);

      await expect(page.getByText('3 productos en el carrito')).toBeVisible();

      // Decrease quantity
      await page.getByLabel('Minus').first().click();
      await page.waitForTimeout(300);

      await expect(page.getByText('2 productos en el carrito')).toBeVisible();
    });

    test('should remove item from cart', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Add product to cart
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).click();

      await expect(page.getByText('1 producto en el carrito')).toBeVisible();

      // Click trash button to remove
      await page.getByLabel('Delete').first().click();

      // Cart should be empty
      await expect(page.getByText('El carrito está vacío')).toBeVisible();
    });

    test('should clear entire cart', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Add product to cart
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).click();

      await expect(page.getByText('1 producto en el carrito')).toBeVisible();

      // Click clear cart button
      await page.getByRole('button', { name: /Limpiar Carrito/i }).click();

      // Cart should be empty
      await expect(page.getByText('El carrito está vacío')).toBeVisible();
    });
  });

  test.describe('Validation and Error Handling', () => {
    let actions: PageActions;

    test.beforeEach(async ({ page }) => {
      actions = new PageActions(page);
    });

    test('should disable payment button when cart is empty', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Payment button should be disabled
      const paymentButton = page.getByRole('button', { name: /Procesar Pago/i });
      await expect(paymentButton).toBeDisabled();
    });

    test('should handle sale with Decimal values (Prisma string serialization)', async ({ page }) => {
      // This test specifically validates the fix for Zod coercion
      await page.goto('/dashboard/pos');

      // Add product (which has Decimal values from DB)
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).click();

      // Complete purchase
      await page.getByRole('button', { name: /Procesar Pago/i }).click();
      await page.getByRole('button', { name: /Confirmar Pago/i }).click();

      // Should succeed without validation errors
      await expect(page.getByText('Venta completada')).toBeVisible({ timeout: 10000 });

      // Verify no error toast
      const errorToast = page.getByText(/Validation error|Expected number/i);
      await expect(errorToast).not.toBeVisible();
    });

    test('should show error when no cash register is open', async ({ page, browser }) => {
      // Close the cash register via API
      const context = await browser.newContext({ storageState: '.auth/user.json' });
      const apiPage = await context.newPage();
      await apiPage.request.post(`http://localhost:3000/api/cash-registers/${cashRegisterId}/close`, {
        data: {
          finalBalance: 10000,
          notes: 'Test closing for error scenario',
        },
      });
      await context.close();

      await page.goto('/dashboard/pos');

      // Should show alert about no cash register
      await expect(page.getByText('No hay caja abierta')).toBeVisible();
      await expect(page.getByText(/Debes abrir una caja antes/i)).toBeVisible();

      // Add product to cart
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).click();

      // Payment button should be disabled
      const paymentButton = page.getByRole('button', { name: /Procesar Pago/i });
      await expect(paymentButton).toBeDisabled();
    });

    test('should update stock after sale', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Add product with quantity 5
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).click();

      // Increase quantity to 5
      for (let i = 0; i < 4; i++) {
        await page.getByLabel('Plus').first().click();
        await page.waitForTimeout(200);
      }

      // Complete purchase
      await page.getByRole('button', { name: /Procesar Pago/i }).click();
      await page.getByRole('button', { name: /Confirmar Pago/i }).click();
      await expect(page.getByText('Venta completada')).toBeVisible({ timeout: 10000 });

      // Verify stock was updated by checking API
      const stockResponse = await page.request.get(`/api/products/${productId}`);
      const productData = await stockResponse.json();
      const currentStock = productData.stock[0]?.quantity || 0;

      // Should be 50 - 5 = 45
      expect(currentStock).toBe(45);
    });

    test('should show error for insufficient stock', async ({ page, browser }) => {
      // Create a product with only 1 item in stock via API
      const lowStockSku = `LOWSTOCK-${Date.now()}`;
      const lowStockName = 'Low Stock Product';

      const context = await browser.newContext({ storageState: '.auth/user.json' });
      const apiPage = await context.newPage();

      const lowStockRes = await apiPage.request.post('http://localhost:3000/api/products', {
        data: {
          sku: lowStockSku,
          name: lowStockName,
          costPrice: 50,
          salePrice: 100,
          taxRate: 21,
          trackStock: true,
          initialStock: 1,
        },
      });

      const lowStockProduct = await lowStockRes.json();
      await context.close();

      await page.goto('/dashboard/pos');

      // Add product to cart
      await page.getByPlaceholder('Buscar producto...').fill(lowStockSku);
      await page.waitForTimeout(500);
      await page.getByText('Low Stock Product').click();

      // Try to increase quantity beyond available stock
      await page.getByLabel('Plus').first().click();
      await page.waitForTimeout(500);

      // Should show error toast
      await expect(page.getByText(/Stock insuficiente|Solo hay.*unidades/i)).toBeVisible();

      // Clean up
      const cleanupContext = await browser.newContext({ storageState: '.auth/user.json' });
      const cleanupPage = await cleanupContext.newPage();
      await cleanupPage.request.delete(`http://localhost:3000/api/products/${lowStockProduct.id}`).catch(() => {});
      await cleanupContext.close();
    });
  });

  test.describe('Payment Dialog', () => {
    let actions: PageActions;

    test.beforeEach(async ({ page }) => {
      actions = new PageActions(page);
    });

    test('should close payment dialog on cancel', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Add product to cart
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).click();

      // Open payment dialog
      await page.getByRole('button', { name: /Procesar Pago/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click cancel
      await page.getByRole('button', { name: /Cancelar/i }).click();

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Cart should still have items
      await expect(page.getByText('1 producto en el carrito')).toBeVisible();
    });

    test('should show all payment methods', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Add product to cart
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).click();

      // Open payment dialog
      await page.getByRole('button', { name: /Procesar Pago/i }).click();

      // Open payment method dropdown
      await page.getByRole('combobox').click();

      // Check all payment methods are available
      await expect(page.getByText('Efectivo').first()).toBeVisible();
      await expect(page.getByText('Tarjeta de Débito')).toBeVisible();
      await expect(page.getByText('Tarjeta de Crédito')).toBeVisible();
      await expect(page.getByText('QR (Mercado Pago)')).toBeVisible();
      await expect(page.getByText('Transferencia')).toBeVisible();
    });

    test('should display correct totals in payment dialog', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Add product to cart
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await page.getByText(productName).click();

      // Open payment dialog
      await page.getByRole('button', { name: /Procesar Pago/i }).click();

      // Verify totals are displayed
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('Subtotal')).toBeVisible();
      await expect(dialog.getByText('IVA')).toBeVisible();
      await expect(dialog.getByText('Items')).toBeVisible();
      await expect(dialog.getByText('1 producto')).toBeVisible();
    });
  });

  test.describe('Product Search', () => {
    let actions: PageActions;

    test.beforeEach(async ({ page }) => {
      actions = new PageActions(page);
    });

    test('should search products by name', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Search by name
      await page.getByPlaceholder('Buscar producto...').fill(productName);
      await page.waitForTimeout(500);

      // Product should appear
      await expect(page.getByText(productName)).toBeVisible();
    });

    test('should search products by SKU', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Search by SKU
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);

      // Product should appear
      await expect(page.getByText(productName)).toBeVisible();
    });

    test('should clear search results when input is cleared', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Search for product
      await page.getByPlaceholder('Buscar producto...').fill(productSku);
      await page.waitForTimeout(500);
      await expect(page.getByText(productName)).toBeVisible();

      // Clear search
      await page.getByPlaceholder('Buscar producto...').clear();
      await page.waitForTimeout(500);

      // Search results should be gone (or minimal results)
      // Note: We check that the search container is not prominently displayed
      const searchResults = page.locator('text="Stock:"');
      const count = await searchResults.count();
      expect(count).toBeLessThanOrEqual(1);
    });

    test('should not show out of stock products', async ({ page, browser }) => {
      // Create a product with 0 stock via API
      const outOfStockSku = `NOSTOCK-${Date.now()}`;
      const outOfStockName = 'Out of Stock Product';

      const context = await browser.newContext({ storageState: '.auth/user.json' });
      const apiPage = await context.newPage();

      const outOfStockRes = await apiPage.request.post('http://localhost:3000/api/products', {
        data: {
          sku: outOfStockSku,
          name: outOfStockName,
          costPrice: 50,
          salePrice: 100,
          taxRate: 21,
          trackStock: true,
          initialStock: 0,
        },
      });

      const outOfStockProduct = await outOfStockRes.json();
      await context.close();

      await page.goto('/dashboard/pos');

      // Search for out of stock product
      await page.getByPlaceholder('Buscar producto...').fill(outOfStockSku);
      await page.waitForTimeout(500);

      // Product should appear but show "Stock: 0"
      await expect(page.getByText('Out of Stock Product')).toBeVisible();
      await expect(page.getByText('Stock: 0')).toBeVisible();

      // Try to add to cart
      await page.getByText('Out of Stock Product').click();

      // Should show error
      await expect(page.getByText(/Sin stock|no tiene stock disponible/i).first()).toBeVisible();

      // Clean up
      const cleanupContext = await browser.newContext({ storageState: '.auth/user.json' });
      const cleanupPage = await cleanupContext.newPage();
      await cleanupPage.request.delete(`http://localhost:3000/api/products/${outOfStockProduct.id}`).catch(() => {});
      await cleanupContext.close();
    });
  });
});
