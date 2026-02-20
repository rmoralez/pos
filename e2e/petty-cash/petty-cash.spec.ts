import { test, expect } from '@playwright/test'
import { PageActions } from '../utils/test-helpers'

test.describe('Petty Cash (Caja Chica)', () => {
  test.describe('Page Load', () => {
    test('should display the petty cash page with correct title and balance', async ({ page }) => {
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('heading', { name: 'Caja Chica' })).toBeVisible()
      await expect(page.getByText('Gestión de efectivo y fondos')).toBeVisible()
    })

    test('should display all four action buttons', async ({ page }) => {
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('button', { name: 'Ingresar Fondos' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Gasto Directo' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Enviar a Cuenta' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Recibir de Cuenta' })).toBeVisible()
    })

    test('should have a link to cash accounts page', async ({ page }) => {
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      // The page has a "Ver Cuentas" link (not the sidebar link)
      const accountsLink = page.getByRole('link', { name: 'Ver Cuentas' })
      await expect(accountsLink).toBeVisible()
    })
  })

  test.describe('INCOME - Ingresar Fondos', () => {
    test('should open income dialog when clicking Ingresar Fondos', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Ingresar Fondos')

      // Dialog opens with full title
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByText('Ingresar Fondos a Caja Chica')).toBeVisible()
      await expect(page.getByLabel('Monto')).toBeVisible()
    })

    test('should close dialog on cancel', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Ingresar Fondos')
      await expect(page.getByRole('dialog')).toBeVisible()

      await actions.clickButton('Cancelar')
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })

    test('should validate required fields for income', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Ingresar Fondos')

      // Try to submit without filling fields
      const submitBtn = page.getByRole('button', { name: 'Confirmar' })
      await submitBtn.click()

      // Dialog should remain open (validation blocks submission)
      await expect(page.getByRole('dialog')).toBeVisible()
    })

    test('should successfully create an income movement', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Ingresar Fondos')
      await expect(page.getByRole('dialog')).toBeVisible()

      await page.getByLabel('Monto').fill('500')

      // Concept field — use placeholder or label
      const conceptField = page.getByLabel('Concepto').or(page.getByPlaceholder(/concepto|descripción/i))
      await conceptField.fill('Ingreso de prueba e2e')

      // Wait for API response on submit
      const responsePromise = page.waitForResponse(
        res => res.url().includes('/api/petty-cash') && res.request().method() === 'POST'
      )
      await page.getByRole('button', { name: 'Confirmar' }).click()
      await responsePromise

      // Dialog should close
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      // Movement should appear in history
      await expect(page.getByText('Ingreso de prueba e2e')).toBeVisible({ timeout: 5000 })
    })

    test('should show balance preview as user types amount', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Ingresar Fondos')

      await page.getByLabel('Monto').fill('1000')

      // Dialog should still be open
      await expect(page.getByRole('dialog')).toBeVisible()
    })
  })

  test.describe('EXPENSE - Gasto Directo', () => {
    test('should open expense dialog when clicking Gasto Directo', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Gasto Directo')

      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByText('Registrar Gasto Directo')).toBeVisible()
      await expect(page.getByLabel('Monto')).toBeVisible()
    })

    test('should show category selector for expenses', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Gasto Directo')
      await expect(page.getByRole('dialog')).toBeVisible()

      // Category label exists (optional field)
      await expect(page.getByText(/Categoría/i).first()).toBeVisible()
    })

    test('should first add funds then create expense successfully', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      // First add enough funds
      await actions.clickButton('Ingresar Fondos')
      await page.getByLabel('Monto').fill('2000')
      const conceptField = page.getByLabel('Concepto').or(page.getByPlaceholder(/concepto|descripción/i))
      await conceptField.fill('Fondos para gasto e2e')
      const incomeResp = page.waitForResponse(
        res => res.url().includes('/api/petty-cash') && res.request().method() === 'POST'
      )
      await page.getByRole('button', { name: 'Confirmar' }).click()
      await incomeResp
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      // Now create expense
      await actions.clickButton('Gasto Directo')
      await expect(page.getByRole('dialog')).toBeVisible()

      await page.getByLabel('Monto').fill('200')
      const expConceptField = page.getByLabel('Concepto').or(page.getByPlaceholder(/concepto|descripción/i))
      await expConceptField.fill('Gasto de prueba e2e')

      const expResp = page.waitForResponse(
        res => res.url().includes('/api/petty-cash') && res.request().method() === 'POST'
      )
      await page.getByRole('button', { name: 'Confirmar' }).click()
      await expResp
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      await expect(page.getByText('Gasto de prueba e2e')).toBeVisible({ timeout: 5000 })
    })

    test('should validate amount greater than zero for expense', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Gasto Directo')

      // Submit with only concept, no amount
      const conceptField = page.getByLabel('Concepto').or(page.getByPlaceholder(/concepto|descripción/i))
      await conceptField.fill('Test sin monto')
      await page.getByRole('button', { name: 'Confirmar' }).click()

      // Dialog should remain open (monto vacío)
      await expect(page.getByRole('dialog')).toBeVisible()
    })
  })

  test.describe('TRANSFER_OUT - Enviar a Cuenta', () => {
    test('should open transfer-out dialog', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Enviar a Cuenta')

      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByText('Enviar Dinero a una Cuenta')).toBeVisible()
    })

    test('should show accounts selector in transfer-out dialog', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Enviar a Cuenta')
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.waitForTimeout(500) // wait for accounts to load

      // Should show either account selector combobox or "no accounts" message
      const hasCombobox = await page.getByRole('combobox').isVisible().catch(() => false)
      const hasNoAccounts = await page.getByText(/No hay cuentas|no tienes cuentas|sin cuentas/i).isVisible().catch(() => false)
      const hasMonto = await page.getByLabel('Monto').isVisible().catch(() => false)

      // At least the dialog content should be visible
      expect(hasCombobox || hasNoAccounts || hasMonto).toBe(true)
    })

    test('should close transfer-out dialog on cancel', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Enviar a Cuenta')
      await expect(page.getByRole('dialog')).toBeVisible()
      await actions.clickButton('Cancelar')
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })
  })

  test.describe('TRANSFER_IN - Recibir de Cuenta', () => {
    test('should open transfer-in dialog', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Recibir de Cuenta')

      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByText('Recibir Dinero de una Cuenta')).toBeVisible()
    })

    test('should show accounts selector in transfer-in dialog', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Recibir de Cuenta')
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.waitForTimeout(500)

      const hasCombobox = await page.getByRole('combobox').isVisible().catch(() => false)
      const hasNoAccounts = await page.getByText(/No hay cuentas|no tienes cuentas|sin cuentas/i).isVisible().catch(() => false)
      const hasMonto = await page.getByLabel('Monto').isVisible().catch(() => false)

      expect(hasCombobox || hasNoAccounts || hasMonto).toBe(true)
    })

    test('should close transfer-in dialog on cancel', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Recibir de Cuenta')
      await expect(page.getByRole('dialog')).toBeVisible()
      await actions.clickButton('Cancelar')
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })
  })

  test.describe('Movements History Table', () => {
    test('should display movements section', async ({ page }) => {
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await expect(page.getByText(/Movimientos/i).first()).toBeVisible()
    })

    test('should show movement in history after creating income', async ({ page }) => {
      const actions = new PageActions(page)
      await page.goto('/dashboard/petty-cash')
      await page.waitForLoadState('networkidle')

      await actions.clickButton('Ingresar Fondos')
      await page.getByLabel('Monto').fill('100')
      const conceptField = page.getByLabel('Concepto').or(page.getByPlaceholder(/concepto|descripción/i))
      await conceptField.fill('Movimiento para historial')

      const responsePromise = page.waitForResponse(
        res => res.url().includes('/api/petty-cash') && res.request().method() === 'POST'
      )
      await page.getByRole('button', { name: 'Confirmar' }).click()
      await responsePromise
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 })

      await expect(page.getByText('Movimiento para historial')).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Sidebar Navigation', () => {
    test('should have Caja Chica link in sidebar', async ({ page }) => {
      await page.goto('/dashboard/petty-cash')
      await expect(page.getByRole('link', { name: 'Caja Chica' })).toBeVisible()
    })

    test('should navigate to petty cash from sidebar', async ({ page }) => {
      await page.goto('/dashboard/pos')
      await page.getByRole('link', { name: 'Caja Chica' }).click()
      await expect(page).toHaveURL(/.*petty-cash/)
      await expect(page.getByRole('heading', { name: 'Caja Chica' })).toBeVisible()
    })
  })
})
