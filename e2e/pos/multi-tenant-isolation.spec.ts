import { test, expect } from '@playwright/test';
import { generateTestData, PageActions } from '../utils/test-helpers';

test.describe('Multi-Tenant Isolation', () => {
  test.describe('Product Isolation', () => {
    test('products from tenant A should not be visible to tenant B', async ({ browser }) => {
      const actions1 = { context: null as any, page: null as any };
      const actions2 = { context: null as any, page: null as any };

      try {
        // Create Tenant A
        const tenantA = {
          user: generateTestData.user(),
          tenant: generateTestData.tenant({ name: 'Tenant A Corp' }),
          product: generateTestData.product({ name: 'Product from Tenant A' }),
        };

        actions1.context = await browser.newContext();
        actions1.page = await actions1.context.newPage();
        const pageActions1 = new PageActions(actions1.page);

        // Register Tenant A
        await actions1.page.goto('/register');
        await pageActions1.fillField('Nombre del Comercio', tenantA.tenant.name);
        await pageActions1.fillField('CUIT del Comercio', tenantA.tenant.cuit);
        await pageActions1.fillField('Tu Nombre', tenantA.user.name);
        await pageActions1.fillField('Email', tenantA.user.email);
        await pageActions1.fillField('Contraseña', tenantA.user.password, true);
        await pageActions1.fillField('Confirmar Contraseña', tenantA.user.password, true);
        await pageActions1.clickButton('Registrarse');
        await pageActions1.waitForNavigation('/login');

        // Login as Tenant A
        await pageActions1.fillField('Email', tenantA.user.email);
        await pageActions1.fillField('Contraseña', tenantA.user.password, true);
        await pageActions1.clickButton('Iniciar Sesión');
        await pageActions1.waitForNavigation('/dashboard');

        // Create product as Tenant A
        await actions1.page.goto('/dashboard/products/new');
        await pageActions1.fillField('SKU', tenantA.product.sku);
        await pageActions1.fillField('Nombre', tenantA.product.name);
        await pageActions1.fillField('Precio de venta', tenantA.product.salePrice);
        await pageActions1.fillField('Precio de costo', tenantA.product.costPrice);
        await pageActions1.fillField('Tasa de impuesto', tenantA.product.taxRate);
        await pageActions1.fillField('Stock inicial', tenantA.product.stock);
        await pageActions1.clickButton('Guardar Producto');
        await pageActions1.waitForToast('Producto creado exitosamente');

        // Verify product is visible to Tenant A
        await actions1.page.goto('/dashboard/products');
        await expect(actions1.page.getByText(tenantA.product.name)).toBeVisible();

        // Create Tenant B
        const tenantB = {
          user: generateTestData.user(),
          tenant: generateTestData.tenant({ name: 'Tenant B Corp' }),
        };

        actions2.context = await browser.newContext();
        actions2.page = await actions2.context.newPage();
        const pageActions2 = new PageActions(actions2.page);

        // Register Tenant B
        await actions2.page.goto('/register');
        await pageActions2.fillField('Nombre del Comercio', tenantB.tenant.name);
        await pageActions2.fillField('CUIT del Comercio', tenantB.tenant.cuit);
        await pageActions2.fillField('Tu Nombre', tenantB.user.name);
        await pageActions2.fillField('Email', tenantB.user.email);
        await pageActions2.fillField('Contraseña', tenantB.user.password, true);
        await pageActions2.fillField('Confirmar Contraseña', tenantB.user.password, true);
        await pageActions2.clickButton('Registrarse');
        await pageActions2.waitForNavigation('/login');

        // Login as Tenant B
        await pageActions2.fillField('Email', tenantB.user.email);
        await pageActions2.fillField('Contraseña', tenantB.user.password, true);
        await pageActions2.clickButton('Iniciar Sesión');
        await pageActions2.waitForNavigation('/dashboard');

        // Verify Tenant A's product is NOT visible to Tenant B
        await actions2.page.goto('/dashboard/products');
        await expect(actions2.page.getByText(tenantA.product.name)).not.toBeVisible();

        // Search for Tenant A's product
        await pageActions2.search('Buscar por nombre, SKU o código de barras', tenantA.product.name);
        await pageActions2.clickButton('Buscar');

        // Should still not find it
        await expect(actions2.page.getByText(tenantA.product.name)).not.toBeVisible();
      } finally {
        // Cleanup
        if (actions1.context) await actions1.context.close();
        if (actions2.context) await actions2.context.close();
      }
    });

    test('tenant A can create product with same SKU as tenant B', async ({ browser }) => {
      const actions1 = { context: null as any, page: null as any };
      const actions2 = { context: null as any, page: null as any };

      try {
        const sharedSKU = `SHARED-${Date.now()}`;

        // Create Tenant A
        const tenantA = {
          user: generateTestData.user(),
          tenant: generateTestData.tenant(),
        };

        actions1.context = await browser.newContext();
        actions1.page = await actions1.context.newPage();
        const pageActions1 = new PageActions(actions1.page);

        // Register and create product with specific SKU
        await actions1.page.goto('/register');
        await pageActions1.fillField('Nombre del Comercio', tenantA.tenant.name);
        await pageActions1.fillField('CUIT del Comercio', tenantA.tenant.cuit);
        await pageActions1.fillField('Tu Nombre', tenantA.user.name);
        await pageActions1.fillField('Email', tenantA.user.email);
        await pageActions1.fillField('Contraseña', tenantA.user.password, true);
        await pageActions1.fillField('Confirmar Contraseña', tenantA.user.password, true);
        await pageActions1.clickButton('Registrarse');
        await pageActions1.waitForNavigation('/login');

        // Login as Tenant A
        await pageActions1.fillField('Email', tenantA.user.email);
        await pageActions1.fillField('Contraseña', tenantA.user.password, true);
        await pageActions1.clickButton('Iniciar Sesión');
        await pageActions1.waitForNavigation('/dashboard');

        await actions1.page.goto('/dashboard/products/new');
        await pageActions1.fillField('SKU', sharedSKU);
        await pageActions1.fillField('Nombre', 'Product A');
        await pageActions1.fillField('Precio de venta', '1000');
        await pageActions1.fillField('Precio de costo', '500');
        await pageActions1.fillField('Tasa de impuesto', '21');
        await pageActions1.fillField('Stock inicial', '10');
        await pageActions1.clickButton('Guardar Producto');
        await pageActions1.waitForToast('Producto creado exitosamente');

        // Create Tenant B
        const tenantB = {
          user: generateTestData.user(),
          tenant: generateTestData.tenant(),
        };

        actions2.context = await browser.newContext();
        actions2.page = await actions2.context.newPage();
        const pageActions2 = new PageActions(actions2.page);

        // Register and create product with SAME SKU
        await actions2.page.goto('/register');
        await pageActions2.fillField('Nombre del Comercio', tenantB.tenant.name);
        await pageActions2.fillField('CUIT del Comercio', tenantB.tenant.cuit);
        await pageActions2.fillField('Tu Nombre', tenantB.user.name);
        await pageActions2.fillField('Email', tenantB.user.email);
        await pageActions2.fillField('Contraseña', tenantB.user.password, true);
        await pageActions2.fillField('Confirmar Contraseña', tenantB.user.password, true);
        await pageActions2.clickButton('Registrarse');
        await pageActions2.waitForNavigation('/login');

        // Login as Tenant B
        await pageActions2.fillField('Email', tenantB.user.email);
        await pageActions2.fillField('Contraseña', tenantB.user.password, true);
        await pageActions2.clickButton('Iniciar Sesión');
        await pageActions2.waitForNavigation('/dashboard');

        await actions2.page.goto('/dashboard/products/new');
        await pageActions2.fillField('SKU', sharedSKU); // Same SKU
        await pageActions2.fillField('Nombre', 'Product B');
        await pageActions2.fillField('Precio de venta', '2000');
        await pageActions2.fillField('Precio de costo', '1000');
        await pageActions2.fillField('Tasa de impuesto', '21');
        await pageActions2.fillField('Stock inicial', '5');
        await pageActions2.clickButton('Guardar Producto');

        // Should succeed because SKU uniqueness is per tenant
        await pageActions2.waitForToast('Producto creado exitosamente');

        // Verify both products exist in their respective tenants
        await actions1.page.goto('/dashboard/products');
        await expect(actions1.page.getByText('Product A')).toBeVisible();
        await expect(actions1.page.getByText('Product B')).not.toBeVisible();

        await actions2.page.goto('/dashboard/products');
        await expect(actions2.page.getByText('Product B')).toBeVisible();
        await expect(actions2.page.getByText('Product A')).not.toBeVisible();
      } finally {
        if (actions1.context) await actions1.context.close();
        if (actions2.context) await actions2.context.close();
      }
    });
  });

  test.describe('Sales Isolation', () => {
    test('sales from tenant A should not be visible to tenant B', async ({ browser }) => {
      const actions1 = { context: null as any, page: null as any };
      const actions2 = { context: null as any, page: null as any };

      try {
        // Create Tenant A with a product and sale
        const tenantA = {
          user: generateTestData.user(),
          tenant: generateTestData.tenant(),
          product: generateTestData.product({ name: 'Tenant A Product' }),
        };

        actions1.context = await browser.newContext();
        actions1.page = await actions1.context.newPage();
        const pageActions1 = new PageActions(actions1.page);

        // Register Tenant A
        await actions1.page.goto('/register');
        await pageActions1.fillField('Nombre del Comercio', tenantA.tenant.name);
        await pageActions1.fillField('CUIT del Comercio', tenantA.tenant.cuit);
        await pageActions1.fillField('Tu Nombre', tenantA.user.name);
        await pageActions1.fillField('Email', tenantA.user.email);
        await pageActions1.fillField('Contraseña', tenantA.user.password, true);
        await pageActions1.fillField('Confirmar Contraseña', tenantA.user.password, true);
        await pageActions1.clickButton('Registrarse');
        await pageActions1.waitForNavigation('/login');

        // Login as Tenant A
        await pageActions1.fillField('Email', tenantA.user.email);
        await pageActions1.fillField('Contraseña', tenantA.user.password, true);
        await pageActions1.clickButton('Iniciar Sesión');
        await pageActions1.waitForNavigation('/dashboard');

        // Create product
        await actions1.page.goto('/dashboard/products/new');
        await pageActions1.fillField('SKU', tenantA.product.sku);
        await pageActions1.fillField('Nombre', tenantA.product.name);
        await pageActions1.fillField('Precio de venta', tenantA.product.salePrice);
        await pageActions1.fillField('Precio de costo', tenantA.product.costPrice);
        await pageActions1.fillField('Tasa de impuesto', tenantA.product.taxRate);
        await pageActions1.fillField('Stock inicial', tenantA.product.stock);
        await pageActions1.clickButton('Guardar Producto');
        await pageActions1.waitForToast('Producto creado exitosamente');

        // Make a sale
        await actions1.page.goto('/dashboard/pos');
        await pageActions1.search('Buscar producto', tenantA.product.name);
        await actions1.page.getByText(tenantA.product.name).click();
        await pageActions1.clickButton('Procesar Pago');
        await actions1.page.getByLabel('Método de pago').click();
        await actions1.page.getByRole('option', { name: 'Efectivo' }).click();
        await pageActions1.fillField('Monto recibido', '10000');
        await actions1.page.getByRole('dialog').getByRole('button', { name: 'Confirmar Pago' }).click();
        await pageActions1.waitForToast('Venta completada');

        // Verify sale is visible to Tenant A
        await actions1.page.goto('/dashboard/sales');
        await expect(actions1.page.getByText(tenantA.product.name)).toBeVisible();

        // Create Tenant B
        const tenantB = {
          user: generateTestData.user(),
          tenant: generateTestData.tenant(),
        };

        actions2.context = await browser.newContext();
        actions2.page = await actions2.context.newPage();
        const pageActions2 = new PageActions(actions2.page);

        // Register Tenant B
        await actions2.page.goto('/register');
        await pageActions2.fillField('Nombre del Comercio', tenantB.tenant.name);
        await pageActions2.fillField('CUIT del Comercio', tenantB.tenant.cuit);
        await pageActions2.fillField('Tu Nombre', tenantB.user.name);
        await pageActions2.fillField('Email', tenantB.user.email);
        await pageActions2.fillField('Contraseña', tenantB.user.password, true);
        await pageActions2.fillField('Confirmar Contraseña', tenantB.user.password, true);
        await pageActions2.clickButton('Registrarse');
        await pageActions2.waitForNavigation('/login');

        // Login as Tenant B
        await pageActions2.fillField('Email', tenantB.user.email);
        await pageActions2.fillField('Contraseña', tenantB.user.password, true);
        await pageActions2.clickButton('Iniciar Sesión');
        await pageActions2.waitForNavigation('/dashboard');

        // Check sales - should NOT see Tenant A's sale
        await actions2.page.goto('/dashboard/sales');
        await expect(actions2.page.getByText(tenantA.product.name)).not.toBeVisible();
      } finally {
        if (actions1.context) await actions1.context.close();
        if (actions2.context) await actions2.context.close();
      }
    });
  });

  test.describe('POS Search Isolation', () => {
    test('POS search should only return products from current tenant', async ({ browser }) => {
      const actions1 = { context: null as any, page: null as any };
      const actions2 = { context: null as any, page: null as any };

      try {
        // Create Tenant A with product
        const tenantA = {
          user: generateTestData.user(),
          tenant: generateTestData.tenant(),
          product: generateTestData.product({ name: 'Unique Product for Tenant A' }),
        };

        actions1.context = await browser.newContext();
        actions1.page = await actions1.context.newPage();
        const pageActions1 = new PageActions(actions1.page);

        await actions1.page.goto('/register');
        await pageActions1.fillField('Nombre completo', tenantA.user.name);
        await pageActions1.fillField('Email', tenantA.user.email);
        await pageActions1.fillField('Contraseña', tenantA.user.password, true);
        await pageActions1.fillField('Confirmar contraseña', tenantA.user.password);
        await pageActions1.fillField('Nombre de la empresa', tenantA.tenant.name);
        await pageActions1.fillField('CUIT', tenantA.tenant.cuit);
        await pageActions1.fillField('Dirección', tenantA.tenant.address);
        await pageActions1.fillField('Ciudad', tenantA.tenant.city);
        await pageActions1.fillField('Provincia', tenantA.tenant.province);
        await pageActions1.fillField('Código Postal', tenantA.tenant.postalCode);
        await pageActions1.fillField('Teléfono', tenantA.tenant.phone);
        await pageActions1.clickButton('Registrarse');
        await pageActions1.waitForNavigation('/dashboard');

        await actions1.page.goto('/dashboard/products/new');
        await pageActions1.fillField('SKU', tenantA.product.sku);
        await pageActions1.fillField('Nombre', tenantA.product.name);
        await pageActions1.fillField('Precio de venta', tenantA.product.salePrice);
        await pageActions1.fillField('Precio de costo', tenantA.product.costPrice);
        await pageActions1.fillField('Tasa de impuesto', tenantA.product.taxRate);
        await pageActions1.fillField('Stock inicial', tenantA.product.stock);
        await pageActions1.clickButton('Guardar Producto');
        await pageActions1.waitForToast('Producto creado exitosamente');

        // Verify Tenant A can find product in POS
        await actions1.page.goto('/dashboard/pos');
        await pageActions1.search('Buscar producto', 'Unique Product');
        await expect(actions1.page.getByText(tenantA.product.name)).toBeVisible();

        // Create Tenant B
        const tenantB = {
          user: generateTestData.user(),
          tenant: generateTestData.tenant(),
        };

        actions2.context = await browser.newContext();
        actions2.page = await actions2.context.newPage();
        const pageActions2 = new PageActions(actions2.page);

        await actions2.page.goto('/register');
        await pageActions2.fillField('Nombre completo', tenantB.user.name);
        await pageActions2.fillField('Email', tenantB.user.email);
        await pageActions2.fillField('Contraseña', tenantB.user.password, true);
        await pageActions2.fillField('Confirmar contraseña', tenantB.user.password);
        await pageActions2.fillField('Nombre de la empresa', tenantB.tenant.name);
        await pageActions2.fillField('CUIT', tenantB.tenant.cuit);
        await pageActions2.fillField('Dirección', tenantB.tenant.address);
        await pageActions2.fillField('Ciudad', tenantB.tenant.city);
        await pageActions2.fillField('Provincia', tenantB.tenant.province);
        await pageActions2.fillField('Código Postal', tenantB.tenant.postalCode);
        await pageActions2.fillField('Teléfono', tenantB.tenant.phone);
        await pageActions2.clickButton('Registrarse');
        await pageActions2.waitForNavigation('/dashboard');

        // Try to search for Tenant A's product in Tenant B's POS
        await actions2.page.goto('/dashboard/pos');
        await pageActions2.search('Buscar producto', 'Unique Product');

        // Should NOT find Tenant A's product
        await expect(actions2.page.getByText(tenantA.product.name)).not.toBeVisible();
      } finally {
        if (actions1.context) await actions1.context.close();
        if (actions2.context) await actions2.context.close();
      }
    });
  });
});
