import { test, expect } from '@playwright/test';

test.describe('Movement Types Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@supercommerce.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard/**');

    // Navigate to settings
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');

    // Click on Movement Types tab
    await page.click('button[value="movement-types"]');
    await page.waitForTimeout(500);
  });

  test('should display existing movement types', async ({ page }) => {
    // Check for Income types section
    await expect(page.getByText('Tipos de Ingreso')).toBeVisible();

    // Check for Expense types section
    await expect(page.getByText('Tipos de Egreso')).toBeVisible();

    // Verify some seeded types exist
    await expect(page.getByText('Venta productos usados')).toBeVisible();
    await expect(page.getByText('Retiro efectivo')).toBeVisible();
  });

  test('should create a new income type', async ({ page }) => {
    // Click "Nuevo Ingreso" button
    await page.click('button:has-text("Nuevo Ingreso")');

    // Fill in the form
    await page.fill('input#name', 'Ingreso de Prueba E2E');
    await page.fill('input#description', 'Descripción de prueba para E2E');

    // Verify transaction type is already set to INCOME
    // (button sets it before opening dialog)

    // Click Create button
    await page.click('button:has-text("Crear")');

    // Wait for success toast
    await expect(page.getByText('Tipo creado')).toBeVisible({ timeout: 5000 });

    // Verify the new type appears in the income table
    await expect(page.getByText('Ingreso de Prueba E2E')).toBeVisible();
    await expect(page.getByText('Descripción de prueba para E2E')).toBeVisible();
  });

  test('should create a new expense type', async ({ page }) => {
    // Click "Nuevo Egreso" button
    await page.click('button:has-text("Nuevo Egreso")');

    // Fill in the form
    await page.fill('input#name', 'Egreso de Prueba E2E');
    await page.fill('input#description', 'Gasto de prueba para E2E');

    // Click Create button
    await page.click('button:has-text("Crear")');

    // Wait for success toast
    await expect(page.getByText('Tipo creado')).toBeVisible({ timeout: 5000 });

    // Verify the new type appears in the expense table
    await expect(page.getByText('Egreso de Prueba E2E')).toBeVisible();
    await expect(page.getByText('Gasto de prueba para E2E')).toBeVisible();
  });

  test('should edit an existing movement type', async ({ page }) => {
    // First create a type to edit
    await page.click('button:has-text("Nuevo Ingreso")');
    await page.fill('input#name', 'Tipo para Editar');
    await page.fill('input#description', 'Descripción original');
    await page.click('button:has-text("Crear")');
    await expect(page.getByText('Tipo creado')).toBeVisible({ timeout: 5000 });

    // Find and click the edit button for this type
    const row = page.locator('tr', { has: page.getByText('Tipo para Editar') });
    await row.getByRole('button').nth(0).click(); // First button is edit

    // Modify the form
    await page.fill('input#name', 'Tipo Editado E2E');
    await page.fill('input#description', 'Descripción actualizada');

    // Click Update button
    await page.click('button:has-text("Actualizar")');

    // Wait for success toast
    await expect(page.getByText('Tipo actualizado')).toBeVisible({ timeout: 5000 });

    // Verify the updated values
    await expect(page.getByText('Tipo Editado E2E')).toBeVisible();
    await expect(page.getByText('Descripción actualizada')).toBeVisible();
    await expect(page.getByText('Tipo para Editar')).not.toBeVisible();
  });

  test('should toggle active status', async ({ page }) => {
    // Create a type to test with
    await page.click('button:has-text("Nuevo Ingreso")');
    await page.fill('input#name', 'Tipo para Desactivar');
    await page.click('button:has-text("Crear")');
    await expect(page.getByText('Tipo creado')).toBeVisible({ timeout: 5000 });

    // Edit the type to deactivate it
    const row = page.locator('tr', { has: page.getByText('Tipo para Desactivar') });
    await row.getByRole('button').nth(0).click(); // Edit button

    // Uncheck the active checkbox
    await page.click('input#isActive');

    // Save
    await page.click('button:has-text("Actualizar")');
    await expect(page.getByText('Tipo actualizado')).toBeVisible({ timeout: 5000 });

    // Verify the status badge changed to Inactivo
    const updatedRow = page.locator('tr', { has: page.getByText('Tipo para Desactivar') });
    await expect(updatedRow.getByText('Inactivo')).toBeVisible();
  });

  test('should delete a movement type without transactions', async ({ page }) => {
    // Create a type to delete
    await page.click('button:has-text("Nuevo Egreso")');
    await page.fill('input#name', 'Tipo para Eliminar');
    await page.click('button:has-text("Crear")');
    await expect(page.getByText('Tipo creado')).toBeVisible({ timeout: 5000 });

    // Set up dialog handler for confirmation
    page.on('dialog', dialog => dialog.accept());

    // Find and click the delete button
    const row = page.locator('tr', { has: page.getByText('Tipo para Eliminar') });
    await row.getByRole('button').nth(1).click(); // Second button is delete

    // Wait for success toast
    await expect(page.getByText('Tipo eliminado')).toBeVisible({ timeout: 5000 });

    // Verify the type is gone
    await expect(page.getByText('Tipo para Eliminar')).not.toBeVisible();
  });

  test('should prevent deletion of type with transactions', async ({ page }) => {
    // Find a type that should have transactions (from seed data)
    // "Retiro efectivo" should have transactions associated
    const row = page.locator('tr', { has: page.getByText('Retiro efectivo') });

    // Check if it has transaction count > 0
    const transactionCount = await row.locator('td').nth(2).textContent();

    if (transactionCount && parseInt(transactionCount) > 0) {
      // Set up dialog handler
      page.on('dialog', dialog => dialog.accept());

      // Try to delete
      await row.getByRole('button').nth(1).click(); // Delete button

      // Should show error message
      await expect(page.getByText(/No se puede eliminar/)).toBeVisible({ timeout: 5000 });

      // Type should still exist
      await expect(page.getByText('Retiro efectivo')).toBeVisible();
    }
  });

  test('should validate required fields', async ({ page }) => {
    // Click to create new type
    await page.click('button:has-text("Nuevo Ingreso")');

    // Try to create without name
    await page.click('button:has-text("Crear")');

    // Should show validation error
    await expect(page.getByText('El nombre es obligatorio')).toBeVisible({ timeout: 5000 });
  });

  test('should prevent duplicate names', async ({ page }) => {
    // Create a type
    await page.click('button:has-text("Nuevo Ingreso")');
    await page.fill('input#name', 'Nombre Duplicado');
    await page.click('button:has-text("Crear")');
    await expect(page.getByText('Tipo creado')).toBeVisible({ timeout: 5000 });

    // Try to create another with same name
    await page.click('button:has-text("Nuevo Ingreso")');
    await page.fill('input#name', 'Nombre Duplicado');
    await page.click('button:has-text("Crear")');

    // Should show error
    await expect(page.getByText(/Ya existe un tipo de movimiento con ese nombre/)).toBeVisible({ timeout: 5000 });
  });

  test('should display transaction counts', async ({ page }) => {
    // Check that transaction counts are displayed
    const incomeTable = page.locator('div').filter({ hasText: 'Tipos de Ingreso' }).locator('..').locator('table');
    const rows = incomeTable.locator('tbody tr');

    // At least one row should exist
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Each row should have a transaction count column
    const firstRow = rows.first();
    const cells = firstRow.locator('td');
    expect(await cells.count()).toBe(5); // Name, Description, Transactions, Status, Actions
  });

  test('should separate income and expense types correctly', async ({ page }) => {
    // Create one of each type
    await page.click('button:has-text("Nuevo Ingreso")');
    await page.fill('input#name', 'Test Income Type');
    await page.click('button:has-text("Crear")');
    await expect(page.getByText('Tipo creado')).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Nuevo Egreso")');
    await page.fill('input#name', 'Test Expense Type');
    await page.click('button:has-text("Crear")');
    await expect(page.getByText('Tipo creado')).toBeVisible({ timeout: 5000 });

    // Verify they appear in correct sections
    const incomeSection = page.locator('div').filter({ hasText: 'Tipos de Ingreso' }).locator('..');
    const expenseSection = page.locator('div').filter({ hasText: 'Tipos de Egreso' }).locator('..');

    await expect(incomeSection.getByText('Test Income Type')).toBeVisible();
    await expect(expenseSection.getByText('Test Expense Type')).toBeVisible();

    // Income should NOT be in expense section and vice versa
    await expect(expenseSection.getByText('Test Income Type')).not.toBeVisible();
    await expect(incomeSection.getByText('Test Expense Type')).not.toBeVisible();
  });
});
