import { test as setup, expect } from '@playwright/test';
import { generateTestData } from '../utils/test-helpers';
import path from 'path';

const authFile = path.join(__dirname, '../../.auth/user.json');

/**
 * Setup authentication for all tests
 * This runs once before all tests and saves the authentication state
 */
setup('authenticate', async ({ page, request }) => {
  // Check if we should use existing user or create new one
  const useExistingUser = process.env.E2E_USE_EXISTING_USER === 'true';

  let email: string;
  let password: string;

  if (useExistingUser) {
    // Use existing test user from env
    email = process.env.E2E_TEST_EMAIL || 'admin@test.com';
    password = process.env.E2E_TEST_PASSWORD || 'Test123!@#';
  } else {
    // Register a new test user
    const userData = generateTestData.user();
    const tenantData = generateTestData.tenant();

    email = userData.email;
    password = userData.password;

    console.log(`Registering test user: ${email}`);

    await page.goto('/register');

    // Fill in registration form
    await page.getByLabel('Nombre del Comercio').fill(tenantData.name);
    await page.getByLabel('CUIT del Comercio').fill(tenantData.cuit);
    await page.getByLabel('Tu Nombre').fill(userData.name);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByLabel('Confirmar Contraseña').fill(password);

    // Submit registration
    await page.getByRole('button', { name: 'Registrarse' }).click();

    // Wait for success toast
    await expect(page.getByText('Registro exitoso').first()).toBeVisible({ timeout: 10000 });

    // Wait for redirect to login (with extra time for the 1.5s delay)
    await page.waitForURL('**/login', { timeout: 15000 }).catch(async () => {
      // If redirect doesn't happen, manually navigate
      console.log('Redirect timed out, manually navigating to login');
      await page.goto('/login');
    });

    // Wait a bit for the page to be ready
    await page.waitForLoadState('domcontentloaded');

    // Now login with the new credentials
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 20000 });

    // Verify we're logged in
    await expect(page.getByText(userData.name)).toBeVisible();

    console.log(`Test user registered successfully: ${email}`);

    // Save the email and password for future use
    process.env.E2E_TEST_EMAIL = email;
    process.env.E2E_TEST_PASSWORD = password;
  }

  // If we used existing user, we need to login
  if (useExistingUser) {
    console.log(`Logging in with existing user: ${email}`);

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 20000 });
  }

  // Save the authentication state
  await page.context().storageState({ path: authFile });

  console.log('Authentication state saved');
});
