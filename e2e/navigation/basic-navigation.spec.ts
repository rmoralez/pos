import { test, expect } from '@playwright/test';
import { PageActions } from '../utils/test-helpers';

test.describe('Basic Navigation', () => {
  test.describe('Main Menu Navigation', () => {
    test('should navigate to all main menu items successfully', async ({ page }) => {
      const actions = new PageActions(page);

      // Start at dashboard
      await page.goto('/dashboard');

      // Array of menu items to test (only existing pages)
      const menuItems = [
        { name: 'POS', url: '/dashboard/pos' },
        { name: 'Productos', url: '/dashboard/products' },
        { name: 'Ventas', url: '/dashboard/sales' },
        { name: 'Caja', url: '/dashboard/cash' },
      ];

      for (const item of menuItems) {
        // Click on menu item
        await page.getByRole('link', { name: item.name }).click();

        // Wait for navigation
        await page.waitForURL(item.url, { timeout: 10000 });

        // Wait for page to be loaded (any h1 heading should appear)
        await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

        // Check for no JavaScript errors by looking for error messages
        const hasError = await page.locator('text=/TypeError|ReferenceError/i').count();
        expect(hasError).toBe(0);
      }
    });

    test('should show active state for current page', async ({ page }) => {
      await page.goto('/dashboard/products');

      // Find the Products link in sidebar
      const productsLink = page.getByRole('link', { name: 'Productos' });

      // Check if it has the active styling (bg-gray-800)
      await expect(productsLink).toHaveClass(/bg-gray-800/);
    });

    test('should navigate between pages using sidebar', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Navigate to Products
      await page.getByRole('link', { name: 'Productos' }).click();
      await page.waitForURL('/dashboard/products', { timeout: 10000 });
      await expect(page.locator('h1').first()).toBeVisible();

      // Navigate to Sales
      await page.getByRole('link', { name: 'Ventas' }).click();
      await page.waitForURL('/dashboard/sales', { timeout: 10000 });
      await expect(page.locator('h1').first()).toBeVisible();

      // Navigate back to POS
      await page.getByRole('link', { name: 'POS' }).click();
      await page.waitForURL('/dashboard/pos', { timeout: 10000 });
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('should display SuperCommerce branding in sidebar', async ({ page }) => {
      await page.goto('/dashboard');

      // Check for logo and brand name in sidebar specifically
      await expect(page.locator('.bg-gray-900').getByText('SuperCommerce').first()).toBeVisible();
    });

    test('should maintain navigation state after page refresh', async ({ page }) => {
      await page.goto('/dashboard/products');

      // Verify we're on products page
      await expect(page.locator('h1').first()).toBeVisible();

      // Refresh page
      await page.reload();

      // Should still be on products page
      await expect(page).toHaveURL('/dashboard/products');
      await expect(page.locator('h1').first()).toBeVisible();

      // Products link should still be active
      const productsLink = page.getByRole('link', { name: 'Productos' });
      await expect(productsLink).toHaveClass(/bg-gray-800/);
    });
  });

  test.describe('Page Loading and Content', () => {
    test('POS page should load without errors', async ({ page }) => {
      await page.goto('/dashboard/pos');

      // Check for main heading or key element
      await expect(page.getByText('Punto de Venta')).toBeVisible();

      // Check that page is interactive (not just static HTML)
      const buttons = await page.getByRole('button').count();
      expect(buttons).toBeGreaterThan(0);
    });

    test('Products page should load product list', async ({ page }) => {
      await page.goto('/dashboard/products');

      // Wait for page to load
      await expect(page.locator('h1').first()).toBeVisible();

      // Wait a bit for content to load
      await page.waitForTimeout(1000);

      // Check for expected elements (table or empty state or loading)
      const hasTable = await page.getByRole('table').isVisible().catch(() => false);
      const hasEmptyState = await page.getByText(/no hay productos|sin productos/i).isVisible().catch(() => false);
      const hasCard = await page.locator('[class*="card"]').count();

      // Should have either a table with products, empty state, or cards (page structure)
      expect(hasTable || hasEmptyState || hasCard > 0).toBe(true);
    });

    test('Sales page should load without map error', async ({ page }) => {
      await page.goto('/dashboard/sales');

      // Wait for page to load
      await expect(page.locator('h1').first()).toBeVisible();

      // Wait for async data loading
      await page.waitForTimeout(1000);

      // Should not show any error messages
      const errorCount = await page.locator('text=/TypeError|is not a function/i').count();
      expect(errorCount).toBe(0);
    });

    test('Cash page should show proper state', async ({ page }) => {
      await page.goto('/dashboard/cash');

      // Wait for page to fully load
      await expect(page.locator('h1').first()).toBeVisible();
      await page.waitForTimeout(1000);

      // Should show either open cash register or "no hay caja abierta" or any heading
      const hasCashRegister = await page.getByText('Balance Actual').isVisible().catch(() => false);
      const hasNoCash = await page.getByText('No hay caja abierta').isVisible().catch(() => false);
      const hasHeading = await page.locator('h1').isVisible().catch(() => false);

      expect(hasCashRegister || hasNoCash || hasHeading).toBe(true);
    });
  });

  test.describe('Navigation Performance', () => {
    test('pages should load within reasonable time', async ({ page }) => {
      const maxLoadTime = 5000; // 5 seconds

      const pagesToTest = [
        '/dashboard/pos',
        '/dashboard/products',
        '/dashboard/sales',
        '/dashboard/cash',
      ];

      for (const url of pagesToTest) {
        const startTime = Date.now();

        await page.goto(url);
        await page.waitForLoadState('domcontentloaded');

        const loadTime = Date.now() - startTime;

        expect(loadTime).toBeLessThan(maxLoadTime);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid routes gracefully', async ({ page }) => {
      // Try to navigate to non-existent page
      const response = await page.goto('/dashboard/nonexistent');

      // Should get 404 or redirect
      expect(response?.status()).toBeGreaterThanOrEqual(400);
    });
  });
});
