import { test, expect } from '@playwright/test';
import { generateTestData, PageActions, Assertions } from '../utils/test-helpers';

test.describe('Settings Management', () => {
  let actions: PageActions;
  let assertions: Assertions;

  test.beforeEach(async ({ page }) => {
    actions = new PageActions(page);
    assertions = new Assertions(page);
    await page.goto('/dashboard/settings');
  });

  test.describe('Settings Page', () => {
    test('should display settings page with tabs', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();

      // Check all tabs are present
      await expect(page.getByRole('tab', { name: /Negocio/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Ubicaciones/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Usuarios/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /AFIP/i })).toBeVisible();
    });
  });

  test.describe('Business Information', () => {
    test('should display business information', async ({ page }) => {
      // Should be on Business tab by default
      await expect(page.getByText('Información del Negocio').first()).toBeVisible(); // .first() to handle paragraph and heading

      // Check form fields exist
      await expect(page.getByLabel('Nombre del Comercio')).toBeVisible();
      await expect(page.getByLabel('CUIT')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
    });

    test('should display business statistics', async ({ page }) => {
      await expect(page.getByText('Estadísticas')).toBeVisible();
      await expect(page.getByText('Usuarios').first()).toBeVisible(); // .first() to handle tab and statistics text
      await expect(page.getByText('Ubicaciones').first()).toBeVisible(); // .first() to handle tab and statistics text
      await expect(page.getByText('Productos').first()).toBeVisible(); // .first() to handle potential duplicates
      await expect(page.getByText('Ventas').first()).toBeVisible(); // .first() to handle potential duplicates
    });
  });

  test.describe('Locations Management', () => {
    test('should navigate to locations tab', async ({ page }) => {
      await page.getByRole('tab', { name: /Ubicaciones/i }).click();

      await expect(page.getByRole('heading', { name: 'Ubicaciones' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Nueva Ubicación/i })).toBeVisible();
    });

    test('should create a new location', async ({ page }) => {
      await page.getByRole('tab', { name: /Ubicaciones/i }).click();

      const locationData = {
        name: `Test Location ${Date.now()}`,
        address: 'Test Address 123',
        phone: '+54 11 9999-9999',
      };

      // Click "Nueva Ubicación"
      await page.getByRole('button', { name: /Nueva Ubicación/i }).click();

      // Wait for dialog
      await expect(page.getByRole('heading', { name: 'Nueva Ubicación' })).toBeVisible();

      // Fill form
      await page.getByLabel('Nombre').fill(locationData.name);
      await page.getByLabel('Dirección').fill(locationData.address);
      await page.getByLabel('Teléfono').fill(locationData.phone);

      // Submit
      await page.getByRole('button', { name: 'Crear Ubicación' }).click();

      // Should show success toast
      await actions.waitForToast('Ubicación creada');

      // Should appear in list
      await expect(page.getByText(locationData.name)).toBeVisible();
    });

    test('should show location in table', async ({ page }) => {
      await page.getByRole('tab', { name: /Ubicaciones/i }).click();

      // Check table headers
      await expect(page.getByText('Nombre').first()).toBeVisible();
      await expect(page.getByText('Dirección').first()).toBeVisible();
      await expect(page.getByText('Estado').first()).toBeVisible();
    });
  });

  test.describe('Users Management', () => {
    test('should navigate to users tab', async ({ page }) => {
      await page.getByRole('tab', { name: /Usuarios/i }).click();

      await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Nuevo Usuario/i })).toBeVisible();
    });

    test('should display users table', async ({ page }) => {
      await page.getByRole('tab', { name: /Usuarios/i }).click();

      // Check table headers
      await expect(page.getByText('Nombre').first()).toBeVisible();
      await expect(page.getByText('Email').first()).toBeVisible();
      await expect(page.getByText('Rol').first()).toBeVisible();
      await expect(page.getByText('Estado').first()).toBeVisible();
    });

    test('should create a new user', async ({ page }) => {
      await page.getByRole('tab', { name: /Usuarios/i }).click();

      const userData = {
        name: `Test User ${Date.now()}`,
        email: `testuser${Date.now()}@test.com`,
        password: 'TestPass123!',
      };

      // Click "Nuevo Usuario"
      await page.getByRole('button', { name: /Nuevo Usuario/i }).click();

      // Wait for dialog
      await expect(page.getByRole('heading', { name: 'Nuevo Usuario' })).toBeVisible();

      // Fill form
      await page.locator('#userName').fill(userData.name);
      await page.locator('#userEmail').fill(userData.email);
      await page.locator('#userPassword').fill(userData.password);

      // Select role (Cajero by default should be fine)

      // Submit
      await page.getByRole('button', { name: 'Crear Usuario' }).click();

      // Should show success toast
      await actions.waitForToast('Usuario creado');

      // Should appear in list
      await expect(page.getByText(userData.name)).toBeVisible();
    });

    test('should show error with duplicate email', async ({ page }) => {
      await page.getByRole('tab', { name: /Usuarios/i }).click();

      const email = `duplicate${Date.now()}@test.com`;

      // Create first user
      await page.getByRole('button', { name: /Nuevo Usuario/i }).click();
      await page.locator('#userName').fill('First User');
      await page.locator('#userEmail').fill(email);
      await page.locator('#userPassword').fill('TestPass123!');
      await page.getByRole('button', { name: 'Crear Usuario' }).click();
      await actions.waitForToast('Usuario creado');

      // Try to create second user with same email
      await page.getByRole('button', { name: /Nuevo Usuario/i }).click();
      await page.locator('#userName').fill('Second User');
      await page.locator('#userEmail').fill(email);
      await page.locator('#userPassword').fill('TestPass123!');
      await page.getByRole('button', { name: 'Crear Usuario' }).click();

      // Should show error
      await expect(page.getByText(/email.*existe/i).first()).toBeVisible();
    });
  });

  test.describe('AFIP Configuration', () => {
    test('should navigate to AFIP tab', async ({ page }) => {
      await page.getByRole('tab', { name: /AFIP/i }).click();

      await expect(page.getByRole('heading', { name: 'Configuración AFIP' })).toBeVisible();
      await expect(page.getByLabel('Punto de Venta')).toBeVisible();
    });

    test('should show AFIP configuration form', async ({ page }) => {
      await page.getByRole('tab', { name: /AFIP/i }).click();

      // Check for save button
      await expect(page.getByRole('button', { name: /Guardar Configuración AFIP/i })).toBeVisible();
    });
  });

  test.describe('Tab Navigation', () => {
    test('should switch between all tabs', async ({ page }) => {
      // Negocio (default)
      await expect(page.getByRole('tab', { name: /Negocio/i })).toHaveAttribute('data-state', 'active');

      // Ubicaciones
      await page.getByRole('tab', { name: /Ubicaciones/i }).click();
      await expect(page.getByRole('tab', { name: /Ubicaciones/i })).toHaveAttribute('data-state', 'active');

      // Usuarios
      await page.getByRole('tab', { name: /Usuarios/i }).click();
      await expect(page.getByRole('tab', { name: /Usuarios/i })).toHaveAttribute('data-state', 'active');

      // AFIP
      await page.getByRole('tab', { name: /AFIP/i }).click();
      await expect(page.getByRole('tab', { name: /AFIP/i })).toHaveAttribute('data-state', 'active');
    });
  });
});
