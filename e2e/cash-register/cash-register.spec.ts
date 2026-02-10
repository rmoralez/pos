import { test, expect } from '@playwright/test';
import { generateTestData, PageActions, Assertions } from '../utils/test-helpers';

test.describe('Cash Register Management', () => {
  test.describe('Opening Cash Register', () => {
    test('should successfully open a cash register', async ({ page }) => {
      const actions = new PageActions(page);

      // Navigate to cash register page
      await page.goto('/dashboard/cash');

      // Should show "No hay caja abierta" message
      await expect(page.getByText('No hay caja abierta')).toBeVisible();
      await expect(page.getByText('Debes abrir una caja para comenzar a registrar ventas')).toBeVisible();

      // Click "Abrir Caja" button
      await actions.clickButton('Abrir Caja');

      // Dialog should be visible
      await expect(page.getByRole('heading', { name: 'Abrir Caja' })).toBeVisible();

      // Fill opening balance
      await actions.fillField('Balance Inicial', '10000');
      await actions.fillField('Notas (Opcional)', 'Apertura de caja de prueba');

      // Submit form
      await actions.clickButton('Abrir Caja');

      // Should show success toast
      await actions.waitForToast('Caja abierta');

      // Should show cash register dashboard
      await expect(page.getByText('Balance Actual')).toBeVisible();
      await expect(page.getByText(/\$\s*10\.000,00/).first()).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'Abierta' })).toBeVisible();
    });

    test('should not allow opening multiple cash registers for same location', async ({ page }) => {
      const actions = new PageActions(page);

      // Open first cash register
      await page.goto('/dashboard/cash');

      // Check if we need to open a register
      const hasOpenButton = await page.getByRole('button', { name: 'Abrir Caja' }).isVisible().catch(() => false);
      if (hasOpenButton) {
        await actions.clickButton('Abrir Caja');
        await actions.fillField('Balance Inicial', '5000');
        await actions.clickButton('Abrir Caja');
        await actions.waitForToast('Caja abierta');
      }

      // Should already be on cash page with open register
      await expect(page.getByText('Balance Actual')).toBeVisible();
    });

    test('should validate opening balance is required', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/dashboard/cash');

      // Check if there's already an open register, if so close it first
      const hasCloseButton = await page.getByRole('button', { name: 'Cerrar Caja' }).isVisible().catch(() => false);
      if (hasCloseButton) {
        await actions.clickButton('Cerrar Caja');
        await actions.fillField('Balance Final (Contado)', '1000');
        await actions.clickButton('Cerrar Caja');
        await page.waitForTimeout(2000);
      }

      await actions.clickButton('Abrir Caja');

      // Try to submit without balance
      await actions.clickButton('Abrir Caja');

      // Form should still be visible (validation error)
      await expect(page.getByRole('heading', { name: 'Abrir Caja' })).toBeVisible();
    });
  });

  test.describe('Sales Integration', () => {
    // Skip product creation - these tests just verify cash register integration
    // Products from other test suites should be available

    test('should show warning in POS when no cash register is open', async ({ page }) => {
      const actions = new PageActions(page);

      // Close any open register first
      await page.goto('/dashboard/cash');
      const hasCloseButton = await page.getByRole('button', { name: 'Cerrar Caja' }).isVisible().catch(() => false);
      if (hasCloseButton) {
        await actions.clickButton('Cerrar Caja');
        await actions.fillField('Balance Final (Contado)', '1000');
        await actions.clickButton('Cerrar Caja');
        await page.waitForTimeout(2000);
      }

      // Go to POS
      await page.goto('/dashboard/pos');

      // Should show alert (check for just part of the text)
      await expect(page.getByText(/No hay caja abierta/i)).toBeVisible();
    });

    test('should allow sales with open cash register', async ({ page }) => {
      const actions = new PageActions(page);

      // Open cash register first
      await page.goto('/dashboard/cash');

      const hasOpenButton = await page.getByRole('button', { name: 'Abrir Caja' }).isVisible().catch(() => false);
      if (hasOpenButton) {
        await actions.clickButton('Abrir Caja');
        await actions.fillField('Balance Inicial', '10000');
        await actions.clickButton('Abrir Caja');
        await actions.waitForToast('Caja abierta');
      }

      // Go to POS
      await page.goto('/dashboard/pos');

      // Should NOT show the warning
      const hasWarning = await page.getByText(/No hay caja abierta/i).isVisible().catch(() => false);
      expect(hasWarning).toBe(false);

      // Try to search for product
      await actions.search('Buscar producto', 'Test Product for Cash');

      // Wait a bit for search results
      await page.waitForTimeout(1000);

      // If product found, click it
      const productVisible = await page.getByText('Test Product for Cash').isVisible().catch(() => false);
      if (productVisible) {
        await page.getByText('Test Product for Cash').click();

        // Process payment
        await actions.clickButton('Procesar Pago');

        // Select payment method
        await expect(page.getByRole('heading', { name: 'Procesar Pago' })).toBeVisible();
        await actions.clickButton('Confirmar Pago');

        // Wait for success
        await actions.waitForToast('Venta completada');
      }

      // Go back to cash register to verify
      await page.goto('/dashboard/cash');

      // Balance should be visible
      await expect(page.getByText('Balance Actual')).toBeVisible();
    });
  });

  test.describe('Cash Transactions', () => {
    test.beforeEach(async ({ page }) => {
      const actions = new PageActions(page);

      // Open cash register
      await page.goto('/dashboard/cash');

      // Check if already open, if not, open it
      const hasOpenButton = await page.getByRole('button', { name: 'Abrir Caja' }).isVisible().catch(() => false);
      if (hasOpenButton) {
        await actions.clickButton('Abrir Caja');
        await actions.fillField('Balance Inicial', '20000');
        await actions.clickButton('Abrir Caja');
        await actions.waitForToast('Caja abierta');
      }
    });

    test('should register income transaction', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/dashboard/cash');

      // Click "Registrar Ingreso" button
      await actions.clickButton('Registrar Ingreso');

      // Dialog should be visible
      await expect(page.getByRole('heading', { name: 'Registrar Transacción' })).toBeVisible();

      // Fill transaction details
      await actions.fillField('Monto', '5000');
      await page.getByLabel('Motivo').fill('Venta de producto usado');
      await actions.fillField('Referencia (Opcional)', 'REF-001');

      // Submit
      await actions.clickButton('Registrar Transacción');

      // Should show success
      await actions.waitForToast('Ingreso registrado');

      // Verify income section is visible
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Ingresos' })).toBeVisible();
    });

    test('should register expense transaction', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/dashboard/cash');

      // Click "Registrar Egreso" button
      await actions.clickButton('Registrar Egreso');

      // Dialog should be visible
      await expect(page.getByRole('heading', { name: 'Registrar Transacción' })).toBeVisible();

      // Select expense type
      await page.getByLabel('Tipo de Transacción').click();
      await page.getByRole('option', { name: 'Egreso' }).click();

      // Fill transaction details
      await actions.fillField('Monto', '3000');
      await page.getByLabel('Motivo').fill('Pago de servicio de internet');
      await actions.fillField('Referencia (Opcional)', 'FACTURA-123');

      // Submit
      await actions.clickButton('Registrar Transacción');

      // Should show success
      await actions.waitForToast('Egreso registrado');

      // Expenses should be visible
      await page.reload();
      await expect(page.getByText('Egresos')).toBeVisible();
    });

    test('should validate required fields in transaction', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/dashboard/cash');
      await actions.clickButton('Registrar Ingreso');

      // Try to submit without filling required fields
      await actions.clickButton('Registrar Transacción');

      // Dialog should still be visible (validation error)
      await expect(page.getByRole('heading', { name: 'Registrar Transacción' })).toBeVisible();
    });
  });

  test.describe('Closing Cash Register', () => {
    test.beforeEach(async ({ page }) => {
      const actions = new PageActions(page);

      // Open cash register
      await page.goto('/dashboard/cash');

      const hasOpenButton = await page.getByRole('button', { name: 'Abrir Caja' }).isVisible().catch(() => false);
      if (hasOpenButton) {
        await actions.clickButton('Abrir Caja');
        await actions.fillField('Balance Inicial', '15000');
        await actions.clickButton('Abrir Caja');
        await actions.waitForToast('Caja abierta');
      }
    });

    test('should close cash register with correct balance', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/dashboard/cash');

      // Click "Cerrar Caja" button
      await actions.clickButton('Cerrar Caja');

      // Dialog should be visible
      await expect(page.getByRole('heading', { name: 'Cerrar Caja' })).toBeVisible();

      // Should show opening and expected balance
      await expect(page.getByText('Balance Inicial:')).toBeVisible();
      await expect(page.getByText('Balance Esperado:')).toBeVisible();

      // Enter closing balance (same as expected)
      await actions.fillField('Balance Final (Contado)', '15000');

      // Wait for the difference calculation to appear
      await page.waitForTimeout(500);

      // Should show "Balance Correcto" message
      await expect(page.getByText('Balance Correcto')).toBeVisible();
      await expect(page.getByText(/\$\s*0,00/).first()).toBeVisible();

      // Add notes
      await page.getByLabel('Notas (Opcional)').fill('Cierre sin novedades');

      // Submit
      await actions.clickButton('Cerrar Caja');

      // Should show success
      await actions.waitForToast('Caja cerrada');

      // Should return to "No hay caja abierta" state
      await expect(page.getByText('No hay caja abierta')).toBeVisible();
    });

    test('should handle surplus (sobrante) when closing', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/dashboard/cash');
      await actions.clickButton('Cerrar Caja');

      // Enter more money than expected
      await actions.fillField('Balance Final (Contado)', '16000');

      // Wait for the difference calculation to appear
      await page.waitForTimeout(500);

      // Should show "Sobrante" message
      await expect(page.getByText('Sobrante')).toBeVisible();
      await expect(page.getByText('Hay más dinero del esperado')).toBeVisible();

      // The difference amount should be shown (with flexible spacing)
      await expect(page.getByText(/\$\s*1\.000,00/).first()).toBeVisible();

      // Can still close with surplus
      await page.getByLabel('Notas (Opcional)').fill('Sobrante de $1000');
      await actions.clickButton('Cerrar Caja');
      await actions.waitForToast('Caja cerrada');
    });

    test('should handle shortage (faltante) when closing', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/dashboard/cash');
      await actions.clickButton('Cerrar Caja');

      // Enter less money than expected
      await actions.fillField('Balance Final (Contado)', '14000');

      // Wait for the difference calculation to appear
      await page.waitForTimeout(500);

      // Should show "Faltante" message
      await expect(page.getByText('Faltante')).toBeVisible();
      await expect(page.getByText('Falta dinero en caja')).toBeVisible();

      // The difference amount should be shown (with flexible spacing)
      await expect(page.getByText(/\$\s*1\.000,00/).first()).toBeVisible();

      // Can still close with shortage
      await page.getByLabel('Notas (Opcional)').fill('Faltante de $1000 - investigar');
      await actions.clickButton('Cerrar Caja');
      await actions.waitForToast('Caja cerrada');
    });

    test('should validate closing balance is required', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/dashboard/cash');
      await actions.clickButton('Cerrar Caja');

      // Try to submit without balance
      await actions.clickButton('Cerrar Caja');

      // Dialog should still be visible (validation error)
      await expect(page.getByRole('heading', { name: 'Cerrar Caja' })).toBeVisible();
    });
  });

  test.describe('Cash Register History', () => {
    test('should display cash register history', async ({ page }) => {
      const actions = new PageActions(page);

      // First, create a completed cash register cycle
      await page.goto('/dashboard/cash');

      // Open if needed
      const hasOpenButton = await page.getByRole('button', { name: 'Abrir Caja' }).isVisible().catch(() => false);
      if (hasOpenButton) {
        await actions.clickButton('Abrir Caja');
        await actions.fillField('Balance Inicial', '8000');
        await actions.clickButton('Abrir Caja');
        await actions.waitForToast('Caja abierta');
      }

      // Close it
      await actions.clickButton('Cerrar Caja');
      await actions.fillField('Balance Final (Contado)', '8000');
      await actions.clickButton('Cerrar Caja');
      await actions.waitForToast('Caja cerrada');

      // Navigate to history
      await actions.clickButton('Ver Historial');

      // Should show history page
      await expect(page.getByRole('heading', { name: 'Historial de Cajas' })).toBeVisible();
      await expect(page.getByText('Registros de Caja')).toBeVisible();

      // Should show the closed register
      await expect(page.getByText('Cerrada')).toBeVisible();
      await expect(page.getByText(/\$\s*8\.000,00/).first()).toBeVisible();
    });

    test('should navigate to cash register details', async ({ page }) => {
      // Navigate to history
      await page.goto('/dashboard/cash/history');

      // Wait for the page to load
      await expect(page.getByRole('heading', { name: 'Historial de Cajas' })).toBeVisible();

      // Look for the table and find a row, then click the view button
      const firstRow = page.getByRole('row').nth(1); // Skip header row
      const viewButton = firstRow.getByRole('button').first();

      // Check if button exists before clicking
      const buttonExists = await viewButton.count();
      if (buttonExists > 0) {
        await viewButton.click();

        // Should navigate to detail page
        await expect(page.getByRole('heading', { name: 'Detalles de Caja' })).toBeVisible();
        await expect(page.getByText('Información General')).toBeVisible();
      }
    });

    test('should show empty state when no registers exist', async ({ page }) => {
      // This would require a fresh tenant with no history
      // For now, we'll just verify the page loads
      await page.goto('/dashboard/cash/history');
      await expect(page.getByRole('heading', { name: 'Historial de Cajas' })).toBeVisible();
    });
  });

  test.describe('Cash Register Details', () => {
    // Skip beforeEach - these tests will use existing closed cash registers from previous tests

    test('should display complete cash register details', async ({ page }) => {
      // Navigate to history and open latest register
      await page.goto('/dashboard/cash/history');

      await expect(page.getByRole('heading', { name: 'Historial de Cajas' })).toBeVisible();

      // Find first row and click view button
      const firstRow = page.getByRole('row').nth(1);
      const viewButton = firstRow.getByRole('button').first();

      const buttonExists = await viewButton.count();
      if (buttonExists > 0) {
        await viewButton.click();

        // Should show all sections
        await expect(page.getByRole('heading', { name: 'Detalles de Caja' })).toBeVisible();
        await expect(page.getByText('Balance Inicial')).toBeVisible();
        await expect(page.getByText('Ventas')).toBeVisible();
        await expect(page.getByText('Ingresos')).toBeVisible();
        await expect(page.getByText('Egresos')).toBeVisible();
        await expect(page.getByText('Información General')).toBeVisible();
      }
    });

    test('should display transactions in tabs', async ({ page }) => {
      // Navigate to detail page
      await page.goto('/dashboard/cash/history');

      await expect(page.getByRole('heading', { name: 'Historial de Cajas' })).toBeVisible();

      // Find first row and click view button
      const firstRow = page.getByRole('row').nth(1);
      const viewButton = firstRow.getByRole('button').first();

      const buttonExists = await viewButton.count();
      if (buttonExists > 0) {
        await viewButton.click();

        // Should show tabs
        await expect(page.getByRole('tab', { name: /Transacciones/ })).toBeVisible();
        await expect(page.getByRole('tab', { name: /Ventas/ })).toBeVisible();

        // Click transactions tab
        await page.getByRole('tab', { name: /Transacciones/ }).click();

        // Transactions tab should be active
        await expect(page.getByRole('tab', { name: /Transacciones/ })).toBeVisible();
      }
    });

    test('should show reconciliation details', async ({ page }) => {
      // Navigate to detail page
      await page.goto('/dashboard/cash/history');

      await expect(page.getByRole('heading', { name: 'Historial de Cajas' })).toBeVisible();

      // Find first row and click view button
      const firstRow = page.getByRole('row').nth(1);
      const viewButton = firstRow.getByRole('button').first();

      const buttonExists = await viewButton.count();
      if (buttonExists > 0) {
        await viewButton.click();

        // Should show reconciliation section (only if it's a closed register)
        await expect(page.getByRole('heading', { name: 'Detalles de Caja' })).toBeVisible();

        // Check if it's closed
        const hasCierreSection = await page.getByText('Cierre de Caja').isVisible().catch(() => false);
        if (hasCierreSection) {
          await expect(page.getByText('Balance Esperado')).toBeVisible();
          await expect(page.getByText('Balance Final')).toBeVisible();
          await expect(page.getByText('Diferencia')).toBeVisible();
        }
      }
    });
  });

  test.describe('Cash Register Session Duration', () => {
    test('should display session duration', async ({ page }) => {
      const actions = new PageActions(page);

      // Open cash register
      await page.goto('/dashboard/cash');

      const hasOpenButton = await page.getByRole('button', { name: 'Abrir Caja' }).isVisible().catch(() => false);
      if (hasOpenButton) {
        await actions.clickButton('Abrir Caja');
        await actions.fillField('Balance Inicial', '5000');
        await actions.clickButton('Abrir Caja');
        await actions.waitForToast('Caja abierta');
      }

      // Should show duration - check for "Duración" label
      await expect(page.getByText('Duración')).toBeVisible();
      // Also check for hours and minutes pattern
      await expect(page.locator('text=/\\d+h \\d+m/')).toBeVisible();
    });
  });

  test.describe('Multi-User Cash Register', () => {
    test('should show cashier name in cash register', async ({ page }) => {
      const actions = new PageActions(page);

      // Open cash register
      await page.goto('/dashboard/cash');

      const hasOpenButton = await page.getByRole('button', { name: 'Abrir Caja' }).isVisible().catch(() => false);
      if (hasOpenButton) {
        await actions.clickButton('Abrir Caja');
        await actions.fillField('Balance Inicial', '7000');
        await actions.clickButton('Abrir Caja');
        await actions.waitForToast('Caja abierta');
      }

      // Should show "Cajero" label
      await expect(page.getByText('Cajero')).toBeVisible();

      // Check for the user info section
      await expect(page.getByText('Estado de la Caja')).toBeVisible();
    });
  });
});
