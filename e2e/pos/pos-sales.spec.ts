import { test, expect } from '@playwright/test';
import { generateTestData, PageActions, Assertions } from '../utils/test-helpers';

test.describe('Point of Sale', () => {
  // Store product data for use in tests
  let laptopProduct: any;
  let mouseProduct: any;
  let tecladoProduct: any;
  let monitorProduct: any;

  // Setup: Create test products once before all tests
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: '.auth/user.json' });
    const page = await context.newPage();

    // Create test products via API
    laptopProduct = generateTestData.product({ name: 'Laptop HP', salePrice: '50000', costPrice: '30000', stock: '10' });
    mouseProduct = generateTestData.product({ name: 'Mouse Logitech', salePrice: '5000', costPrice: '2500', stock: '20' });
    tecladoProduct = generateTestData.product({ name: 'Teclado Mecánico', salePrice: '15000', costPrice: '8000', stock: '15' });
    monitorProduct = generateTestData.product({ name: 'Monitor LG', salePrice: '35000', costPrice: '20000', stock: '0' });

    const products = [laptopProduct, mouseProduct, tecladoProduct, monitorProduct];

    for (const product of products) {
      await page.request.post('http://localhost:3000/api/products', {
        data: {
          sku: product.sku,
          name: product.name,
          salePrice: parseFloat(product.salePrice),
          costPrice: parseFloat(product.costPrice),
          taxRate: parseFloat(product.taxRate),
          stock: parseInt(product.stock),
          active: true,
        },
      });
    }

    // Create cash register
    await page.request.post('http://localhost:3000/api/cash-registers', {
      data: {
        openingBalance: 10000,
        notes: 'E2E test cash register for pos-sales',
      },
    });

    await context.close();
  });

  // Navigate to POS before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/pos');
  });

  test.describe('Product Search in POS', () => {
    test('should search and display products', async ({ page }) => {
      const actions = new PageActions(page);

      // Search for "Laptop"
      await actions.search('Buscar producto', 'Laptop');

      // Should display search results
      await expect(page.getByText('Laptop HP').first()).toBeVisible();
      await expect(page.getByText('$50.000')).toBeVisible();
    });

    test('should show stock information in search results', async ({ page }) => {
      const actions = new PageActions(page);

      await actions.search('Buscar producto', 'Mouse');

      // Should show stock badge
      await expect(page.getByText('Stock: 20')).toBeVisible();
    });

    test('should not show inactive products in search', async ({ page }) => {
      const inactiveProduct = generateTestData.product({ name: 'Inactive Product' });
      const actions = new PageActions(page);

      // Create inactive product via API
      await page.request.post('http://localhost:3000/api/products', {
        data: {
          sku: inactiveProduct.sku,
          name: inactiveProduct.name,
          salePrice: parseFloat(inactiveProduct.salePrice),
          costPrice: parseFloat(inactiveProduct.costPrice),
          taxRate: parseFloat(inactiveProduct.taxRate),
          stock: parseInt(inactiveProduct.stock),
          active: false, // Inactive product
        },
      });

      // Reload POS page and search
      await page.goto('/dashboard/pos');
      await actions.search('Buscar producto', 'Inactive');

      // Should not find the inactive product
      await expect(page.getByText(inactiveProduct.name)).not.toBeVisible();
    });

    test('should only search when query is at least 2 characters', async ({ page }) => {
      const actions = new PageActions(page);

      // Type only 1 character
      await actions.search('Buscar producto', 'L');

      // Should not show results
      await expect(page.getByText('Laptop HP')).not.toBeVisible();

      // Type 2 characters
      await actions.search('Buscar producto', 'La');

      // Should show results
      await expect(page.getByText('Laptop HP').first()).toBeVisible();
    });
  });

  test.describe('Shopping Cart Management', () => {
    test('should add product to cart', async ({ page }) => {
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Search and add product
      await actions.search('Buscar producto', 'Laptop');
      await page.getByText('Laptop HP').first().click();

      // Should add to cart
      await assertions.assertCartItemCount(1);
      await expect(page.getByText('Laptop HP').nth(1)).toBeVisible(); // In cart
    });

    test('should calculate subtotal and total correctly', async ({ page }) => {
      const actions = new PageActions(page);

      // Add Laptop (50000)
      await actions.search('Buscar producto', 'Laptop');
      await page.getByText('Laptop HP').first().click();

      // Verify total calculation
      // Laptop: 50000 + IVA 21% = 60500
      await expect(page.getByText('$50.000,00').first()).toBeVisible(); // Subtotal
      await expect(page.getByText('$10.500,00')).toBeVisible(); // IVA
      await expect(page.getByText('$60.500,00')).toBeVisible(); // Total
    });

    test('should increase quantity when adding same product', async ({ page }) => {
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Add same product twice
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      // Should have 1 item with quantity 2
      await assertions.assertCartItemCount(1);
      await expect(page.getByText('x 2')).toBeVisible();
    });

    test('should update total when quantity changes', async ({ page }) => {
      const actions = new PageActions(page);

      // Add product
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      // Increase quantity using + button
      const cartItem = page.locator('.border.rounded-lg').filter({ hasText: 'Mouse Logitech' });
      await cartItem.getByRole('button').filter({ hasText: 'Plus' }).click();

      // Should show quantity 2 and updated total
      await expect(page.getByText('x 2')).toBeVisible();
      // Mouse: 5000 x 2 = 10000 + IVA 21% = 12100
      await expect(page.getByText('$12.100,00')).toBeVisible();
    });

    test('should decrease quantity using - button', async ({ page }) => {
      const actions = new PageActions(page);

      // Add product twice
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      // Should have quantity 2
      await expect(page.getByText('x 2')).toBeVisible();

      // Decrease quantity
      const cartItem = page.locator('.border.rounded-lg').filter({ hasText: 'Mouse Logitech' });
      await cartItem.getByRole('button').filter({ hasText: 'Minus' }).click();

      // Should show quantity 1
      await expect(page.getByText('x 1')).toBeVisible();
    });

    test('should remove item when quantity reaches 0', async ({ page }) => {
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Add product
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      await assertions.assertCartItemCount(1);

      // Decrease quantity to 0
      const cartItem = page.locator('.border.rounded-lg').filter({ hasText: 'Mouse Logitech' });
      await cartItem.getByRole('button').filter({ hasText: 'Minus' }).click();

      // Cart should be empty
      await assertions.assertCartItemCount(0);
    });

    test('should remove item using trash button', async ({ page }) => {
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Add product
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      await assertions.assertCartItemCount(1);

      // Click trash button
      const cartItem = page.locator('.border.rounded-lg').filter({ hasText: 'Mouse Logitech' });
      await cartItem.getByRole('button').filter({ hasText: 'Trash' }).click();

      // Cart should be empty
      await assertions.assertCartItemCount(0);
    });

    test('should add multiple different products', async ({ page }) => {
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Add Laptop
      await actions.search('Buscar producto', 'Laptop');
      await page.getByText('Laptop HP').first().click();

      // Add Mouse
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      // Add Teclado
      await actions.search('Buscar producto', 'Teclado');
      await page.getByText('Teclado Mecánico').first().click();

      // Should have 3 items
      await assertions.assertCartItemCount(3);

      // Calculate total: (50000 + 5000 + 15000) + IVA 21%
      // Subtotal: 70000
      // IVA: 14700
      // Total: 84700
      await expect(page.getByText('$70.000,00').first()).toBeVisible();
      await expect(page.getByText('$14.700,00')).toBeVisible();
      await expect(page.getByText('$84.700,00')).toBeVisible();
    });

    test('should clear entire cart', async ({ page }) => {
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Add multiple products
      await actions.search('Buscar producto', 'Laptop');
      await page.getByText('Laptop HP').first().click();
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      await assertions.assertCartItemCount(2);

      // Click clear cart button
      await actions.clickButton('Limpiar Carrito');

      // Cart should be empty
      await assertions.assertCartItemCount(0);
    });

    test('should not add product with zero stock', async ({ page }) => {
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Try to add out of stock product
      await actions.search('Buscar producto', 'Monitor');
      await page.getByText('Monitor LG').first().click();

      // Should show error toast
      await actions.waitForToast('Sin stock');

      // Cart should remain empty
      await assertions.assertCartItemCount(0);
    });

    test('should not exceed available stock', async ({ page }) => {
      const actions = new PageActions(page);

      // Add Mouse (stock: 20)
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      // Try to increase quantity to 21
      const cartItem = page.locator('.border.rounded-lg').filter({ hasText: 'Mouse Logitech' });
      const plusButton = cartItem.getByRole('button').filter({ hasText: 'Plus' });

      // Click plus button 20 times
      for (let i = 0; i < 20; i++) {
        await plusButton.click();
      }

      // Should show stock limit error
      await actions.waitForToast('Stock insuficiente');

      // Quantity should be 20
      await expect(page.getByText('x 20')).toBeVisible();
    });
  });

  test.describe('Payment Processing', () => {
    test('should open payment dialog when clicking "Procesar Pago"', async ({ page }) => {
      const actions = new PageActions(page);

      // Add product to cart
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      // Click payment button
      await actions.clickButton('Procesar Pago');

      // Payment dialog should open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Procesar Pago')).toBeVisible();
    });

    test('should disable payment button when cart is empty', async ({ page }) => {
      // Payment button should be disabled
      const paymentButton = page.getByRole('button', { name: 'Procesar Pago' });
      await expect(paymentButton).toBeDisabled();
    });

    test('should process cash payment successfully', async ({ page }) => {
      const actions = new PageActions(page);

      // Add product
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      // Open payment dialog
      await actions.clickButton('Procesar Pago');

      // Select cash payment method
      await page.getByLabel('Método de pago').click();
      await page.getByRole('option', { name: 'Efectivo' }).click();

      // Enter amount
      await actions.fillField('Monto recibido', '10000');

      // Process payment
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar Pago' }).click();

      // Should show success message (allow 10s for transaction to complete)
      await actions.waitForToast('Venta completada', 10000);

      // Cart should be cleared
      const assertions = new Assertions(page);
      await assertions.assertCartItemCount(0);
    });

    test('should process credit card payment', async ({ page }) => {
      const actions = new PageActions(page);

      // Add product
      await actions.search('Buscar producto', 'Laptop');
      await page.getByText('Laptop HP').first().click();

      // Open payment dialog
      await actions.clickButton('Procesar Pago');

      // Select credit card
      await page.getByLabel('Método de pago').click();
      await page.getByRole('option', { name: 'Tarjeta de Crédito' }).click();

      // Enter card details
      await actions.fillField('Últimos 4 dígitos', '1234');

      // Process payment
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar Pago' }).click();

      // Should show success message (allow 10s for transaction to complete)
      await actions.waitForToast('Venta completada', 10000);
    });

    test('should process debit card payment', async ({ page }) => {
      const actions = new PageActions(page);

      // Add product
      await actions.search('Buscar producto', 'Teclado');
      await page.getByText('Teclado Mecánico').first().click();

      // Open payment dialog
      await actions.clickButton('Procesar Pago');

      // Select debit card
      await page.getByLabel('Método de pago').click();
      await page.getByRole('option', { name: 'Tarjeta de Débito' }).click();

      // Enter card details
      await actions.fillField('Últimos 4 dígitos', '5678');

      // Process payment
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar Pago' }).click();

      // Should show success message (allow 10s for transaction to complete)
      await actions.waitForToast('Venta completada', 10000);
    });

    test('should process bank transfer payment', async ({ page }) => {
      const actions = new PageActions(page);

      // Add product
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      // Open payment dialog
      await actions.clickButton('Procesar Pago');

      // Select bank transfer
      await page.getByLabel('Método de pago').click();
      await page.getByRole('option', { name: 'Transferencia' }).click();

      // Enter reference
      await actions.fillField('Referencia', 'TRF-123456');

      // Process payment
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar Pago' }).click();

      // Should show success message (allow 10s for transaction to complete)
      await actions.waitForToast('Venta completada', 10000);
    });

    test('should calculate change correctly for cash payment', async ({ page }) => {
      const actions = new PageActions(page);

      // Add product (Mouse: 5000 + IVA = 6050)
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      // Open payment dialog
      await actions.clickButton('Procesar Pago');

      // Select cash and enter amount
      await page.getByLabel('Método de pago').click();
      await page.getByRole('option', { name: 'Efectivo' }).click();
      await actions.fillField('Monto recibido', '10000');

      // Should show change
      // Change = 10000 - 6050 = 3950
      await expect(page.getByText('Cambio: $3.950,00')).toBeVisible();
    });

    test('should show error when cash amount is insufficient', async ({ page }) => {
      const actions = new PageActions(page);

      // Add product (Mouse: 5000 + IVA = 6050)
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      // Open payment dialog
      await actions.clickButton('Procesar Pago');

      // Select cash and enter insufficient amount
      await page.getByLabel('Método de pago').click();
      await page.getByRole('option', { name: 'Efectivo' }).click();
      await actions.fillField('Monto recibido', '5000');

      // Try to process payment
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar Pago' }).click();

      // Should show error
      await expect(page.getByText(/monto insuficiente|insufficient amount/i)).toBeVisible();
    });

    test('should update stock after successful sale', async ({ page }) => {
      const actions = new PageActions(page);

      // Add Mouse (initial stock: 20)
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      // Increase quantity to 5
      const cartItem = page.locator('.border.rounded-lg').filter({ hasText: 'Mouse Logitech' });
      const plusButton = cartItem.getByRole('button').filter({ hasText: 'Plus' });
      for (let i = 0; i < 4; i++) {
        await plusButton.click();
      }

      // Process payment
      await actions.clickButton('Procesar Pago');
      await page.getByLabel('Método de pago').click();
      await page.getByRole('option', { name: 'Efectivo' }).click();
      await actions.fillField('Monto recibido', '50000');
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar Pago' }).click();
      await actions.waitForToast('Venta completada');

      // Check stock in products page
      await page.goto('/dashboard/products');
      await actions.search('Buscar por nombre, SKU o código de barras', 'Mouse');
      await actions.clickButton('Buscar');

      // Stock should be 20 - 5 = 15
      await expect(page.getByRole('row').filter({ hasText: 'Mouse Logitech' }).getByText('15')).toBeVisible();
    });

    test('should cancel payment and return to cart', async ({ page }) => {
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Add product
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();

      // Open payment dialog
      await actions.clickButton('Procesar Pago');

      // Cancel payment
      await page.getByRole('dialog').getByRole('button', { name: /cancelar|close/i }).click();

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible();

      // Cart should still have items
      await assertions.assertCartItemCount(1);
    });
  });

  test.describe('Sales History', () => {
    test('should show completed sale in sales page', async ({ page }) => {
      const actions = new PageActions(page);

      // Complete a sale
      await page.goto('/dashboard/pos');
      await actions.search('Buscar producto', 'Mouse');
      await page.getByText('Mouse Logitech').first().click();
      await actions.clickButton('Procesar Pago');
      await page.getByLabel('Método de pago').click();
      await page.getByRole('option', { name: 'Efectivo' }).click();
      await actions.fillField('Monto recibido', '10000');
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar Pago' }).click();
      await actions.waitForToast('Venta completada');

      // Go to sales page
      await page.goto('/dashboard/sales');

      // Should show the sale
      await expect(page.getByText('Mouse Logitech').first()).toBeVisible();
      await expect(page.getByText('Efectivo').first()).toBeVisible();
    });
  });
});
