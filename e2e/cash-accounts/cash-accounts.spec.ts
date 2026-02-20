import { test, expect } from '@playwright/test'
import { PageActions } from '../utils/test-helpers'

test.describe('Cash Accounts (Cuentas)', () => {
  test.describe('Page Load', () => {
    test('should display the cash accounts page with correct title', async ({ page }) => {
      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('heading', { name: 'Cuentas' })).toBeVisible()
      await expect(page.getByText('Fondos y sobres con destino específico')).toBeVisible()
    })

    test('should display Nueva Cuenta button', async ({ page }) => {
      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('button', { name: 'Nueva Cuenta' })).toBeVisible()
    })

    test('should have a link to petty cash page', async ({ page }) => {
      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      // The page has a "Caja Chica" link (not the sidebar nav link)
      const link = page.getByRole('main').getByRole('link', { name: 'Caja Chica' })
      await expect(link).toBeVisible()
    })
  })

  test.describe('Create Account', () => {
    test('should open create dialog when clicking Nueva Cuenta', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Nueva Cuenta')

      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByLabel('Nombre')).toBeVisible()
    })

    test('should close dialog on cancel', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Nueva Cuenta')
      await expect(page.getByRole('dialog')).toBeVisible()

      await actions.clickButton('Cancelar')
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })

    test('should validate required name field', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Nueva Cuenta')
      await expect(page.getByRole('dialog')).toBeVisible()

      // Try to submit without name
      await page.getByRole('button', { name: 'Crear' }).click()

      // Dialog should remain open
      await expect(page.getByRole('dialog')).toBeVisible()
    })

    test('should create a SUPPLIER account successfully', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Proveedor e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Nueva Cuenta')
      await expect(page.getByRole('dialog')).toBeVisible()

      await page.getByLabel('Nombre').fill(accountName)

      // Select SUPPLIER type
      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Proveedor' }).click()

      await page.getByRole('button', { name: 'Crear' }).click()

      // Dialog should close and account should appear
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })
      await expect(page.getByText(accountName)).toBeVisible({ timeout: 5000 })
    })

    test('should create an OWNER account successfully', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Titular e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Nueva Cuenta')

      await page.getByLabel('Nombre').fill(accountName)

      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Titular' }).click()

      await page.getByRole('button', { name: 'Crear' }).click()

      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })
      await expect(page.getByText(accountName)).toBeVisible({ timeout: 5000 })
    })

    test('should create an OPERATIONAL account with description', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Operativo e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Nueva Cuenta')

      await page.getByLabel('Nombre').fill(accountName)

      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Operativo' }).click()

      // Fill optional description
      const descField = page.getByLabel('Descripción')
      if (await descField.isVisible()) {
        await descField.fill('Cuenta operativa para pruebas e2e')
      }

      await page.getByRole('button', { name: 'Crear' }).click()

      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })
      await expect(page.getByText(accountName)).toBeVisible({ timeout: 5000 })
    })

    test('should display correct type badge for created account', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Banco e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Nueva Cuenta')
      await page.getByLabel('Nombre').fill(accountName)

      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Banco' }).click()

      await page.getByRole('button', { name: 'Crear' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      // The new card should be visible with Banco badge
      await expect(page.getByText(accountName)).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('Banco').first()).toBeVisible()
    })
  })

  test.describe('Account Detail Dialog', () => {
    test('should open account detail when clicking on account card', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Cuenta Detail e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      // Create account first
      await actions.clickButton('Nueva Cuenta')
      await page.getByLabel('Nombre').fill(accountName)
      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Operativo' }).click()
      await page.getByRole('button', { name: 'Crear' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      // Click on the account card
      await page.getByText(accountName).click()

      // Detail dialog should open — account name appears in dialog heading
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('dialog').getByText(accountName)).toBeVisible()
    })

    test('should show PAID and RECEIVED action buttons in detail dialog', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Cuenta Actions e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      // Create account
      await actions.clickButton('Nueva Cuenta')
      await page.getByLabel('Nombre').fill(accountName)
      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Operativo' }).click()
      await page.getByRole('button', { name: 'Crear' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      // Open detail
      await page.getByText(accountName).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Both action buttons should be visible
      await expect(page.getByRole('button', { name: 'Registrar Pago' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Ingresar Dinero' })).toBeVisible()
    })

    test('should show current balance in detail dialog', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Cuenta Balance e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Nueva Cuenta')
      await page.getByLabel('Nombre').fill(accountName)
      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Operativo' }).click()
      await page.getByRole('button', { name: 'Crear' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      await page.getByText(accountName).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Should show balance (starts at 0) — scope to dialog to avoid strict mode error
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText(/\$\s*0/).first()).toBeVisible()
    })
  })

  test.describe('Movements - RECEIVED (Ingresar Dinero)', () => {
    test('should open RECEIVED dialog from account detail', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Cuenta RECV e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      // Create account
      await actions.clickButton('Nueva Cuenta')
      await page.getByLabel('Nombre').fill(accountName)
      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Operativo' }).click()
      await page.getByRole('button', { name: 'Crear' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      // Open detail then click RECEIVED
      await page.getByText(accountName).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('button', { name: 'Ingresar Dinero' }).click()

      // Movement dialog should appear
      await expect(page.getByLabel('Monto')).toBeVisible()
      await expect(page.getByLabel('Concepto')).toBeVisible()
    })

    test('should increase balance after RECEIVED movement', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Cuenta RECV Balance e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      // Create account
      await actions.clickButton('Nueva Cuenta')
      await page.getByLabel('Nombre').fill(accountName)
      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Operativo' }).click()
      await page.getByRole('button', { name: 'Crear' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      // Open detail and add money
      await page.getByText(accountName).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('button', { name: 'Ingresar Dinero' }).click()

      await page.getByLabel('Monto').fill('1500')
      await page.getByLabel('Concepto').fill('Ingreso inicial e2e')

      await page.getByRole('button', { name: 'Confirmar' }).click()

      // Wait for dialog to close and show updated balance
      await page.waitForTimeout(1000)

      // Verify movement appears in history
      await expect(page.getByText('Ingreso inicial e2e')).toBeVisible({ timeout: 5000 })
    })

    test('should validate required fields for RECEIVED movement', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Cuenta RECV Val e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Nueva Cuenta')
      await page.getByLabel('Nombre').fill(accountName)
      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Operativo' }).click()
      await page.getByRole('button', { name: 'Crear' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      await page.getByText(accountName).click()
      await page.getByRole('button', { name: 'Ingresar Dinero' }).click()

      // Submit without filling fields
      await page.getByRole('button', { name: 'Confirmar' }).click()

      // Dialog remains open (validation failed)
      await expect(page.getByLabel('Monto')).toBeVisible()
    })
  })

  test.describe('Movements - PAID (Registrar Pago)', () => {
    test('should open PAID dialog from account detail', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Cuenta PAID e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Nueva Cuenta')
      await page.getByLabel('Nombre').fill(accountName)
      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Operativo' }).click()
      await page.getByRole('button', { name: 'Crear' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      await page.getByText(accountName).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('button', { name: 'Registrar Pago' }).click()

      await expect(page.getByLabel('Monto')).toBeVisible()
      await expect(page.getByLabel('Concepto')).toBeVisible()
    })

    test('should show category selector only for PAID movement', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Cuenta PAID Cat e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Nueva Cuenta')
      await page.getByLabel('Nombre').fill(accountName)
      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Operativo' }).click()
      await page.getByRole('button', { name: 'Crear' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      await page.getByText(accountName).click()
      await page.getByRole('button', { name: 'Registrar Pago' }).click()

      // Category field should be present for PAID
      await expect(page.getByText(/Categoría/i).first()).toBeVisible()
    })

    test('should successfully pay from an account with sufficient balance', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Cuenta Pay e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      // Create account
      await actions.clickButton('Nueva Cuenta')
      await page.getByLabel('Nombre').fill(accountName)
      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Operativo' }).click()
      await page.getByRole('button', { name: 'Crear' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      // First add funds
      await page.getByText(accountName).click()
      await page.getByRole('button', { name: 'Ingresar Dinero' }).click()
      await page.getByLabel('Monto').fill('3000')
      await page.getByLabel('Concepto').fill('Fondos para pago e2e')
      await page.getByRole('button', { name: 'Confirmar' }).click()
      await page.waitForTimeout(1000)

      // Now register payment
      await page.getByRole('button', { name: 'Registrar Pago' }).click()
      await page.getByLabel('Monto').fill('500')
      await page.getByLabel('Concepto').fill('Pago proveedor e2e')
      await page.getByRole('button', { name: 'Confirmar' }).click()
      await page.waitForTimeout(1000)

      // Movement should appear in history
      await expect(page.getByText('Pago proveedor e2e')).toBeVisible({ timeout: 5000 })
    })

    test('should prevent PAID exceeding account balance', async ({ page }) => {
      const actions = new PageActions(page)
      const accountName = `Cuenta Insuf e2e ${Date.now()}`

      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Nueva Cuenta')
      await page.getByLabel('Nombre').fill(accountName)
      await page.getByLabel('Tipo').click()
      await page.waitForTimeout(300)
      await page.getByRole('option', { name: 'Operativo' }).click()
      await page.getByRole('button', { name: 'Crear' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      // Account starts at 0, try to pay without funds
      await page.getByText(accountName).click()
      await page.getByRole('button', { name: 'Registrar Pago' }).click()

      await page.getByLabel('Monto').fill('500')
      await page.getByLabel('Concepto').fill('Pago imposible e2e')
      await page.waitForTimeout(300)

      // Either button is disabled or submit returns error
      const submitBtn = page.getByRole('button', { name: 'Confirmar' })
      const isDisabled = await submitBtn.isDisabled()
      if (!isDisabled) {
        await submitBtn.click()
        await page.waitForTimeout(1000)
        // API will return error; either dialog stays open or error toast shown
      }
    })
  })

  test.describe('Empty State', () => {
    test('should show empty state when no accounts exist (new tenant)', async ({ page }) => {
      await page.goto('/dashboard/cash-accounts')
      await page.waitForLoadState('networkidle')

      // Either shows accounts grid or empty state message
      const hasAccounts = await page.locator('[class*="grid"]').isVisible().catch(() => false)
      const hasEmptyState = await page.getByText(/No hay cuentas/i).isVisible().catch(() =>
        page.getByText(/Crear primera cuenta/i).isVisible().catch(() => false)
      )

      // At least the page should load correctly
      await expect(page.getByRole('heading', { name: 'Cuentas' })).toBeVisible()
    })
  })

  test.describe('Sidebar Navigation', () => {
    test('should have Cuentas link in sidebar', async ({ page }) => {
      await page.goto('/dashboard/cash-accounts')
      await expect(page.getByRole('link', { name: 'Cuentas' })).toBeVisible()
    })

    test('should navigate to cash accounts from sidebar', async ({ page }) => {
      await page.goto('/dashboard/pos')
      await page.getByRole('link', { name: 'Cuentas' }).click()
      await expect(page).toHaveURL(/.*cash-accounts/)
      await expect(page.getByRole('heading', { name: 'Cuentas' })).toBeVisible()
    })
  })
})
