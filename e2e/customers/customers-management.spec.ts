import { test, expect } from '@playwright/test';
import { generateTestData, PageActions, Assertions } from '../utils/test-helpers';

test.describe('Customer Management', () => {
  let actions: PageActions;
  let assertions: Assertions;

  test.beforeEach(async ({ page }) => {
    actions = new PageActions(page);
    assertions = new Assertions(page);
    await page.goto('/dashboard/customers');
  });

  test.describe('Customer List', () => {
    test('should display customers page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Clientes', exact: true })).toBeVisible();
      await expect(page.getByText('Gestiona los clientes de tu negocio')).toBeVisible();
    });

    test('should show customer table headers', async ({ page }) => {
      // Create a customer first to ensure table is rendered
      await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
      await actions.fillField('Nombre', 'Test Customer for Headers');
      await page.getByRole('button', { name: 'Crear Cliente' }).click();
      await actions.waitForToast('Cliente creado');

      // Now check table headers are visible
      await expect(page.getByText('Nombre').first()).toBeVisible();
      await expect(page.getByText('Email').first()).toBeVisible();
      await expect(page.getByText('Teléfono').first()).toBeVisible();
      await expect(page.getByText('Documento').first()).toBeVisible();
    });
  });

  test.describe('Create Customer', () => {
    test('should create a new customer with all fields', async ({ page }) => {
      const customerData = {
        name: `Test Customer ${Date.now()}`,
        email: `customer${Date.now()}@test.com`,
        phone: '+54 11 1234-5678',
        documentType: 'DNI',
        documentNumber: '12345678',
        address: 'Test Street 123',
      };

      // Click "Nuevo Cliente" button
      await page.getByRole('button', { name: /Nuevo Cliente/i }).click();

      // Wait for dialog
      await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible();

      // Fill form
      await actions.fillField('Nombre', customerData.name);
      await actions.fillField('Email', customerData.email);
      await actions.fillField('Teléfono', customerData.phone);
      await page.getByPlaceholder('DNI, CUIT, etc.').fill(customerData.documentType);
      await page.getByPlaceholder('12345678').fill(customerData.documentNumber);
      await page.getByPlaceholder('Calle, número, ciudad').fill(customerData.address);

      // Submit
      await page.getByRole('button', { name: 'Crear Cliente' }).click();

      // Should show success toast
      await actions.waitForToast('Cliente creado');

      // Customer should appear in list
      await expect(page.getByText(customerData.name)).toBeVisible();
    });

    test('should create customer with only required fields', async ({ page }) => {
      const customerData = {
        name: `Minimal Customer ${Date.now()}`,
      };

      await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
      await actions.fillField('Nombre', customerData.name);
      await page.getByRole('button', { name: 'Crear Cliente' }).click();

      await actions.waitForToast('Cliente creado');
      await expect(page.getByText(customerData.name)).toBeVisible();
    });

    test('should show error when name is missing', async ({ page }) => {
      await page.getByRole('button', { name: /Nuevo Cliente/i }).click();

      // Try to submit without name
      await page.getByRole('button', { name: 'Crear Cliente' }).click();

      // Should show validation error
      await expect(page.getByText(/obligatorio/i).first()).toBeVisible();
    });

    test('should show error with duplicate email', async ({ page }) => {
      const email = `duplicate${Date.now()}@test.com`;

      // Create first customer
      await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
      await actions.fillField('Nombre', 'First Customer');
      await actions.fillField('Email', email);
      await page.getByRole('button', { name: 'Crear Cliente' }).click();
      await actions.waitForToast('Cliente creado');

      // Try to create second customer with same email
      await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
      await actions.fillField('Nombre', 'Second Customer');
      await actions.fillField('Email', email);
      await page.getByRole('button', { name: 'Crear Cliente' }).click();

      // Should show error (English message from API)
      await expect(page.getByText(/email.*already exists/i).first()).toBeVisible();
    });
  });

  test.describe('Edit Customer', () => {
    test('should edit an existing customer', async ({ page }) => {
      // Create a customer first
      const originalName = `Original ${Date.now()}`;
      const updatedName = `Updated ${Date.now()}`;

      await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
      await actions.fillField('Nombre', originalName);
      await page.getByRole('button', { name: 'Crear Cliente' }).click();
      await actions.waitForToast('Cliente creado');

      // Find and click edit button (assuming it's a pencil icon)
      const row = page.locator('tr', { has: page.getByText(originalName) });
      await row.getByRole('button').first().click(); // Edit button

      // Update name
      await page.getByLabel('Nombre').clear();
      await page.getByLabel('Nombre').fill(updatedName);
      await page.getByRole('button', { name: 'Actualizar Cliente' }).click();

      // Should show success toast
      await actions.waitForToast('Cliente actualizado');

      // Should show updated name
      await expect(page.getByText(updatedName)).toBeVisible();
      await expect(page.getByText(originalName)).not.toBeVisible();
    });
  });

  test.describe('Delete Customer', () => {
    test('should delete a customer without sales', async ({ page }) => {
      const customerName = `Delete Test ${Date.now()}`;

      // Create customer
      await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
      await actions.fillField('Nombre', customerName);
      await page.getByRole('button', { name: 'Crear Cliente' }).click();
      await actions.waitForToast('Cliente creado');

      // Setup dialog handler for confirmation
      page.on('dialog', dialog => dialog.accept());

      // Find and click delete button
      const row = page.locator('tr', { has: page.getByText(customerName) });
      await row.getByRole('button').nth(1).click(); // Delete button (second button)

      // Should show success toast
      await actions.waitForToast('Cliente eliminado');

      // Customer should not appear in list
      await expect(page.getByText(customerName)).not.toBeVisible();
    });
  });

  test.describe('Search Customers', () => {
    test('should search customers by name', async ({ page }) => {
      const searchableName = `Searchable ${Date.now()}`;

      // Create customer
      await page.getByRole('button', { name: /Nuevo Cliente/i }).click();
      await actions.fillField('Nombre', searchableName);
      await page.getByRole('button', { name: 'Crear Cliente' }).click();
      await actions.waitForToast('Cliente creado');

      // Search
      await actions.search('Buscar por nombre, email', searchableName);

      // Should show in results
      await expect(page.getByText(searchableName)).toBeVisible();
    });
  });
});
