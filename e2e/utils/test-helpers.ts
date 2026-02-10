import { Page, expect } from '@playwright/test';

/**
 * Test data generators
 */
export const generateTestData = {
  /**
   * Generate unique email for testing
   */
  email: (prefix: string = 'test') => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}-${timestamp}-${random}@test.com`;
  },

  /**
   * Generate unique CUIT for testing
   */
  cuit: () => {
    const timestamp = Date.now().toString().slice(-10);
    return `20${timestamp}1`;
  },

  /**
   * Generate unique SKU for testing
   */
  sku: (prefix: string = 'PROD') => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}-${timestamp}-${random}`;
  },

  /**
   * Generate unique tenant name
   */
  tenantName: (prefix: string = 'TestCorp') => {
    const timestamp = Date.now();
    return `${prefix} ${timestamp}`;
  },

  /**
   * Generate product data
   */
  product: (overrides?: Partial<ProductData>) => ({
    sku: generateTestData.sku(),
    name: `Test Product ${Date.now()}`,
    salePrice: '1000.00',
    costPrice: '500.00',
    taxRate: '21',
    stock: '10',
    ...overrides,
  }),

  /**
   * Generate user data
   */
  user: (overrides?: Partial<UserData>) => ({
    name: `Test User ${Date.now()}`,
    email: generateTestData.email(),
    password: 'Test123!@#',
    ...overrides,
  }),

  /**
   * Generate tenant data
   */
  tenant: (overrides?: Partial<TenantData>) => ({
    name: generateTestData.tenantName(),
    cuit: generateTestData.cuit(),
    address: '123 Test Street',
    city: 'Buenos Aires',
    province: 'Buenos Aires',
    postalCode: '1000',
    phone: '+541112345678',
    ...overrides,
  }),
};

export interface ProductData {
  sku: string;
  name: string;
  salePrice: string;
  costPrice: string;
  taxRate: string;
  stock: string;
  barcode?: string;
  categoryId?: string;
}

export interface UserData {
  name: string;
  email: string;
  password: string;
}

export interface TenantData {
  name: string;
  cuit: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
}

/**
 * Common page actions
 */
export class PageActions {
  constructor(private page: Page) {}

  /**
   * Fill a form field
   */
  async fillField(label: string, value: string, exact: boolean = false) {
    const input = this.page.getByLabel(label, { exact });
    await input.fill(value);
  }

  /**
   * Click a button by text
   */
  async clickButton(text: string) {
    await this.page.getByRole('button', { name: text }).click();
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(url: string) {
    await this.page.waitForURL(`**${url}`);
  }

  /**
   * Check if element is visible
   */
  async isVisible(text: string) {
    return await this.page.getByText(text).isVisible();
  }

  /**
   * Wait for toast message
   */
  async waitForToast(message: string, timeout: number = 5000) {
    await this.page.getByText(message, { exact: true }).first().waitFor({ timeout });
  }

  /**
   * Search for item
   */
  async search(placeholder: string, query: string) {
    const searchInput = this.page.getByPlaceholder(placeholder);
    await searchInput.fill(query);
  }

  /**
   * Select dropdown option
   */
  async selectOption(label: string, value: string) {
    await this.page.getByLabel(label).click();
    await this.page.getByRole('option', { name: value }).click();
  }

  /**
   * Delete item from table
   */
  async deleteTableItem(rowIdentifier: string) {
    const row = this.page.getByRole('row').filter({ hasText: rowIdentifier });
    await row.getByRole('button').filter({ hasText: 'Trash' }).click();

    // Confirm deletion in dialog
    await this.page.getByRole('button', { name: 'Confirmar' }).click();
  }

  /**
   * Navigate to page
   */
  async goto(path: string) {
    await this.page.goto(path);
  }

  /**
   * Wait for API response
   */
  async waitForAPI(url: string) {
    return await this.page.waitForResponse(response =>
      response.url().includes(url) && response.status() === 200
    );
  }
}

/**
 * Database helpers for test setup/teardown
 */
export class DBHelpers {
  /**
   * Clean up test data after tests
   * Note: In real implementation, this would connect to test DB
   */
  static async cleanup() {
    // This would use Prisma to clean test data
    // For now, this is a placeholder
    console.log('Cleanup test data');
  }

  /**
   * Seed test data before tests
   */
  static async seed() {
    // This would seed necessary test data
    console.log('Seed test data');
  }
}

/**
 * Assertion helpers
 */
export class Assertions {
  constructor(private page: Page) {}

  /**
   * Assert user is on login page
   */
  async assertOnLoginPage() {
    await expect(this.page).toHaveURL(/.*login/);
    await expect(this.page.getByRole('heading', { name: 'SuperCommerce POS' })).toBeVisible();
  }

  /**
   * Assert user is on dashboard
   */
  async assertOnDashboard() {
    await expect(this.page).toHaveURL(/.*dashboard/);
  }

  /**
   * Assert error message is displayed
   */
  async assertErrorMessage(message: string) {
    await expect(this.page.getByText(message, { exact: true }).first()).toBeVisible();
  }

  /**
   * Assert success message is displayed
   */
  async assertSuccessMessage(message: string) {
    await expect(this.page.getByText(message, { exact: true }).first()).toBeVisible();
  }

  /**
   * Assert product in list
   */
  async assertProductInList(productName: string) {
    await expect(this.page.getByRole('row').filter({ hasText: productName }).first()).toBeVisible();
  }

  /**
   * Assert product not in list
   */
  async assertProductNotInList(productName: string) {
    await expect(this.page.getByRole('row').filter({ hasText: productName })).toHaveCount(0);
  }

  /**
   * Assert cart item count
   */
  async assertCartItemCount(count: number) {
    if (count === 0) {
      await expect(this.page.getByText('El carrito está vacío')).toBeVisible();
    } else {
      await expect(this.page.getByText(`${count} ${count === 1 ? 'producto' : 'productos'} en el carrito`)).toBeVisible();
    }
  }

  /**
   * Assert total amount
   */
  async assertTotal(amount: string) {
    await expect(this.page.getByText(`Total`).locator('..').getByText(`$${amount}`)).toBeVisible();
  }
}

/**
 * Wait helpers
 */
export const waitFor = {
  /**
   * Wait for element to be visible
   */
  visible: async (page: Page, selector: string, timeout: number = 5000) => {
    await page.waitForSelector(selector, { state: 'visible', timeout });
  },

  /**
   * Wait for element to be hidden
   */
  hidden: async (page: Page, selector: string, timeout: number = 5000) => {
    await page.waitForSelector(selector, { state: 'hidden', timeout });
  },

  /**
   * Wait for network to be idle
   */
  networkIdle: async (page: Page, timeout: number = 5000) => {
    await page.waitForLoadState('networkidle', { timeout });
  },
};
