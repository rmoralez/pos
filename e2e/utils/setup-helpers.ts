import { Page } from '@playwright/test';
import { PageActions } from './test-helpers';

/**
 * Helper functions for test setup via UI
 */

interface ProductSetupData {
  sku: string;
  name: string;
  salePrice: number;
  costPrice: number;
  taxRate: number;
  stock: number;
}

interface CashRegisterSetupData {
  initialBalance: number;
  notes?: string;
}

export class SetupHelpers {
  constructor(private page: Page, private actions: PageActions) {}

  /**
   * Create a product via UI
   * Returns the product data for reference in tests
   */
  async createProduct(data: ProductSetupData): Promise<ProductSetupData> {
    // Navigate to products page
    await this.page.goto('/dashboard/products/new');

    // Fill product form
    await this.actions.fillField('SKU', data.sku);
    await this.actions.fillField('Nombre', data.name);
    await this.actions.fillField('Precio de venta', data.salePrice.toString());
    await this.actions.fillField('Precio de costo', data.costPrice.toString());
    await this.actions.fillField('Tasa de impuesto', data.taxRate.toString());
    await this.actions.fillField('Stock inicial', data.stock.toString());

    // Submit form
    await this.actions.clickButton('Guardar Producto');

    // Wait for success
    await this.actions.waitForToast('Producto creado exitosamente');

    return data;
  }

  /**
   * Open a cash register via UI
   */
  async openCashRegister(data: CashRegisterSetupData): Promise<void> {
    // Navigate to cash page
    await this.page.goto('/dashboard/cash');

    // Check if cash register is already open
    const hasOpenButton = await this.page
      .getByRole('button', { name: 'Abrir Caja' })
      .isVisible()
      .catch(() => false);

    if (!hasOpenButton) {
      // Cash register already open, skip
      return;
    }

    // Click Abrir Caja button
    await this.actions.clickButton('Abrir Caja');

    // Fill opening balance
    await this.actions.fillField('Balance Inicial', data.initialBalance.toString());

    if (data.notes) {
      await this.actions.fillField('Notas (Opcional)', data.notes);
    }

    // Submit form
    await this.actions.clickButton('Abrir Caja');

    // Wait for success
    await this.actions.waitForToast('Caja abierta');
  }

  /**
   * Close cash register via UI
   */
  async closeCashRegister(finalBalance: number): Promise<void> {
    await this.page.goto('/dashboard/cash');

    const hasCloseButton = await this.page
      .getByRole('button', { name: 'Cerrar Caja' })
      .isVisible()
      .catch(() => false);

    if (!hasCloseButton) {
      // No open cash register, skip
      return;
    }

    await this.actions.clickButton('Cerrar Caja');
    await this.actions.fillField('Balance Final (Contado)', finalBalance.toString());
    await this.actions.clickButton('Cerrar Caja');

    // Wait for close to complete
    await this.page.waitForTimeout(1000);
  }

  /**
   * Delete a product via UI
   */
  async deleteProduct(productName: string): Promise<void> {
    await this.page.goto('/dashboard/products');

    // Find product row and click delete button
    const productRow = this.page.getByRole('row').filter({ hasText: productName });
    const hasProduct = await productRow.isVisible().catch(() => false);

    if (!hasProduct) {
      // Product doesn't exist, skip
      return;
    }

    // Click trash/delete button - we need to find the delete button in the row
    const deleteButton = productRow.locator('button').filter({ hasText: /eliminar|delete|trash/i }).first();
    const hasDeleteButton = await deleteButton.isVisible().catch(() => false);

    if (hasDeleteButton) {
      await deleteButton.click();

      // Confirm deletion if dialog appears
      const confirmButton = this.page.getByRole('button', { name: /confirmar|aceptar|yes/i });
      const hasConfirm = await confirmButton.isVisible().catch(() => false);
      if (hasConfirm) {
        await confirmButton.click();
        await this.page.waitForTimeout(500);
      }
    }
  }
}
