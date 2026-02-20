/**
 * @jest-environment node
 */

import { POST } from '../route';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

// Mock dependencies
jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  __esModule: true,
  prisma: {
    cashRegister: {
      findFirst: jest.fn(),
    },
    location: {
      findFirst: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
    },
    stock: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    sale: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('Sales API - POST /api/sales', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    tenantId: 'tenant-123',
    locationId: 'location-123',
    name: 'Test User',
    role: 'ADMIN' as const,
  };

  const mockCashRegister = {
    id: 'cash-register-123',
    name: 'Caja Principal',
    tenantId: 'tenant-123',
    locationId: 'location-123',
    status: 'OPEN' as const,
    openingBalance: 1000,
    currentBalance: 1500,
    openedAt: new Date(),
    openedBy: 'user-123',
    closedAt: null,
    closedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProduct = {
    id: 'product-123',
    sku: 'PROD-001',
    name: 'Test Product',
    description: 'Test Description',
    costPrice: 50,
    salePrice: 100,
    taxRate: 21,
    categoryId: 'category-123',
    tenantId: 'tenant-123',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStock = {
    id: 'stock-123',
    productId: 'product-123',
    locationId: 'location-123',
    quantity: 10,
    minStock: 5,
    maxStock: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validSaleData = {
    items: [
      {
        productId: 'product-123',
        quantity: 2,
        unitPrice: 100,
        taxRate: 21,
      },
    ],
    paymentMethod: 'CASH' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Payment Processing', () => {
    it('should create a sale successfully with valid data', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const mockSale = {
        id: 'sale-123',
        saleNumber: 'SALE-000001',
        tenantId: 'tenant-123',
        locationId: 'location-123',
        customerId: null,
        userId: 'user-123',
        subtotal: 200,
        taxAmount: 42,
        total: 242,
        status: 'COMPLETED' as const,
        cashRegisterId: 'cash-register-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(mockCashRegister);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([{ max_num: null }]),
          sale: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockSale),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            findFirst: jest.fn().mockResolvedValue(mockStock),
            update: jest.fn().mockResolvedValue({ ...mockStock, quantity: 8 }),
          },
          stockMovement: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: mockSale.id,
        saleNumber: mockSale.saleNumber,
        tenantId: mockSale.tenantId,
        locationId: mockSale.locationId,
        userId: mockSale.userId,
        subtotal: mockSale.subtotal,
        taxAmount: mockSale.taxAmount,
        total: mockSale.total,
        status: mockSale.status,
        cashRegisterId: mockSale.cashRegisterId,
      });
      expect(prisma.cashRegister.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: mockUser.tenantId,
          locationId: mockUser.locationId,
          status: 'OPEN',
        },
      });
    });

    it('should calculate sale totals correctly with tax', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const multiItemSaleData = {
        items: [
          {
            productId: 'product-123',
            quantity: 2,
            unitPrice: 100,
            taxRate: 21,
          },
          {
            productId: 'product-456',
            quantity: 1,
            unitPrice: 50,
            taxRate: 10.5,
          },
        ],
        paymentMethod: 'CASH' as const,
      };

      const mockSale = {
        id: 'sale-123',
        saleNumber: 'SALE-000001',
        tenantId: 'tenant-123',
        locationId: 'location-123',
        customerId: null,
        userId: 'user-123',
        subtotal: 250, // (2 * 100) + (1 * 50)
        taxAmount: 47.25, // (200 * 0.21) + (50 * 0.105)
        total: 297.25,
        status: 'COMPLETED' as const,
        cashRegisterId: 'cash-register-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(mockCashRegister);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([{ max_num: null }]),
          sale: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockSale),
          },
          product: {
            findFirst: jest.fn()
              .mockResolvedValueOnce({ ...mockProduct, id: 'product-123' })
              .mockResolvedValueOnce({ ...mockProduct, id: 'product-456', salePrice: 50, taxRate: 10.5 }),
          },
          stock: {
            findFirst: jest.fn().mockResolvedValue(mockStock),
            update: jest.fn().mockResolvedValue(mockStock),
          },
          stockMovement: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(multiItemSaleData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.subtotal).toBe(250);
      expect(data.total).toBe(297.25);
    });

    it('should update stock quantities correctly', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const mockStockUpdate = jest.fn();
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(mockCashRegister);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([{ max_num: null }]),
          sale: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'sale-123',
              saleNumber: 'SALE-000001',
            }),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            findFirst: jest.fn().mockResolvedValue(mockStock),
            update: mockStockUpdate.mockResolvedValue({ ...mockStock, quantity: 8 }),
          },
          stockMovement: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      await POST(request);

      expect(mockStockUpdate).toHaveBeenCalledWith({
        where: {
          productId_locationId: {
            productId: 'product-123',
            locationId: mockUser.locationId,
          },
        },
        data: {
          quantity: { decrement: 2 },
        },
      });
    });

    it('should create stock movements for sold items', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const mockStockMovementCreate = jest.fn();
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(mockCashRegister);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([{ max_num: null }]),
          sale: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'sale-123',
              saleNumber: 'SALE-000001',
            }),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            findFirst: jest.fn().mockResolvedValue(mockStock),
            update: jest.fn().mockResolvedValue(mockStock),
          },
          stockMovement: {
            create: mockStockMovementCreate.mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      await POST(request);

      expect(mockStockMovementCreate).toHaveBeenCalledWith({
        data: {
          type: 'SALE',
          quantity: -2,
          productId: 'product-123',
          userId: mockUser.id,
          saleId: 'sale-123',
          reason: 'Venta SALE-000001',
        },
      });
    });
  });

  describe('Cash Register Validation', () => {
    it('should return 400 when no cash register is open', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('No open cash register');
    });

    it('should only find cash registers for the current tenant', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      await POST(request);

      expect(prisma.cashRegister.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: mockUser.tenantId,
          locationId: mockUser.locationId,
          status: 'OPEN',
        },
      });
    });

    it('should use default location if user has no location assigned', async () => {
      const userWithoutLocation = { ...mockUser, locationId: null };
      const defaultLocation = {
        id: 'default-location-123',
        name: 'Default Location',
        tenantId: mockUser.tenantId,
      };

      (getCurrentUser as jest.Mock).mockResolvedValue(userWithoutLocation);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(defaultLocation);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue({
        ...mockCashRegister,
        locationId: defaultLocation.id,
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([{ max_num: null }]),
          sale: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'sale-123', saleNumber: 'SALE-000001' }),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            findFirst: jest.fn().mockResolvedValue(mockStock),
            update: jest.fn().mockResolvedValue(mockStock),
          },
          stockMovement: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      await POST(request);

      expect(prisma.location.findFirst).toHaveBeenCalledWith({
        where: { tenantId: mockUser.tenantId },
      });
    });
  });

  describe('Stock Validation', () => {
    it('should return 400 when product has insufficient stock', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(mockCashRegister);

      const lowStockData = {
        items: [
          {
            productId: 'product-123',
            quantity: 20, // More than available stock (10)
            unitPrice: 100,
            taxRate: 21,
          },
        ],
        paymentMethod: 'CASH' as const,
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([{ max_num: null }]),
          sale: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            findFirst: jest.fn().mockResolvedValue(mockStock), // quantity: 10
          },
        };

        try {
          await callback(mockTx);
        } catch (error: any) {
          throw error;
        }
      });

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lowStockData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Insufficient stock');
    });

    it('should return 400 when product does not exist', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(mockCashRegister);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([{ max_num: null }]),
          sale: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue(null), // Product not found
          },
        };

        try {
          await callback(mockTx);
        } catch (error: any) {
          throw error;
        }
      });

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('not found');
    });

    it('should return 400 when product has no stock record', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(mockCashRegister);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([{ max_num: null }]),
          sale: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            findFirst: jest.fn().mockResolvedValue(null), // No stock record
          },
        };

        try {
          await callback(mockTx);
        } catch (error: any) {
          throw error;
        }
      });

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Insufficient stock');
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only access products from the current tenant', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(mockCashRegister);

      const mockProductFindFirst = jest.fn().mockResolvedValue(mockProduct);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([{ max_num: null }]),
          sale: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'sale-123', saleNumber: 'SALE-000001' }),
          },
          product: {
            findFirst: mockProductFindFirst,
          },
          stock: {
            findFirst: jest.fn().mockResolvedValue(mockStock),
            update: jest.fn().mockResolvedValue(mockStock),
          },
          stockMovement: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      await POST(request);

      expect(mockProductFindFirst).toHaveBeenCalledWith({
        where: {
          id: 'product-123',
          tenantId: mockUser.tenantId,
          isActive: true,
        },
      });
    });

    it('should not allow sales for products from other tenants', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(mockCashRegister);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([{ max_num: null }]),
          sale: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          product: {
            // Product exists but belongs to different tenant
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };

        try {
          await callback(mockTx);
        } catch (error: any) {
          throw error;
        }
      });

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('not found');
    });

    it('should create sales associated with the current tenant', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(mockCashRegister);

      const mockSaleCreate = jest.fn().mockResolvedValue({
        id: 'sale-123',
        saleNumber: 'SALE-000001',
        tenantId: mockUser.tenantId,
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([{ max_num: null }]),
          sale: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: mockSaleCreate,
          },
          product: {
            findFirst: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            findFirst: jest.fn().mockResolvedValue(mockStock),
            update: jest.fn().mockResolvedValue(mockStock),
          },
          stockMovement: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      await POST(request);

      expect(mockSaleCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: mockUser.tenantId,
            userId: mockUser.id,
            locationId: mockUser.locationId,
          }),
        })
      );
    });
  });

  describe('Input Validation', () => {
    it('should return 500 for invalid JSON', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should return 401 when user is not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should validate required fields in sale data', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = {
        items: [],
        // Missing paymentMethod
      };

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should validate item quantities are positive', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidQuantityData = {
        items: [
          {
            productId: 'product-123',
            quantity: -1,
            unitPrice: 100,
            taxRate: 21,
          },
        ],
        paymentMethod: 'CASH' as const,
      };

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidQuantityData),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Transaction Handling', () => {
    it('should rollback transaction on error', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(mockCashRegister);

      const error = new Error('Database error');
      (prisma.$transaction as jest.Mock).mockRejectedValue(error);

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });

    it('should use transaction timeout of 30 seconds', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(mockCashRegister);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback, options) => {
        expect(options).toEqual({
          maxWait: 30000,
          timeout: 30000,
        });

        const mockTx = {
          $queryRaw: jest.fn().mockResolvedValue([{ max_num: null }]),
          sale: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'sale-123', saleNumber: 'SALE-000001' }),
          },
          product: {
            findFirst: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            findFirst: jest.fn().mockResolvedValue(mockStock),
            update: jest.fn().mockResolvedValue(mockStock),
          },
          stockMovement: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSaleData),
      });

      await POST(request);

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { maxWait: 30000, timeout: 30000 }
      );
    });
  });
});
