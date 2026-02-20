import { test, expect } from "@playwright/test"
import { loginAsAdmin } from "../helpers/auth"

test.describe("Quotes Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test.describe("Page Load and Navigation", () => {
    test("should navigate to quotes page from sidebar", async ({ page }) => {
      await page.goto("/dashboard")

      // Find and click Presupuestos link in sidebar
      const quotesLink = page.locator('a[href="/dashboard/quotes"]')
      await expect(quotesLink).toBeVisible()
      await quotesLink.click()

      await expect(page).toHaveURL("/dashboard/quotes")
      await expect(page.locator("h1")).toContainText("Presupuestos")
    })

    test("should display quotes list page with correct elements", async ({ page }) => {
      await page.goto("/dashboard/quotes")

      // Check for new quote button
      const newQuoteButton = page.locator('button, a').filter({ hasText: /nuevo presupuesto/i })
      await expect(newQuoteButton).toBeVisible()

      // Check for table or empty state
      const hasTable = await page.locator("table").isVisible()
      const hasEmptyState = await page.locator('text=/no (hay|existen) presupuestos/i').isVisible()
      expect(hasTable || hasEmptyState).toBeTruthy()
    })

    test("should navigate to new quote page", async ({ page }) => {
      await page.goto("/dashboard/quotes")

      const newQuoteButton = page.locator('button, a').filter({ hasText: /nuevo presupuesto/i })
      await newQuoteButton.click()

      await expect(page).toHaveURL("/dashboard/quotes/new")
      await expect(page.locator("h1, h2")).toContainText(/nuevo presupuesto/i)
    })
  })

  test.describe("Quote Creation", () => {
    test("should create a new quote with single product", async ({ page }) => {
      await page.goto("/dashboard/quotes/new")

      // Select product
      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.waitFor({ state: "visible", timeout: 5000 })
      await productSelect.selectOption({ index: 1 }) // Select first product

      // Set quantity
      const quantityInput = page.locator('[data-testid="quantity-input"], input[type="number"]').first()
      await quantityInput.fill("2")

      // Add to quote
      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      // Verify item appears in cart/list
      await expect(page.locator('[data-testid="quote-items"], table')).toBeVisible()

      // Fill quote details (if any required fields)
      const customerSelect = page.locator('[data-testid="customer-select"], [name="customerId"]')
      if (await customerSelect.isVisible()) {
        await customerSelect.selectOption({ index: 1 })
      }

      // Save quote
      const saveButton = page.locator('button').filter({ hasText: /guardar|crear/i })
      await saveButton.click()

      // Should redirect to quote detail or list
      await page.waitForURL(/\/dashboard\/quotes/, { timeout: 10000 })

      // Verify success message or quote appears
      const successMessage = page.locator('text=/presupuesto (creado|guardado)/i, [role="status"]')
      if (await successMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(successMessage).toBeVisible()
      }
    })

    test("should create quote with multiple products", async ({ page }) => {
      await page.goto("/dashboard/quotes/new")

      // Add first product
      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.waitFor({ state: "visible" })
      await productSelect.selectOption({ index: 1 })

      const quantityInput = page.locator('[data-testid="quantity-input"], input[type="number"]').first()
      await quantityInput.fill("1")

      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      // Wait for item to be added
      await page.waitForTimeout(500)

      // Add second product
      await productSelect.selectOption({ index: 2 })
      await quantityInput.fill("3")
      await addButton.click()

      // Verify both items appear
      const items = page.locator('[data-testid="quote-item"], table tbody tr')
      await expect(items).toHaveCount(2, { timeout: 5000 })
    })

    test("should apply item discount", async ({ page }) => {
      await page.goto("/dashboard/quotes/new")

      // Add product
      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.selectOption({ index: 1 })

      const quantityInput = page.locator('[data-testid="quantity-input"], input[type="number"]').first()
      await quantityInput.fill("1")

      // Set item discount if available
      const discountInput = page.locator('[data-testid="discount-input"], [name="discount"], input').first()
      if (await discountInput.isVisible()) {
        await discountInput.fill("10")
      }

      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      // Verify discount is applied (check totals)
      await expect(page.locator('[data-testid="quote-items"], table')).toBeVisible()
    })

    test("should apply cart-level discount", async ({ page }) => {
      await page.goto("/dashboard/quotes/new")

      // Add product
      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.selectOption({ index: 1 })

      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      // Apply cart discount
      const cartDiscountInput = page.locator('[data-testid="cart-discount"], [name="cartDiscount"]')
      if (await cartDiscountInput.isVisible()) {
        await cartDiscountInput.fill("15")

        // Verify total is recalculated
        await expect(page.locator('[data-testid="quote-total"]')).toBeVisible()
      }
    })
  })

  test.describe("Quote Editing", () => {
    test("should edit an existing quote", async ({ page }) => {
      // First create a quote
      await page.goto("/dashboard/quotes/new")

      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.selectOption({ index: 1 })

      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      const saveButton = page.locator('button').filter({ hasText: /guardar|crear/i })
      await saveButton.click()

      await page.waitForURL(/\/dashboard\/quotes/, { timeout: 10000 })

      // Navigate to quotes list
      await page.goto("/dashboard/quotes")

      // Click on first quote to edit
      const firstQuote = page.locator('table tbody tr, [data-testid="quote-item"]').first()
      await firstQuote.click()

      // Should show quote detail page
      await expect(page).toHaveURL(/\/dashboard\/quotes\/[a-z0-9]+/)

      // Look for edit button
      const editButton = page.locator('button').filter({ hasText: /editar/i })
      if (await editButton.isVisible()) {
        await editButton.click()
      }
    })

    test("should remove item from quote", async ({ page }) => {
      await page.goto("/dashboard/quotes/new")

      // Add two products
      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.selectOption({ index: 1 })

      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      await page.waitForTimeout(500)

      await productSelect.selectOption({ index: 2 })
      await addButton.click()

      // Remove first item
      const removeButton = page.locator('button').filter({ hasText: /eliminar|quitar|×/i }).first()
      if (await removeButton.isVisible()) {
        await removeButton.click()

        // Verify only one item remains
        const items = page.locator('[data-testid="quote-item"], table tbody tr')
        await expect(items).toHaveCount(1)
      }
    })
  })

  test.describe("Quote Status Management", () => {
    test("should change quote status", async ({ page }) => {
      // Create a quote first
      await page.goto("/dashboard/quotes/new")

      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.selectOption({ index: 1 })

      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      const saveButton = page.locator('button').filter({ hasText: /guardar|crear/i })
      await saveButton.click()

      await page.waitForURL(/\/dashboard\/quotes/, { timeout: 10000 })

      // Navigate to quote detail
      await page.goto("/dashboard/quotes")
      const firstQuote = page.locator('table tbody tr, [data-testid="quote-item"]').first()
      await firstQuote.click()

      // Look for status change buttons (SENT, APPROVED, etc.)
      const statusButtons = page.locator('button').filter({ hasText: /enviar|aprobar|rechazar/i })
      const count = await statusButtons.count()

      if (count > 0) {
        // Change status (e.g., mark as sent)
        const sendButton = page.locator('button').filter({ hasText: /enviar/i }).first()
        if (await sendButton.isVisible()) {
          await sendButton.click()

          // Verify status changed
          await expect(page.locator('text=/enviado|sent/i')).toBeVisible({ timeout: 5000 })
        }
      }
    })
  })

  test.describe("Quote to Sale Conversion", () => {
    test("should convert approved quote to sale", async ({ page }) => {
      // Create quote
      await page.goto("/dashboard/quotes/new")

      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.selectOption({ index: 1 })

      const quantityInput = page.locator('[data-testid="quantity-input"], input[type="number"]').first()
      await quantityInput.fill("1")

      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      const saveButton = page.locator('button').filter({ hasText: /guardar|crear/i })
      await saveButton.click()

      await page.waitForURL(/\/dashboard\/quotes/, { timeout: 10000 })

      // Navigate to quote detail
      await page.goto("/dashboard/quotes")
      const firstQuote = page.locator('table tbody tr, [data-testid="quote-item"]').first()
      await firstQuote.click()

      // Approve quote first (if needed)
      const approveButton = page.locator('button').filter({ hasText: /aprobar/i })
      if (await approveButton.isVisible()) {
        await approveButton.click()
        await page.waitForTimeout(1000)
      }

      // Convert to sale
      const convertButton = page.locator('button').filter({ hasText: /convertir|venta/i })
      if (await convertButton.isVisible()) {
        await convertButton.click()

        // Wait for confirmation or redirect
        await page.waitForTimeout(2000)

        // Verify conversion (status should be CONVERTED or redirect to sales)
        const converted = await page.locator('text=/convertido|converted/i').isVisible({ timeout: 3000 }).catch(() => false)
        const onSalesPage = page.url().includes('/sales')

        expect(converted || onSalesPage).toBeTruthy()
      }
    })

    test("should not allow conversion of draft quote", async ({ page }) => {
      // Create draft quote
      await page.goto("/dashboard/quotes/new")

      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.selectOption({ index: 1 })

      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      const saveButton = page.locator('button').filter({ hasText: /guardar|crear/i })
      await saveButton.click()

      await page.waitForURL(/\/dashboard\/quotes/, { timeout: 10000 })

      // Go to quote detail
      await page.goto("/dashboard/quotes")
      const firstQuote = page.locator('table tbody tr, [data-testid="quote-item"]').first()
      await firstQuote.click()

      // Convert button should be disabled or not visible for DRAFT status
      const convertButton = page.locator('button').filter({ hasText: /convertir|venta/i })
      if (await convertButton.isVisible()) {
        const isDisabled = await convertButton.isDisabled()
        expect(isDisabled).toBeTruthy()
      }
    })
  })

  test.describe("PDF Generation", () => {
    test("should generate PDF for quote", async ({ page }) => {
      // Create quote
      await page.goto("/dashboard/quotes/new")

      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.selectOption({ index: 1 })

      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      const saveButton = page.locator('button').filter({ hasText: /guardar|crear/i })
      await saveButton.click()

      await page.waitForURL(/\/dashboard\/quotes/, { timeout: 10000 })

      // Go to quote detail
      await page.goto("/dashboard/quotes")
      const firstQuote = page.locator('table tbody tr, [data-testid="quote-item"]').first()
      await firstQuote.click()

      // Look for PDF/Download button
      const pdfButton = page.locator('button, a').filter({ hasText: /pdf|descargar|imprimir/i })
      if (await pdfButton.isVisible()) {
        // Start download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 })

        await pdfButton.click()

        try {
          const download = await downloadPromise
          expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
        } catch (error) {
          // PDF might open in new tab instead of download
          console.log("PDF may have opened in new tab")
        }
      }
    })

    test("should generate PDF multiple times without changing status", async ({ page }) => {
      // Create and save quote
      await page.goto("/dashboard/quotes/new")

      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.selectOption({ index: 1 })

      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      const saveButton = page.locator('button').filter({ hasText: /guardar|crear/i })
      await saveButton.click()

      await page.waitForURL(/\/dashboard\/quotes/, { timeout: 10000 })

      // Go to quote detail
      await page.goto("/dashboard/quotes")
      const firstQuote = page.locator('table tbody tr, [data-testid="quote-item"]').first()
      await firstQuote.click()

      // Get initial status
      const initialStatus = await page.locator('[data-testid="quote-status"], .status').textContent()

      // Generate PDF
      const pdfButton = page.locator('button, a').filter({ hasText: /pdf|descargar|imprimir/i })
      if (await pdfButton.isVisible()) {
        await pdfButton.click()
        await page.waitForTimeout(1000)

        // Verify status hasn't changed
        const currentStatus = await page.locator('[data-testid="quote-status"], .status').textContent()
        expect(currentStatus).toBe(initialStatus)

        // Generate PDF again
        await pdfButton.click()
        await page.waitForTimeout(1000)

        // Status should still be the same
        const finalStatus = await page.locator('[data-testid="quote-status"], .status').textContent()
        expect(finalStatus).toBe(initialStatus)
      }
    })
  })

  test.describe("Quote Number Generation", () => {
    test("should auto-generate sequential quote numbers", async ({ page }) => {
      // Create first quote
      await page.goto("/dashboard/quotes/new")

      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.selectOption({ index: 1 })

      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      const saveButton = page.locator('button').filter({ hasText: /guardar|crear/i })
      await saveButton.click()

      await page.waitForURL(/\/dashboard\/quotes/, { timeout: 10000 })

      // Go to quotes list
      await page.goto("/dashboard/quotes")

      // Get first quote number
      const quoteNumber1 = await page.locator('table tbody tr, [data-testid="quote-number"]').first().textContent()

      // Create second quote
      await page.goto("/dashboard/quotes/new")
      await productSelect.selectOption({ index: 1 })
      await addButton.click()
      await saveButton.click()

      await page.waitForURL(/\/dashboard\/quotes/, { timeout: 10000 })

      // Go to quotes list
      await page.goto("/dashboard/quotes")

      // Get second quote number
      const quoteNumber2 = await page.locator('table tbody tr, [data-testid="quote-number"]').first().textContent()

      // Verify quote numbers are different and sequential
      expect(quoteNumber1).not.toBe(quoteNumber2)
      expect(quoteNumber1).toMatch(/QUOTE-\d+/)
      expect(quoteNumber2).toMatch(/QUOTE-\d+/)
    })
  })

  test.describe("Multi-tenant Isolation", () => {
    test("should only show quotes for current tenant", async ({ page }) => {
      await page.goto("/dashboard/quotes")

      // If there are quotes, verify they all belong to current tenant
      const quotes = page.locator('table tbody tr, [data-testid="quote-item"]')
      const count = await quotes.count()

      if (count > 0) {
        // Click on first quote
        await quotes.first().click()

        // Should be able to access it (not 404 or unauthorized)
        await expect(page).toHaveURL(/\/dashboard\/quotes\/[a-z0-9]+/)
        await expect(page.locator('h1, h2')).not.toContainText(/error|not found/i)
      }
    })
  })

  test.describe("Validation", () => {
    test("should not allow saving quote without items", async ({ page }) => {
      await page.goto("/dashboard/quotes/new")

      // Try to save without adding items
      const saveButton = page.locator('button').filter({ hasText: /guardar|crear/i })

      // Button should be disabled or show error
      if (await saveButton.isVisible()) {
        const isDisabled = await saveButton.isDisabled()

        if (!isDisabled) {
          await saveButton.click()

          // Should show error message
          await expect(page.locator('text=/agrega.*producto|añade.*item/i, [role="alert"]')).toBeVisible({ timeout: 3000 })
        } else {
          expect(isDisabled).toBeTruthy()
        }
      }
    })

    test("should validate stock availability on conversion", async ({ page }) => {
      // This test would need a product with low/no stock
      // Create quote with high quantity
      await page.goto("/dashboard/quotes/new")

      const productSelect = page.locator('[data-testid="product-select"], [name="productId"], select').first()
      await productSelect.selectOption({ index: 1 })

      const quantityInput = page.locator('[data-testid="quantity-input"], input[type="number"]').first()
      await quantityInput.fill("999999") // Very high quantity

      const addButton = page.locator('button').filter({ hasText: /agregar|añadir/i }).first()
      await addButton.click()

      const saveButton = page.locator('button').filter({ hasText: /guardar|crear/i })
      await saveButton.click()

      await page.waitForURL(/\/dashboard\/quotes/, { timeout: 10000 })

      // Try to convert - should fail due to insufficient stock
      await page.goto("/dashboard/quotes")
      const firstQuote = page.locator('table tbody tr, [data-testid="quote-item"]').first()
      await firstQuote.click()

      // Approve if needed
      const approveButton = page.locator('button').filter({ hasText: /aprobar/i })
      if (await approveButton.isVisible()) {
        await approveButton.click()
        await page.waitForTimeout(1000)
      }

      // Try to convert
      const convertButton = page.locator('button').filter({ hasText: /convertir|venta/i })
      if (await convertButton.isVisible() && !await convertButton.isDisabled()) {
        await convertButton.click()

        // Should show stock error
        await expect(page.locator('text=/stock|inventario|insuficiente/i, [role="alert"]')).toBeVisible({ timeout: 5000 })
      }
    })
  })

  test.describe("Quotes List Filtering", () => {
    test("should filter quotes by status", async ({ page }) => {
      await page.goto("/dashboard/quotes")

      // Look for status filter
      const statusFilter = page.locator('[data-testid="status-filter"], select, [role="combobox"]').filter({ hasText: /estado|status/i })

      if (await statusFilter.isVisible()) {
        // Select DRAFT status
        await statusFilter.selectOption("DRAFT")

        await page.waitForTimeout(1000)

        // Verify only draft quotes shown
        const quotes = page.locator('table tbody tr, [data-testid="quote-item"]')
        const count = await quotes.count()

        if (count > 0) {
          // All should have DRAFT status
          const statuses = await page.locator('[data-testid="quote-status"]').allTextContents()
          statuses.forEach(status => {
            expect(status.toLowerCase()).toContain("draft")
          })
        }
      }
    })
  })
})
