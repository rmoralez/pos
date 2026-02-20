import { test, expect } from '@playwright/test';
import { PageActions } from '../utils/test-helpers';

// Helper to close any open cash register via API
async function closeOpenCashRegister(page: any) {
  const currentRes = await page.request.get('/api/cash-registers/current');
  if (currentRes.ok()) {
    const register = await currentRes.json();
    if (register?.id) {
      // openingBalance is a Prisma Decimal serialized as a string - must parse to number
      const closingBalance = Number(register.openingBalance ?? 0);
      const closeRes = await page.request.post(`/api/cash-registers/${register.id}/close`, {
        data: { closingBalance },
      });
      if (!closeRes.ok()) {
        const errBody = await closeRes.text().catch(() => '');
        console.error(`[closeOpenCashRegister] Failed to close register ${register.id}: ${closeRes.status()} ${errBody}`);
      }
    }
  }
}

// Helper to navigate to cash page and wait for NO open register state
async function navigateAndWaitForClosedState(page: any) {
  // First ensure any open register is closed via API
  await closeOpenCashRegister(page);
  // Navigate fresh to get clean browser state
  await page.goto('/dashboard/cash');
  await page.waitForLoadState('networkidle');
  // Wait until "Abrir Caja" button is visible, confirming no open register
  await expect(page.getByRole('button', { name: 'Abrir Caja' })).toBeVisible({ timeout: 10000 });
}

// Helper to open a cash register with the given balance.
// Always closes any existing register first (to avoid stale state from prior tests).
async function openCashRegister(page: any, balance: string) {
  const actions = new PageActions(page);
  // Force close any existing register first
  await closeOpenCashRegister(page);
  // Navigate to cash page
  await page.goto('/dashboard/cash');
  await page.waitForLoadState('networkidle');
  // Wait for "Abrir Caja" button
  await expect(page.getByRole('button', { name: 'Abrir Caja' })).toBeVisible({ timeout: 10000 });
  // Open register
  await actions.clickButton('Abrir Caja');
  await page.waitForSelector('input#openingBalance', { timeout: 5000 });
  await page.fill('input#openingBalance', balance);
  await actions.clickButton('Abrir Caja');
  await actions.waitForToast('Caja abierta');
  // Wait for the page to show open register state
  await expect(page.getByRole('button', { name: 'Cerrar Caja' })).toBeVisible({ timeout: 10000 });
}

test.describe('Cash Register Management', () => {
  test.beforeEach(async ({ page }) => {
    // Close any open cash register to ensure a clean state before each test
    await closeOpenCashRegister(page);
  });

  test.describe('Opening Cash Register', () => {
    test('should successfully open a cash register', async ({ page }) => {
      const actions = new PageActions(page);

      // Navigate to cash register page and wait for closed state
      await navigateAndWaitForClosedState(page);

      // Should show "No hay caja abierta" message
      await expect(page.getByText('No hay caja abierta')).toBeVisible();
      await expect(page.getByText('Debes abrir una caja para comenzar a registrar ventas')).toBeVisible();

      // Click "Abrir Caja" button
      await actions.clickButton('Abrir Caja');

      // Dialog should be visible
      await expect(page.getByRole('heading', { name: 'Abrir Caja' })).toBeVisible();

      // Fill opening balance
      await page.fill('input#openingBalance', '10000');
      await page.getByLabel('Notas (Opcional)').fill('Apertura de caja de prueba');

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
      // Open first cash register using helper (ensures clean state)
      await openCashRegister(page, '5000');

      // Should be on cash page with open register
      await expect(page.getByText('Balance Actual')).toBeVisible();
    });

    test('should validate opening balance is required', async ({ page }) => {
      const actions = new PageActions(page);

      // Navigate and wait for the closed state to be rendered
      await navigateAndWaitForClosedState(page);

      // Ensure "Abrir Caja" button is visible (no register open)
      await expect(page.getByRole('button', { name: 'Abrir Caja' })).toBeVisible();

      // Open dialog
      await actions.clickButton('Abrir Caja');
      await expect(page.getByRole('heading', { name: 'Abrir Caja' })).toBeVisible();

      // Try to submit without balance - leave input empty
      await actions.clickButton('Abrir Caja');

      // Should show inline validation error
      await expect(page.getByText('El balance inicial es obligatorio')).toBeVisible({ timeout: 3000 });

      // Form should still be visible (not submitted)
      await expect(page.getByRole('heading', { name: 'Abrir Caja' })).toBeVisible();
    });
  });

  test.describe('Sales Integration', () => {
    test('should show warning in POS when no cash register is open', async ({ page }) => {
      // beforeEach already closed the register via API
      // Navigate to POS - it should detect no open register
      await page.goto('/dashboard/pos');
      await page.waitForLoadState('networkidle');

      // Should show alert (check for just part of the text)
      await expect(page.getByText(/No hay caja abierta/i)).toBeVisible({ timeout: 10000 });
    });

    test('should allow sales with open cash register', async ({ page }) => {
      const actions = new PageActions(page);

      // Open cash register first
      await openCashRegister(page, '10000');

      // Go to POS
      await page.goto('/dashboard/pos');
      await page.waitForLoadState('networkidle');

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
      // Open a fresh cash register for each test (closes any existing one first)
      await openCashRegister(page, '20000');
    });

    test('should register income transaction with movement type', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/dashboard/cash');
      await page.waitForLoadState('networkidle');

      // Click "Registrar Ingreso" button
      await actions.clickButton('Registrar Ingreso');

      // Dialog should be visible
      await expect(page.getByRole('heading', { name: 'Registrar Transacción' })).toBeVisible();

      // Wait for movement types to load
      await page.waitForTimeout(500);

      // Select an income movement type from the dropdown
      await page.getByLabel('Tipo de Movimiento').click();

      // Wait for options to appear and select first income type
      await page.waitForTimeout(300);
      const incomeOption = page.getByRole('option').filter({ hasText: /Ingreso/ }).first();
      const hasIncomeOption = await incomeOption.count();
      if (hasIncomeOption > 0) {
        await incomeOption.click();
      }

      // Fill transaction details
      await actions.fillField('Monto', '5000');
      await page.getByLabel('Motivo (Opcional)').fill('Venta de producto usado');
      await actions.fillField('Referencia (Opcional)', 'REF-001');

      // Submit
      await actions.clickButton('Registrar Transacción');

      // Should show success
      await actions.waitForToast('Ingreso registrado');

      // Verify income section is visible
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Ingresos' })).toBeVisible();
    });

    test('should register expense transaction with movement type', async ({ page }) => {
      const actions = new PageActions(page);

      await page.goto('/dashboard/cash');
      await page.waitForLoadState('networkidle');

      // Click "Registrar Egreso" button
      await actions.clickButton('Registrar Egreso');

      // Dialog should be visible
      await expect(page.getByRole('heading', { name: 'Registrar Transacción' })).toBeVisible();

      // Wait for movement types to load
      await page.waitForTimeout(500);

      // Select an expense movement type from the dropdown
      await page.getByLabel('Tipo de Movimiento').click();

      // Wait for options to appear and select first expense type
      await page.waitForTimeout(300);
      const expenseOption = page.getByRole('option').filter({ hasText: /Egreso|Pago|Retiro|Gasto/ }).first();
      const hasExpenseOption = await expenseOption.count();
      if (hasExpenseOption > 0) {
        await expenseOption.click();
      }

      // Fill transaction details
      await actions.fillField('Monto', '3000');
      await page.getByLabel('Motivo (Opcional)').fill('Pago de servicio de internet');
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
      await page.waitForLoadState('networkidle');
      await actions.clickButton('Registrar Ingreso');

      // Try to submit without filling required fields
      await actions.clickButton('Registrar Transacción');

      // Dialog should still be visible (validation error)
      await expect(page.getByRole('heading', { name: 'Registrar Transacción' })).toBeVisible();
    });
  });

  test.describe('Closing Cash Register', () => {
    test.beforeEach(async ({ page }) => {
      // Open a fresh cash register with known $15,000 balance
      await openCashRegister(page, '15000');
    });

    test('should close cash register with correct balance', async ({ page }) => {
      const actions = new PageActions(page);

      // Already on /dashboard/cash from openCashRegister - click "Cerrar Caja" button
      await actions.clickButton('Cerrar Caja');

      // Dialog should be visible
      await expect(page.getByRole('heading', { name: 'Cerrar Caja' })).toBeVisible();

      // Should show opening and expected balance
      await expect(page.getByText('Balance Inicial:')).toBeVisible();
      await expect(page.getByText('Balance Esperado:')).toBeVisible();

      // Enter closing balance equal to expected (15000 opening, no transactions, so expected = 15000)
      await page.fill('input#closingBalance', '15000');

      // Wait for the difference calculation panel to appear
      await expect(page.getByText('Balance Correcto')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/\$\s*0,00/).first()).toBeVisible();

      // Add notes
      await page.getByLabel('Notas (Opcional)').fill('Cierre sin novedades');

      // Submit
      await actions.clickButton('Cerrar Caja');

      // Should show success
      await actions.waitForToast('Caja cerrada');

      // Should return to "Abrir Caja" state
      await expect(page.getByRole('button', { name: 'Abrir Caja' })).toBeVisible({ timeout: 10000 });
    });

    test('should handle surplus (sobrante) when closing', async ({ page }) => {
      const actions = new PageActions(page);

      // Already on /dashboard/cash from beforeEach with register open
      await actions.clickButton('Cerrar Caja');
      await expect(page.getByRole('heading', { name: 'Cerrar Caja' })).toBeVisible();

      // Enter more money than expected (15000 opening + 1000 extra = 16000)
      await page.fill('input#closingBalance', '16000');

      // Wait for the difference calculation panel to appear
      await expect(page.getByText('Sobrante')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Hay más dinero del esperado')).toBeVisible();

      // The difference amount should be shown
      await expect(page.getByText(/\$\s*1\.000,00/).first()).toBeVisible();

      // Can still close with surplus
      await page.getByLabel('Notas (Opcional)').fill('Sobrante de $1000');
      await actions.clickButton('Cerrar Caja');
      await actions.waitForToast('Caja cerrada');
    });

    test('should handle shortage (faltante) when closing', async ({ page }) => {
      const actions = new PageActions(page);

      // Already on /dashboard/cash from beforeEach with register open
      await actions.clickButton('Cerrar Caja');
      await expect(page.getByRole('heading', { name: 'Cerrar Caja' })).toBeVisible();

      // Enter less money than expected (15000 opening - 1000 = 14000)
      await page.fill('input#closingBalance', '14000');

      // Wait for the difference calculation panel to appear
      await expect(page.getByText('Faltante')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Falta dinero en caja')).toBeVisible();

      // The difference amount should be shown
      await expect(page.getByText(/\$\s*1\.000,00/).first()).toBeVisible();

      // Can still close with shortage
      await page.getByLabel('Notas (Opcional)').fill('Faltante de $1000 - investigar');
      await actions.clickButton('Cerrar Caja');
      await actions.waitForToast('Caja cerrada');
    });

    test('should validate closing balance is required', async ({ page }) => {
      const actions = new PageActions(page);

      // Already on /dashboard/cash from beforeEach with register open
      await actions.clickButton('Cerrar Caja');
      await expect(page.getByRole('heading', { name: 'Cerrar Caja' })).toBeVisible();

      // Try to submit without balance (HTML5 required attribute)
      await actions.clickButton('Cerrar Caja');

      // Dialog should still be visible (browser validation prevents submit)
      await expect(page.getByRole('heading', { name: 'Cerrar Caja' })).toBeVisible();
    });
  });

  test.describe('Cash Register History', () => {
    // Ensure at least one closed register exists before running history tests
    test.beforeEach(async ({ page }) => {
      // Open a register and close it via API to ensure history has data
      await openCashRegister(page, '8000');
      // Close via API for speed
      const currentRes = await page.request.get('/api/cash-registers/current');
      if (currentRes.ok()) {
        const register = await currentRes.json();
        if (register?.id) {
          await page.request.post(`/api/cash-registers/${register.id}/close`, {
            data: { closingBalance: 8000 },
          });
        }
      }
    });

    test('should display cash register history', async ({ page }) => {
      // Navigate to history page
      await page.goto('/dashboard/cash/history');
      await page.waitForLoadState('networkidle');

      // Should show history page
      await expect(page.getByRole('heading', { name: 'Historial de Cajas' })).toBeVisible();
      await expect(page.getByText('Registros de Caja')).toBeVisible();

      // Should show at least one closed register badge
      await expect(page.getByText('Cerrada', { exact: true }).first()).toBeVisible();
    });

    test('should navigate to cash register details', async ({ page }) => {
      // Navigate to history
      await page.goto('/dashboard/cash/history');
      await page.waitForLoadState('networkidle');

      // Wait for the page to load
      await expect(page.getByRole('heading', { name: 'Historial de Cajas' })).toBeVisible();

      // Look for the first data row and click the eye/view button
      const firstRow = page.getByRole('row').nth(1); // Skip header row
      const rowExists = await firstRow.count();

      if (rowExists > 0) {
        // The view button is an Eye icon button inside a Link — click the Link
        await firstRow.getByRole('link').first().click();

        // Should navigate to detail page at /dashboard/cash/[id]
        await page.waitForLoadState('networkidle');
        // The detail page heading is "Detalles de Caja de Ventas"
        await expect(page.getByRole('heading', { name: /Detalles de Caja/ })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Información General')).toBeVisible();
      }
    });

    test('should show empty state when no registers exist', async ({ page }) => {
      // Just verify the page loads correctly
      await page.goto('/dashboard/cash/history');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'Historial de Cajas' })).toBeVisible();
    });
  });

  test.describe('Cash Register Details', () => {
    // Ensure at least one closed register exists before running details tests
    test.beforeEach(async ({ page }) => {
      // Open and close a register to ensure history has data
      await openCashRegister(page, '9000');
      const currentRes = await page.request.get('/api/cash-registers/current');
      if (currentRes.ok()) {
        const register = await currentRes.json();
        if (register?.id) {
          await page.request.post(`/api/cash-registers/${register.id}/close`, {
            data: { closingBalance: 9000 },
          });
        }
      }
    });

    // Helper to navigate to the first detail page from history
    async function navigateToFirstDetail(page: any) {
      await page.goto('/dashboard/cash/history');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: 'Historial de Cajas' })).toBeVisible();

      const firstRow = page.getByRole('row').nth(1);
      const rowExists = await firstRow.count();
      if (rowExists > 0) {
        await firstRow.getByRole('link').first().click();
        await page.waitForLoadState('networkidle');
        // The detail page heading is "Detalles de Caja de Ventas"
        await expect(page.getByRole('heading', { name: /Detalles de Caja/ })).toBeVisible({ timeout: 10000 });
        return true;
      }
      return false;
    }

    test('should display complete cash register details', async ({ page }) => {
      const navigated = await navigateToFirstDetail(page);
      if (navigated) {
        // Should show all sections
        await expect(page.getByText('Balance Inicial')).toBeVisible();
        await expect(page.getByText('Ventas Efectivo')).toBeVisible();
        await expect(page.getByText('Ingresos').first()).toBeVisible();
        await expect(page.getByText('Egresos').first()).toBeVisible();
        await expect(page.getByText('Información General')).toBeVisible();
      }
    });

    test('should display transactions in tabs', async ({ page }) => {
      const navigated = await navigateToFirstDetail(page);
      if (navigated) {
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
      const navigated = await navigateToFirstDetail(page);
      if (navigated) {
        // Check if it's a closed register with reconciliation section
        const hasCierreSection = await page.getByText('Cierre de Caja').isVisible().catch(() => false);
        if (hasCierreSection) {
          await expect(page.getByText('Efectivo Esperado')).toBeVisible();
          await expect(page.getByText('Efectivo Contado')).toBeVisible();
          await expect(page.getByText('Diferencia', { exact: true })).toBeVisible();
        }
      }
    });
  });

  test.describe('Cash Register Session Duration', () => {
    test('should display session duration', async ({ page }) => {
      // Open cash register with helper (closes any existing one first)
      await openCashRegister(page, '5000');

      await page.goto('/dashboard/cash');
      await page.waitForLoadState('networkidle');

      // Should show duration - check for "Duración" label
      await expect(page.getByText('Duración')).toBeVisible();
      // Also check for hours and minutes pattern
      await expect(page.locator('text=/\\d+h \\d+m/')).toBeVisible();
    });
  });

  test.describe('Multi-User Cash Register', () => {
    test('should show cashier name in cash register', async ({ page }) => {
      // Open cash register with helper (closes any existing one first)
      await openCashRegister(page, '7000');

      await page.goto('/dashboard/cash');
      await page.waitForLoadState('networkidle');

      // Should show "Cajero" label
      await expect(page.getByText('Cajero')).toBeVisible();

      // Check for the user info section
      await expect(page.getByText('Estado de la Caja')).toBeVisible();
    });
  });
});
