import { test, expect } from '@playwright/test';
import { generateTestData, PageActions, Assertions } from '../utils/test-helpers';

test.describe('Product Management', () => {
  test.describe('Create Product', () => {
    test('should successfully create a product with valid data', async ({ page }) => {
      const productData = generateTestData.product();
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      await page.goto('/dashboard/products');
      await actions.clickButton('Nuevo Producto');

      // Fill product form
      await actions.fillField('SKU', productData.sku);
      await actions.fillField('Nombre', productData.name);
      await actions.fillField('Precio de venta', productData.salePrice);
      await actions.fillField('Precio de costo', productData.costPrice);
      await actions.fillField('Tasa de impuesto', productData.taxRate);
      await actions.fillField('Stock inicial', productData.stock);

      // Submit form
      await actions.clickButton('Guardar Producto');

      // Should show success message
      await actions.waitForToast('Producto creado exitosamente');

      // Should redirect to products list
      await actions.waitForNavigation('/dashboard/products');

      // Product should appear in list
      await assertions.assertProductInList(productData.name);
    });

    test('should create product with barcode', async ({ page }) => {
      const productData = generateTestData.product({
        barcode: `BAR${Date.now()}`,
      });
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      await page.goto('/dashboard/products/new');

      await actions.fillField('SKU', productData.sku);
      await actions.fillField('Nombre', productData.name);
      await actions.fillField('Código de barras', productData.barcode!);
      await actions.fillField('Precio de venta', productData.salePrice);
      await actions.fillField('Precio de costo', productData.costPrice);
      await actions.fillField('Tasa de impuesto', productData.taxRate);
      await actions.fillField('Stock inicial', productData.stock);

      await actions.clickButton('Guardar Producto');
      await actions.waitForToast('Producto creado exitosamente');

      // Verify product with barcode is in list
      await assertions.assertProductInList(productData.name);
    });

    test('should show error with duplicate SKU', async ({ page }) => {
      const productData = generateTestData.product();
      const actions = new PageActions(page);

      // Create first product
      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', productData.sku);
      await actions.fillField('Nombre', productData.name);
      await actions.fillField('Precio de venta', productData.salePrice);
      await actions.fillField('Precio de costo', productData.costPrice);
      await actions.fillField('Tasa de impuesto', productData.taxRate);
      await actions.fillField('Stock inicial', productData.stock);
      await actions.clickButton('Guardar Producto');
      await actions.waitForToast('Producto creado exitosamente');

      // Try to create second product with same SKU
      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', productData.sku); // Same SKU
      await actions.fillField('Nombre', 'Different Product');
      await actions.fillField('Precio de venta', '2000');
      await actions.fillField('Precio de costo', '1000');
      await actions.fillField('Tasa de impuesto', '21');
      await actions.fillField('Stock inicial', '5');
      await actions.clickButton('Guardar Producto');

      // Should show error
      await expect(page.getByText(/SKU ya existe|SKU already exists/i)).toBeVisible();
    });

    test('should show validation error with empty required fields', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/dashboard/products/new');
      await actions.clickButton('Guardar Producto');

      // Should show validation errors
      await expect(page.getByText(/campo requerido|required field/i).first()).toBeVisible();
    });

    test('should show validation error with invalid price (negative)', async ({ page }) => {
      const productData = generateTestData.product({
        salePrice: '-100',
      });
      const actions = new PageActions(page);

      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', productData.sku);
      await actions.fillField('Nombre', productData.name);
      await actions.fillField('Precio de venta', productData.salePrice);
      await actions.fillField('Precio de costo', productData.costPrice);
      await actions.fillField('Tasa de impuesto', productData.taxRate);
      await actions.fillField('Stock inicial', productData.stock);
      await actions.clickButton('Guardar Producto');

      // Should show error
      await expect(page.getByText(/precio.*positivo|price.*positive/i)).toBeVisible();
    });

    test('should show validation error with invalid tax rate', async ({ page }) => {
      const productData = generateTestData.product({
        taxRate: '150', // Invalid: > 100
      });
      const actions = new PageActions(page);

      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', productData.sku);
      await actions.fillField('Nombre', productData.name);
      await actions.fillField('Precio de venta', productData.salePrice);
      await actions.fillField('Precio de costo', productData.costPrice);
      await actions.fillField('Tasa de impuesto', productData.taxRate);
      await actions.fillField('Stock inicial', productData.stock);
      await actions.clickButton('Guardar Producto');

      // Should show error
      await expect(page.getByText(/tasa.*impuesto.*válida|tax rate.*valid/i)).toBeVisible();
    });

    test('should handle decimal prices correctly', async ({ page }) => {
      const productData = generateTestData.product({
        salePrice: '1234.56',
        costPrice: '789.12',
      });
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', productData.sku);
      await actions.fillField('Nombre', productData.name);
      await actions.fillField('Precio de venta', productData.salePrice);
      await actions.fillField('Precio de costo', productData.costPrice);
      await actions.fillField('Tasa de impuesto', productData.taxRate);
      await actions.fillField('Stock inicial', productData.stock);
      await actions.clickButton('Guardar Producto');

      await actions.waitForToast('Producto creado exitosamente');
      await assertions.assertProductInList(productData.name);

      // Verify prices are displayed correctly with proper formatting
      await expect(page.getByText('$1.234,56')).toBeVisible();
    });
  });

  test.describe('Edit Product', () => {
    test('should successfully edit a product', async ({ page }) => {
      const productData = generateTestData.product();
      const actions = new PageActions(page);

      // Create product first
      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', productData.sku);
      await actions.fillField('Nombre', productData.name);
      await actions.fillField('Precio de venta', productData.salePrice);
      await actions.fillField('Precio de costo', productData.costPrice);
      await actions.fillField('Tasa de impuesto', productData.taxRate);
      await actions.fillField('Stock inicial', productData.stock);
      await actions.clickButton('Guardar Producto');
      await actions.waitForToast('Producto creado exitosamente');

      // Find and edit the product
      await page.goto('/dashboard/products');
      const row = page.getByRole('row').filter({ hasText: productData.name });
      await row.getByRole('button', { name: /edit|editar/i }).click();

      // Update product name and price
      const newName = `${productData.name} - EDITED`;
      const newPrice = '2500.00';

      await page.getByLabel('Nombre').fill(newName);
      await page.getByLabel('Precio de venta').fill(newPrice);
      await actions.clickButton('Guardar Producto');

      await actions.waitForToast('Producto actualizado exitosamente');

      // Verify updated product in list
      await expect(page.getByText(newName)).toBeVisible();
      await expect(page.getByText('$2.500')).toBeVisible();
    });

    test('should not allow editing SKU to duplicate existing SKU', async ({ page }) => {
      const product1 = generateTestData.product();
      const product2 = generateTestData.product();
      const actions = new PageActions(page);

      // Create two products
      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', product1.sku);
      await actions.fillField('Nombre', product1.name);
      await actions.fillField('Precio de venta', product1.salePrice);
      await actions.fillField('Precio de costo', product1.costPrice);
      await actions.fillField('Tasa de impuesto', product1.taxRate);
      await actions.fillField('Stock inicial', product1.stock);
      await actions.clickButton('Guardar Producto');
      await actions.waitForToast('Producto creado exitosamente');

      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', product2.sku);
      await actions.fillField('Nombre', product2.name);
      await actions.fillField('Precio de venta', product2.salePrice);
      await actions.fillField('Precio de costo', product2.costPrice);
      await actions.fillField('Tasa de impuesto', product2.taxRate);
      await actions.fillField('Stock inicial', product2.stock);
      await actions.clickButton('Guardar Producto');
      await actions.waitForToast('Producto creado exitosamente');

      // Try to edit product2 SKU to match product1
      await page.goto('/dashboard/products');
      const row = page.getByRole('row').filter({ hasText: product2.name });
      await row.getByRole('button', { name: /edit|editar/i }).click();

      await page.getByLabel('SKU').fill(product1.sku); // Try to use existing SKU
      await actions.clickButton('Guardar Producto');

      // Should show error
      await expect(page.getByText(/SKU ya existe|SKU already exists/i)).toBeVisible();
    });

    test('should toggle product active status', async ({ page }) => {
      const productData = generateTestData.product();
      const actions = new PageActions(page);

      // Create product
      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', productData.sku);
      await actions.fillField('Nombre', productData.name);
      await actions.fillField('Precio de venta', productData.salePrice);
      await actions.fillField('Precio de costo', productData.costPrice);
      await actions.fillField('Tasa de impuesto', productData.taxRate);
      await actions.fillField('Stock inicial', productData.stock);
      await actions.clickButton('Guardar Producto');
      await actions.waitForToast('Producto creado exitosamente');

      // Edit to set inactive
      await page.goto('/dashboard/products');
      const row = page.getByRole('row').filter({ hasText: productData.name });
      await row.getByRole('button', { name: /edit|editar/i }).click();

      // Toggle active status
      await page.getByLabel('Activo').uncheck();
      await actions.clickButton('Guardar Producto');
      await actions.waitForToast('Producto actualizado exitosamente');

      // Verify status badge shows Inactivo
      await expect(page.getByRole('row').filter({ hasText: productData.name }).getByText('Inactivo')).toBeVisible();
    });
  });

  test.describe('Delete Product', () => {
    test('should successfully delete a product', async ({ page }) => {
      const productData = generateTestData.product();
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Create product
      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', productData.sku);
      await actions.fillField('Nombre', productData.name);
      await actions.fillField('Precio de venta', productData.salePrice);
      await actions.fillField('Precio de costo', productData.costPrice);
      await actions.fillField('Tasa de impuesto', productData.taxRate);
      await actions.fillField('Stock inicial', productData.stock);
      await actions.clickButton('Guardar Producto');
      await actions.waitForToast('Producto creado exitosamente');

      // Delete the product
      await page.goto('/dashboard/products');
      const row = page.getByRole('row').filter({ hasText: productData.name });
      await row.getByRole('button', { name: /delete|trash/i }).click();

      // Confirm deletion
      page.on('dialog', dialog => dialog.accept());

      await actions.waitForToast('Producto eliminado');

      // Product should not appear in list
      await assertions.assertProductNotInList(productData.name);
    });
  });

  test.describe('Product Search', () => {
    test('should search products by name', async ({ page }) => {
      const product1 = generateTestData.product({ name: 'Laptop Dell XPS' });
      const product2 = generateTestData.product({ name: 'Mouse Logitech' });
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Create two products
      for (const product of [product1, product2]) {
        await page.goto('/dashboard/products/new');
        await actions.fillField('SKU', product.sku);
        await actions.fillField('Nombre', product.name);
        await actions.fillField('Precio de venta', product.salePrice);
        await actions.fillField('Precio de costo', product.costPrice);
        await actions.fillField('Tasa de impuesto', product.taxRate);
        await actions.fillField('Stock inicial', product.stock);
        await actions.clickButton('Guardar Producto');
        await actions.waitForToast('Producto creado exitosamente');
      }

      // Search for "Laptop"
      await page.goto('/dashboard/products');
      await actions.search('Buscar por nombre, SKU o código de barras', 'Laptop');
      await actions.clickButton('Buscar');

      // Should show only Laptop
      await assertions.assertProductInList(product1.name);
      await assertions.assertProductNotInList(product2.name);
    });

    test('should search products by SKU', async ({ page }) => {
      const product1 = generateTestData.product({ sku: 'LAPTOP-123' });
      const product2 = generateTestData.product({ sku: 'MOUSE-456' });
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Create two products
      for (const product of [product1, product2]) {
        await page.goto('/dashboard/products/new');
        await actions.fillField('SKU', product.sku);
        await actions.fillField('Nombre', product.name);
        await actions.fillField('Precio de venta', product.salePrice);
        await actions.fillField('Precio de costo', product.costPrice);
        await actions.fillField('Tasa de impuesto', product.taxRate);
        await actions.fillField('Stock inicial', product.stock);
        await actions.clickButton('Guardar Producto');
        await actions.waitForToast('Producto creado exitosamente');
      }

      // Search by SKU
      await page.goto('/dashboard/products');
      await actions.search('Buscar por nombre, SKU o código de barras', 'LAPTOP-123');
      await actions.clickButton('Buscar');

      // Should show only product with that SKU
      await assertions.assertProductInList(product1.name);
      await assertions.assertProductNotInList(product2.name);
    });

    test('should search products by barcode', async ({ page }) => {
      const product = generateTestData.product({
        name: 'Product with Barcode',
        barcode: '123456789012',
      });
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // Create product with barcode
      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', product.sku);
      await actions.fillField('Nombre', product.name);
      await actions.fillField('Código de barras', product.barcode!);
      await actions.fillField('Precio de venta', product.salePrice);
      await actions.fillField('Precio de costo', product.costPrice);
      await actions.fillField('Tasa de impuesto', product.taxRate);
      await actions.fillField('Stock inicial', product.stock);
      await actions.clickButton('Guardar Producto');
      await actions.waitForToast('Producto creado exitosamente');

      // Search by barcode
      await page.goto('/dashboard/products');
      await actions.search('Buscar por nombre, SKU o código de barras', product.barcode!);
      await actions.clickButton('Buscar');

      // Should find the product
      await assertions.assertProductInList(product.name);
    });

    test('should show empty state when no products match search', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/dashboard/products');
      await actions.search('Buscar por nombre, SKU o código de barras', 'NONEXISTENT_PRODUCT_XYZ');
      await actions.clickButton('Buscar');

      // Should show empty state or no results message
      await expect(page.getByText(/no hay productos|no products found/i)).toBeVisible();
    });
  });

  test.describe('Product List Display', () => {
    test('should display product with correct stock badge', async ({ page }) => {
      const productWithStock = generateTestData.product({ stock: '10' });
      const productNoStock = generateTestData.product({ stock: '0' });
      const actions = new PageActions(page);

      // Create product with stock
      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', productWithStock.sku);
      await actions.fillField('Nombre', productWithStock.name);
      await actions.fillField('Precio de venta', productWithStock.salePrice);
      await actions.fillField('Precio de costo', productWithStock.costPrice);
      await actions.fillField('Tasa de impuesto', productWithStock.taxRate);
      await actions.fillField('Stock inicial', productWithStock.stock);
      await actions.clickButton('Guardar Producto');
      await actions.waitForToast('Producto creado exitosamente');

      // Create product without stock
      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', productNoStock.sku);
      await actions.fillField('Nombre', productNoStock.name);
      await actions.fillField('Precio de venta', productNoStock.salePrice);
      await actions.fillField('Precio de costo', productNoStock.costPrice);
      await actions.fillField('Tasa de impuesto', productNoStock.taxRate);
      await actions.fillField('Stock inicial', productNoStock.stock);
      await actions.clickButton('Guardar Producto');
      await actions.waitForToast('Producto creado exitosamente');

      // Verify stock display
      await page.goto('/dashboard/products');

      const rowWithStock = page.getByRole('row').filter({ hasText: productWithStock.name });
      await expect(rowWithStock.getByText('10')).toBeVisible();

      const rowNoStock = page.getByRole('row').filter({ hasText: productNoStock.name });
      await expect(rowNoStock.getByText('0')).toBeVisible();
    });

    test('should display product status correctly', async ({ page }) => {
      const productData = generateTestData.product();
      const actions = new PageActions(page);

      // Create active product (default)
      await page.goto('/dashboard/products/new');
      await actions.fillField('SKU', productData.sku);
      await actions.fillField('Nombre', productData.name);
      await actions.fillField('Precio de venta', productData.salePrice);
      await actions.fillField('Precio de costo', productData.costPrice);
      await actions.fillField('Tasa de impuesto', productData.taxRate);
      await actions.fillField('Stock inicial', productData.stock);
      await actions.clickButton('Guardar Producto');
      await actions.waitForToast('Producto creado exitosamente');

      // Check status badge
      await page.goto('/dashboard/products');
      const row = page.getByRole('row').filter({ hasText: productData.name });
      await expect(row.getByText('Activo')).toBeVisible();
    });
  });
});
