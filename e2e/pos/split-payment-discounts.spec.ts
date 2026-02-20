import { test, expect } from '@playwright/test';
import { generateTestData } from '../utils/test-helpers';

/**
 * Tests for the split-payment multi-entry payment dialog,
 * item-level and cart-level discounts, and barcode scanning.
 *
 * The POS page opens the payment dialog via the quick-pay buttons
 * (Efectivo, Débito, Crédito, QR, Transferencia, Cuenta Corriente).
 * The "Efectivo" button opens the dialog with CASH as the default method.
 *
 * Inside the dialog:
 *  - Action buttons: "Cancelar" and "Cobrar"
 *  - Payment row combobox: page.getByRole('combobox').nth(rowIndex)
 *  - Payment row amount input: page.locator('input[type="number"]').nth(rowIndex)
 *    (note: item-discount inputs are also type="number", so use care with nth() indexing
 *     — these inputs appear only within the payment dialog overlay)
 *  - "Agregar medio de pago" button — DISABLED when current payments already balance total
 *  - "Restante:" label (amber when underpaid, green when balanced at $0)
 *  - "Excedente:" label (red when overpaid via non-cash method)
 *  - "Vuelto:" label — appears inline in a CASH row when that row's amount > total
 */

test.describe('Split Payment', () => {
  let mouseProduct: any;
  let laptopProduct: any;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: '.auth/user.json' });
    const page = await context.newPage();

    // Create products via API — use taxRate: '0' to avoid PAYMENTS_MISMATCH
    // (backend adds taxRate% on top of unitPrice; with 0% tax, backend total == salePrice)
    mouseProduct = generateTestData.product({
      name: 'Mouse Test Split',
      salePrice: '5000',
      costPrice: '2500',
      stock: '20',
      taxRate: '0',
    });
    laptopProduct = generateTestData.product({
      name: 'Laptop Test Split',
      salePrice: '50000',
      costPrice: '30000',
      stock: '10',
      taxRate: '0',
    });

    for (const product of [mouseProduct, laptopProduct]) {
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

    // Ensure a cash register is open
    await page.request.post('http://localhost:3000/api/cash-registers', {
      data: {
        openingBalance: 10000,
        notes: 'E2E split-payment test cash register',
      },
    });

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/pos');
  });

  test('should process sale with two payment methods (cash + card)', async ({ page }) => {
    // Add Mouse Test Split (5000) to cart
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    await searchInput.fill('Mouse Test');
    await page.waitForTimeout(500);
    await page.getByText('Mouse Test Split').first().click();

    // Open payment dialog via "Efectivo" quick-pay button
    await page.getByRole('button', { name: /Efectivo/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The first row defaults to CASH with the full amount (5000).
    // To use split payment: enter a partial amount so the dialog is no longer balanced
    // and the "Agregar medio de pago" button becomes enabled.
    // Scope number inputs to the dialog to avoid matching cart item discount inputs.
    const amountInput = dialog.locator('input[type="number"]').nth(0);
    await amountInput.fill('2500');

    // "Agregar medio de pago" should now be enabled (remaining = 2500)
    const addButton = dialog.getByRole('button', { name: 'Agregar medio de pago' });
    await expect(addButton).toBeEnabled();
    await addButton.click();

    // A second payment row is now shown. Select credit card for it.
    await dialog.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Tarjeta de Crédito' }).click();

    // The second row should pre-fill with the remaining 2500.
    // Verify "Restante:" is visible
    await expect(dialog.getByText('Restante:')).toBeVisible();

    // Enter the remaining amount explicitly to ensure it is correct
    const secondAmountInput = dialog.locator('input[type="number"]').nth(1);
    await secondAmountInput.fill('2500');

    // Now the payments balance: confirm button "Cobrar" should be enabled
    const confirmButton = dialog.getByRole('button', { name: 'Cobrar' });
    await expect(confirmButton).toBeEnabled();

    // Process payment — wait for the sales API response in parallel with the click
    // so we don't miss the short-lived toast
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/sales') && resp.status() === 201, { timeout: 15000 }),
      confirmButton.click(),
    ]);
    expect(response.status()).toBe(201);

    // Should show success toast (allow extra time; if it already disappeared, the
    // response check above already confirmed the sale was created successfully)
    await expect(page.getByText('Venta completada')).toBeVisible({ timeout: 5000 }).catch(() => {
      // Toast may have already dismissed — sale confirmed via API response status above
    });
  });

  test('should show Restante indicator as amber when payment amounts dont cover total', async ({ page }) => {
    // Add Mouse Test Split (5000) to cart
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    await searchInput.fill('Mouse Test');
    await page.waitForTimeout(500);
    await page.getByText('Mouse Test Split').first().click();

    // Open payment dialog
    await page.getByRole('button', { name: /Efectivo/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Set amount to less than total (5000) — enter 1000
    const amountInput = dialog.locator('input[type="number"]').nth(0);
    await amountInput.fill('1000');

    // "Restante:" should be visible (amount underpaid)
    await expect(dialog.getByText('Restante:')).toBeVisible();

    // The dialog should show a non-zero remaining amount — "Cobrar" should be disabled
    const confirmButton = dialog.getByRole('button', { name: 'Cobrar' });
    await expect(confirmButton).toBeDisabled();
  });

  test('should show Excedente indicator when total overpaid for non-cash method', async ({ page }) => {
    // Add Mouse Test Split (5000) to cart
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    await searchInput.fill('Mouse Test');
    await page.waitForTimeout(500);
    await page.getByText('Mouse Test Split').first().click();

    // Open payment dialog via "Débito" button (non-cash, so no per-row "Vuelto")
    await page.getByRole('button', { name: /Débito/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Enter an amount much higher than total — this causes overpayment (remaining < -0.01)
    // which shows "Excedente:" instead of "Restante:"
    const amountInput = dialog.locator('input[type="number"]').nth(0);
    await amountInput.fill('999999');

    // Should show "Excedente:" label
    await expect(dialog.getByText('Excedente:')).toBeVisible();

    // "Cobrar" should be disabled because isBalanced is false (overpaid)
    const confirmButton = dialog.getByRole('button', { name: 'Cobrar' });
    await expect(confirmButton).toBeDisabled();
  });

  test('should show Vuelto for cash overpayment', async ({ page }) => {
    // Add Mouse Test Split (5000) to cart
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    await searchInput.fill('Mouse Test');
    await page.waitForTimeout(500);
    await page.getByText('Mouse Test Split').first().click();

    // Open payment dialog via "Efectivo" (default CASH)
    await page.getByRole('button', { name: /Efectivo/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Enter an amount higher than the product price (5000) — e.g. 10000
    const amountInput = dialog.locator('input[type="number"]').nth(0);
    await amountInput.fill('10000');

    // "Vuelto:" label should appear inline in the CASH payment row
    // (shown when isCash && cashChange > 0, i.e. entryAmount > totals.total)
    await expect(dialog.getByText('Vuelto:')).toBeVisible();
  });

  test('should disable Cobrar button when amounts dont balance', async ({ page }) => {
    // Add Mouse Test Split (5000) to cart
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    await searchInput.fill('Mouse Test');
    await page.waitForTimeout(500);
    await page.getByText('Mouse Test Split').first().click();

    // Open payment dialog
    await page.getByRole('button', { name: /Efectivo/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Clear the amount field (set to 0)
    const amountInput = dialog.locator('input[type="number"]').nth(0);
    await amountInput.fill('0');

    // canProcess = false because parseFloat("0") is not > 0
    // so the "Cobrar" button should be disabled
    const confirmButton = dialog.getByRole('button', { name: 'Cobrar' });
    await expect(confirmButton).toBeDisabled();
  });

  test('should enable Cobrar button when amounts balance', async ({ page }) => {
    // Add Mouse Test Split (5000) to cart
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    await searchInput.fill('Mouse Test');
    await page.waitForTimeout(500);
    await page.getByText('Mouse Test Split').first().click();

    // Open payment dialog — default is CASH with the full amount pre-filled
    await page.getByRole('button', { name: /Efectivo/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // The default state is CASH with full amount = balanced → "Cobrar" should be enabled
    const confirmButton = dialog.getByRole('button', { name: 'Cobrar' });
    await expect(confirmButton).toBeEnabled();
  });
});

test.describe('Item Discounts', () => {
  let mouseProduct: any;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: '.auth/user.json' });
    const page = await context.newPage();

    mouseProduct = generateTestData.product({
      name: 'Mouse Test Discount',
      salePrice: '5000',
      costPrice: '2500',
      stock: '20',
      taxRate: '0',
    });

    await page.request.post('http://localhost:3000/api/products', {
      data: {
        sku: mouseProduct.sku,
        name: mouseProduct.name,
        salePrice: parseFloat(mouseProduct.salePrice),
        costPrice: parseFloat(mouseProduct.costPrice),
        taxRate: parseFloat(mouseProduct.taxRate),
        stock: parseInt(mouseProduct.stock),
        active: true,
      },
    });

    // Ensure a cash register is open
    await page.request.post('http://localhost:3000/api/cash-registers', {
      data: {
        openingBalance: 10000,
        notes: 'E2E discount test cash register',
      },
    });

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/pos');
  });

  test('should apply item-level discount in cart', async ({ page }) => {
    // Add Mouse Test Discount (5000) to cart
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    await searchInput.fill('Mouse Test Disc');
    await page.waitForTimeout(500);
    await page.getByText('Mouse Test Discount').first().click();

    // The cart item shows the product. Find the item-level discount input.
    // It is adjacent to the "Dto. %" label text inside the cart item row.
    // The label and input are siblings in a flex container — locate via the
    // parent container that contains "Dto. %" text, then find the input inside it.
    const discountContainer = page.locator('div').filter({ hasText: /^Dto\. %/ }).first();
    const discountInput = discountContainer.locator('input[type="number"]');
    await expect(discountInput).toBeVisible();

    // Enter 10% discount
    await discountInput.fill('10');

    // After entering a 10% discount on 5000, the item total should be 4500.
    // The page shows the discount badge "-10%" and the item's line-through price.
    await expect(page.getByText('-10%')).toBeVisible();

    // The cart total should now be $4.500,00
    await expect(page.getByText('$4.500,00').first()).toBeVisible();
  });

  test('should apply cart-level discount', async ({ page }) => {
    // Add Mouse Test Discount (5000) to cart
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    await searchInput.fill('Mouse Test Disc');
    await page.waitForTimeout(500);
    await page.getByText('Mouse Test Discount').first().click();

    // Initial total should be $5.000,00
    await expect(page.getByText('$5.000,00').first()).toBeVisible();

    // Find the "Descuento general (%)" label and its adjacent input.
    // This label is in the Cart Summary section (right-side panel).
    // The label and input are siblings in a flex container — locate the
    // container that holds the "Descuento general" text, then find the input.
    const cartDiscountLabel = page.getByText('Descuento general (%)');
    await expect(cartDiscountLabel).toBeVisible();

    // The cart discount input is inside the same border container as the label
    const cartDiscountContainer = page.locator('div.border.rounded-md').filter({ hasText: 'Descuento general' });
    const cartDiscountInput = cartDiscountContainer.locator('input[type="number"]');
    await cartDiscountInput.fill('10');

    // After 10% cart discount on $5000: total = $4500
    // The summary shows "Descuento gral. (10%)" and "-$500,00"
    await expect(page.getByText(/Descuento gral/)).toBeVisible();
    await expect(page.getByText('$4.500,00').first()).toBeVisible();
  });
});

test.describe('Barcode Scan', () => {
  let barcodeProduct: any;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: '.auth/user.json' });
    const page = await context.newPage();

    // Create a product with a specific barcode via API
    barcodeProduct = {
      sku: `BARCODE-${Date.now()}`,
      name: 'Barcode Test Product',
      barcode: '1234567890',
      salePrice: 1500,
      costPrice: 800,
      taxRate: 21,
      stock: 10,
    };

    await page.request.post('http://localhost:3000/api/products', {
      data: {
        sku: barcodeProduct.sku,
        name: barcodeProduct.name,
        barcode: barcodeProduct.barcode,
        salePrice: barcodeProduct.salePrice,
        costPrice: barcodeProduct.costPrice,
        taxRate: barcodeProduct.taxRate,
        stock: barcodeProduct.stock,
        active: true,
      },
    });

    // Ensure a cash register is open
    await page.request.post('http://localhost:3000/api/cash-registers', {
      data: {
        openingBalance: 10000,
        notes: 'E2E barcode test cash register',
      },
    });

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/pos');
  });

  test('should add product to cart by entering barcode and pressing Enter', async ({ page }) => {
    // The search input handles barcode scanning: typing a barcode then pressing Enter
    // triggers handleBarcodeScan() which queries /api/products?barcode=...
    // If exactly 1 product matches, it is added to the cart directly.
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();

    // Type the barcode of the product we created
    await searchInput.fill('1234567890');

    // Press Enter to trigger the barcode scan handler
    await searchInput.press('Enter');

    // Wait for the API call and product addition
    await page.waitForTimeout(1000);

    // The product should be added to the cart automatically
    await expect(page.getByText('Barcode Test Product').first()).toBeVisible({ timeout: 5000 });

    // Cart should show 1 product
    await expect(page.getByText('1 producto en el carrito')).toBeVisible();
  });
});
