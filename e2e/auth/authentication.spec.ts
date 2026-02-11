import { test, expect } from '@playwright/test';
import { generateTestData, PageActions, Assertions } from '../utils/test-helpers';

test.describe('Authentication', () => {
  test.describe('User Registration', () => {
    // Use empty storage state for registration tests (no auth)
    test.use({ storageState: { cookies: [], origins: [] } });

    test('should successfully register a new user with valid data', async ({ page }) => {
      const userData = generateTestData.user();
      const tenantData = generateTestData.tenant();
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      await page.goto('/register');

      // Fill registration form
      await actions.fillField('Nombre del Comercio', tenantData.name);
      await actions.fillField('CUIT del Comercio', tenantData.cuit);
      await actions.fillField('Tu Nombre', userData.name);
      await actions.fillField('Email', userData.email);
      await actions.fillField('Contraseña', userData.password, true);
      await actions.fillField('Confirmar Contraseña', userData.password, true);

      // Submit registration
      await actions.clickButton('Registrarse');

      // Should show success toast and redirect to login
      await actions.waitForToast('Registro exitoso');
      await actions.waitForNavigation('/login');

      // Now login with the new credentials
      await actions.fillField('Email', userData.email);
      await actions.fillField('Contraseña', userData.password, true);
      await actions.clickButton('Iniciar Sesión');

      // Should redirect to dashboard
      await actions.waitForNavigation('/dashboard');
      await assertions.assertOnDashboard();

      // Should display user name
      await expect(page.getByText(userData.name)).toBeVisible();
    });

    test('should show error with duplicate email', async ({ page }) => {
      const userData = generateTestData.user();
      const tenantData = generateTestData.tenant();
      const actions = new PageActions(page);

      // Register first user
      await page.goto('/register');
      await actions.fillField('Nombre del Comercio', tenantData.name);
      await actions.fillField('CUIT del Comercio', tenantData.cuit);
      await actions.fillField('Tu Nombre', userData.name);
      await actions.fillField('Email', userData.email);
      await actions.fillField('Contraseña', userData.password, true);
      await actions.fillField('Confirmar Contraseña', userData.password, true);
      await actions.clickButton('Registrarse');
      await actions.waitForNavigation('/login');

      // Logout
      await page.goto('/login');

      // Try to register again with same email
      await page.goto('/register');
      const newTenantData = generateTestData.tenant();
      await actions.fillField('Nombre del Comercio', newTenantData.name);
      await actions.fillField('CUIT del Comercio', newTenantData.cuit);
      await actions.fillField('Tu Nombre', 'Another User');
      await actions.fillField('Email', userData.email); // Same email
      await actions.fillField('Contraseña', userData.password, true);
      await actions.fillField('Confirmar Contraseña', userData.password, true);
      await actions.clickButton('Registrarse');

      // Should show error
      await expect(page.getByText(/ya existe|already exists/i).first()).toBeVisible();
    });

    test('should show error with duplicate CUIT', async ({ page }) => {
      const userData1 = generateTestData.user();
      const userData2 = generateTestData.user();
      const tenantData = generateTestData.tenant();
      const actions = new PageActions(page);

      // Register first user
      await page.goto('/register');
      await actions.fillField('Nombre del Comercio', tenantData.name);
      await actions.fillField('CUIT del Comercio', tenantData.cuit);
      await actions.fillField('Tu Nombre', userData1.name);
      await actions.fillField('Email', userData1.email);
      await actions.fillField('Contraseña', userData1.password, true);
      await actions.fillField('Confirmar Contraseña', userData1.password, true);
      await actions.clickButton('Registrarse');
      await actions.waitForNavigation('/login');

      // Logout
      await page.goto('/login');

      // Try to register again with same CUIT
      await page.goto('/register');
      await actions.fillField('Nombre del Comercio', 'Different Company');
      await actions.fillField('CUIT del Comercio', tenantData.cuit); // Same CUIT
      await actions.fillField('Tu Nombre', userData2.name);
      await actions.fillField('Email', userData2.email);
      await actions.fillField('Contraseña', userData2.password, true);
      await actions.fillField('Confirmar Contraseña', userData2.password, true);
      await actions.clickButton('Registrarse');

      // Should show error
      await expect(page.getByText(/CUIT ya existe|CUIT already exists/i).first()).toBeVisible();
    });

    test('should show validation error with mismatched passwords', async ({ page }) => {
      const userData = generateTestData.user();
      const tenantData = generateTestData.tenant();
      const actions = new PageActions(page);

      await page.goto('/register');

      await actions.fillField('Nombre del Comercio', tenantData.name);
      await actions.fillField('CUIT del Comercio', tenantData.cuit);
      await actions.fillField('Tu Nombre', userData.name);
      await actions.fillField('Email', userData.email);
      await actions.fillField('Contraseña', userData.password, true);
      await actions.fillField('Confirmar Contraseña', 'DifferentPassword123!', true);
      await actions.clickButton('Registrarse');

      // Should show toast error
      await actions.waitForToast('Las contraseñas no coinciden');
    });

    test('should show validation error with invalid email format', async ({ page }) => {
      const userData = generateTestData.user();
      const tenantData = generateTestData.tenant();
      const actions = new PageActions(page);

      await page.goto('/register');

      await actions.fillField('Tu Nombre', userData.name);
      await actions.fillField('Email', 'invalid-email'); // Invalid format
      await actions.fillField('Contraseña', userData.password, true);
      await actions.fillField('Confirmar Contraseña', userData.password, true);

      // Try to submit
      await actions.clickButton('Registrarse');

      // Should show HTML5 validation or custom error
      const emailInput = page.getByLabel('Email');
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test('should show validation error with short password', async ({ page }) => {
      const userData = generateTestData.user();
      const tenantData = generateTestData.tenant();
      const actions = new PageActions(page);

      await page.goto('/register');

      await actions.fillField('Nombre del Comercio', tenantData.name);
      await actions.fillField('CUIT del Comercio', tenantData.cuit);
      await actions.fillField('Tu Nombre', userData.name);
      await actions.fillField('Email', userData.email);
      await actions.fillField('Contraseña', '123', true); // Too short
      await actions.fillField('Confirmar Contraseña', '123', true);
      await actions.clickButton('Registrarse');

      // Should show HTML5 validation error
      const passwordInput = page.getByLabel('Contraseña', { exact: true });
      const validationMessage = await passwordInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy();
    });
  });

  test.describe('User Login', () => {
    test('should successfully login with valid credentials', async ({ page, request }) => {
      const userData = generateTestData.user();
      const tenantData = generateTestData.tenant();
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // First, register a user
      await request.post('/api/auth/register', {
        data: {
          name: userData.name,
          email: userData.email,
          password: userData.password,
          tenantName: tenantData.name,
          cuit: tenantData.cuit,
        },
      });

      // Now try to login
      await page.goto('/login');
      await actions.fillField('Email', userData.email);
      await actions.fillField('Contraseña', userData.password, true);
      await actions.clickButton('Iniciar Sesión');

      // Should redirect to dashboard
      await actions.waitForNavigation('/dashboard');
      await assertions.assertOnDashboard();
    });

    test('should show error with invalid credentials', async ({ page }) => {
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      await page.goto('/login');
      await actions.fillField('Email', 'nonexistent@test.com');
      await actions.fillField('Contraseña', 'WrongPassword123!');
      await actions.clickButton('Iniciar Sesión');

      // Should show error message
      await assertions.assertErrorMessage('Email o contraseña incorrectos');
    });

    test('should show validation error with empty fields', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/login');
      await actions.clickButton('Iniciar Sesión');

      // Should show HTML5 validation
      const emailInput = page.getByLabel('Email');
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test('should remember user session after page refresh', async ({ page, request }) => {
      const userData = generateTestData.user();
      const tenantData = generateTestData.tenant();
      const actions = new PageActions(page);

      // Register and login
      await request.post('/api/auth/register', {
        data: {
          name: userData.name,
          email: userData.email,
          password: userData.password,
          tenantName: tenantData.name,
          cuit: tenantData.cuit,
        },
      });

      await page.goto('/login');
      await actions.fillField('Email', userData.email);
      await actions.fillField('Contraseña', userData.password, true);
      await actions.clickButton('Iniciar Sesión');
      await actions.waitForNavigation('/dashboard');

      // Refresh the page
      await page.reload();

      // Should still be logged in
      await expect(page.getByText(userData.name)).toBeVisible();
    });
  });

  test.describe('User Logout', () => {
    test('should successfully logout', async ({ page }) => {
      const actions = new PageActions(page);
      const assertions = new Assertions(page);

      // User is already logged in (from auth.setup.ts)
      await page.goto('/dashboard');

      // Click on user avatar to open dropdown
      const avatarButton = page.locator('button.rounded-full').first();
      await avatarButton.click();

      // Wait for dropdown to open and click logout
      await page.getByRole('menuitem', { name: /cerrar sesión/i }).click();

      // Should redirect to login
      await page.waitForURL(/.*login/, { timeout: 10000 });
      await assertions.assertOnLoginPage();

      // Try to access dashboard
      await page.goto('/dashboard');

      // Should redirect back to login
      await page.waitForURL(/.*login/, { timeout: 5000 });
      await assertions.assertOnLoginPage();
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing protected route without auth', async ({
      browser,
    }) => {
      // Create new context without auth - explicitly no storage state
      const context = await browser.newContext({ storageState: undefined });
      const page = await context.newPage();
      const assertions = new Assertions(page);

      // Navigate to dashboard - middleware should redirect to login
      const response = await page.goto('/dashboard');

      // Check if we got redirected (response URL should be login)
      // Or check if we're on login page
      await page.waitForURL(/.*login/, { timeout: 10000 }).catch(async () => {
        // If URL didn't change, check if content shows login page
        const url = page.url();
        if (url.includes('/login')) {
          // Already on login, that's fine
          return;
        }
        throw new Error(`Expected redirect to /login but got ${url}`);
      });

      // Should be on login page
      await assertions.assertOnLoginPage();

      await context.close();
    });

    test('should redirect to login when accessing products without auth', async ({
      browser,
    }) => {
      const context = await browser.newContext({ storageState: undefined });
      const page = await context.newPage();
      const assertions = new Assertions(page);

      // Try to navigate to products - should redirect to login
      await page.goto('/dashboard/products', { waitUntil: 'networkidle' });

      // Wait a bit for any redirects to complete
      await page.waitForTimeout(1000);

      // Should be on login page
      await assertions.assertOnLoginPage();

      await context.close();
    });

    test('should redirect to login when accessing POS without auth', async ({ browser }) => {
      const context = await browser.newContext({ storageState: undefined });
      const page = await context.newPage();
      const assertions = new Assertions(page);

      // Try to navigate to POS - should redirect to login
      await page.goto('/dashboard/pos', { waitUntil: 'networkidle' });

      // Wait a bit for any redirects to complete
      await page.waitForTimeout(1000);

      // Should be on login page
      await assertions.assertOnLoginPage();

      await context.close();
    });

    test('should allow access to protected routes when authenticated', async ({ page }) => {
      await page.goto('/dashboard/products');
      await expect(page).toHaveURL(/.*dashboard\/products/);

      await page.goto('/dashboard/pos');
      await expect(page).toHaveURL(/.*dashboard\/pos/);

      await page.goto('/dashboard/sales');
      await expect(page).toHaveURL(/.*dashboard\/sales/);
    });
  });
});
