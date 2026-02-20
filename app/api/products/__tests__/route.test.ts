/**
 * @jest-environment node
 */

import { GET, POST } from '../route';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  __esModule: true,
  prisma: {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    location: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    stock: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('Products API - GET /api/products', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    role: 'ADMIN',
  };

  const mockDate = new Date('2026-02-11T14:10:35.527Z');

  const mockProducts = [
    {
      id: 'product-1',
      sku: 'SKU001',
      barcode: '123456789',
      name: 'Test Product 1',
      description: 'Test description',
      costPrice: 100,
      salePrice: 150,
      taxRate: 21,
      trackStock: true,
      minStock: 10,
      maxStock: 100,
      unit: 'UNIDAD',
      brand: 'Test Brand',
      categoryId: 'category-1',
      supplierId: 'supplier-1',
      tenantId: 'tenant-1',
      isActive: true,
      createdAt: mockDate,
      updatedAt: mockDate,
      category: { id: 'category-1', name: 'Category 1' },
      supplier: { id: 'supplier-1', name: 'Supplier 1' },
      stock: [{ id: 'stock-1', quantity: 50, locationId: 'location-1' }],
    },
    {
      id: 'product-2',
      sku: 'SKU002',
      barcode: '987654321',
      name: 'Test Product 2',
      description: 'Test description 2',
      costPrice: 200,
      salePrice: 300,
      taxRate: 21,
      trackStock: true,
      minStock: 5,
      maxStock: 50,
      unit: 'UNIDAD',
      brand: 'Test Brand',
      categoryId: 'category-1',
      supplierId: 'supplier-1',
      tenantId: 'tenant-1',
      isActive: true,
      createdAt: mockDate,
      updatedAt: mockDate,
      category: { id: 'category-1', name: 'Category 1' },
      supplier: { id: 'supplier-1', name: 'Supplier 1' },
      stock: [{ id: 'stock-2', quantity: 30, locationId: 'location-1' }],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/products');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Successful Cases', () => {
    it('should return all products for authenticated user', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);

      const request = new Request('http://localhost/api/products');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        id: 'product-1',
        sku: 'SKU001',
        name: 'Test Product 1',
        tenantId: 'tenant-1',
      });
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
        },
        include: {
          category: true,
          supplier: true,
          stock: {
            where: { locationId: 'location-1' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter products by search term (name)', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([mockProducts[0]]);

      const request = new Request('http://localhost/api/products?search=Product 1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        id: 'product-1',
        name: 'Test Product 1',
      });
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          OR: [
            { name: { contains: 'Product 1', mode: 'insensitive' } },
            { sku: { contains: 'Product 1', mode: 'insensitive' } },
            { barcode: { contains: 'Product 1', mode: 'insensitive' } },
          ],
        },
        include: {
          category: true,
          supplier: true,
          stock: {
            where: { locationId: 'location-1' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter products by search term (SKU)', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([mockProducts[0]]);

      const request = new Request('http://localhost/api/products?search=SKU001');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].sku).toBe('SKU001');
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            OR: [
              { name: { contains: 'SKU001', mode: 'insensitive' } },
              { sku: { contains: 'SKU001', mode: 'insensitive' } },
              { barcode: { contains: 'SKU001', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should filter products by search term (barcode)', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([mockProducts[0]]);

      const request = new Request('http://localhost/api/products?search=123456789');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].barcode).toBe('123456789');
    });

    it('should filter products by category', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);

      const request = new Request('http://localhost/api/products?category=category-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            categoryId: 'category-1',
          }),
        })
      );
    });

    it('should filter products by isActive status', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);

      const request = new Request('http://localhost/api/products?isActive=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            isActive: true,
          }),
        })
      );
    });

    it('should combine multiple filters', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([mockProducts[0]]);

      const request = new Request(
        'http://localhost/api/products?search=Test&category=category-1&isActive=true'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('product-1');
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            categoryId: 'category-1',
            isActive: true,
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only return products from current tenant', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);

      const request = new Request('http://localhost/api/products');
      await GET(request);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
          }),
        })
      );
    });

    it('should filter stock by user location when locationId is present', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);

      const request = new Request('http://localhost/api/products');
      await GET(request);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            stock: {
              where: { locationId: 'location-1' },
            },
          }),
        })
      );
    });

    it('should not filter stock when user has no locationId', async () => {
      const userWithoutLocation = { ...mockUser, locationId: null };
      (getCurrentUser as jest.Mock).mockResolvedValue(userWithoutLocation);
      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);

      const request = new Request('http://localhost/api/products');
      await GET(request);

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            stock: {
              where: undefined,
            },
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when database error occurs', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/products');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Internal server error' });
    });
  });
});

describe('Products API - POST /api/products', () => {
  const mockDate = new Date('2026-02-11T14:10:35.527Z');

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    role: 'ADMIN',
  };

  const validProductData = {
    sku: 'SKU001',
    barcode: '123456789',
    name: 'Test Product',
    description: 'Test description',
    costPrice: 100,
    salePrice: 150,
    taxRate: 21,
    trackStock: true,
    minStock: 10,
    maxStock: 100,
    unit: 'UNIDAD',
    brand: 'Test Brand',
    categoryId: 'category-1',
    supplierId: 'supplier-1',
    initialStock: 50,
  };

  const mockProduct = {
    id: 'product-1',
    ...validProductData,
    tenantId: 'tenant-1',
    isActive: true,
    createdAt: mockDate,
    updatedAt: mockDate,
  };

  const mockLocation = {
    id: 'location-1',
    tenantId: 'tenant-1',
    name: 'Sucursal Principal',
    address: '',
    isMain: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(prisma.product.findUnique).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not authorized (CASHIER)', async () => {
      const cashierUser = { ...mockUser, role: 'CASHIER' };
      (getCurrentUser as jest.Mock).mockResolvedValue(cashierUser);

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({ error: 'Forbidden' });
      expect(prisma.product.findUnique).not.toHaveBeenCalled();
    });

    it('should allow SUPER_ADMIN to create products', async () => {
      const superAdminUser = { ...mockUser, role: 'SUPER_ADMIN' };
      (getCurrentUser as jest.Mock).mockResolvedValue(superAdminUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            create: jest.fn().mockResolvedValue({ id: 'stock-1' }),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should allow ADMIN to create products', async () => {
      const adminUser = { ...mockUser, role: 'ADMIN' };
      (getCurrentUser as jest.Mock).mockResolvedValue(adminUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            create: jest.fn().mockResolvedValue({ id: 'stock-1' }),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should allow STOCK_MANAGER to create products', async () => {
      const stockManagerUser = { ...mockUser, role: 'STOCK_MANAGER' };
      (getCurrentUser as jest.Mock).mockResolvedValue(stockManagerUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            create: jest.fn().mockResolvedValue({ id: 'stock-1' }),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe('Successful Product Creation', () => {
    it('should create a product successfully with valid data', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            create: jest.fn().mockResolvedValue({ id: 'stock-1', quantity: 50 }),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: 'product-1',
        sku: 'SKU001',
        name: 'Test Product',
        tenantId: 'tenant-1',
      });
    });

    it('should create product with initial stock using "initialStock" field', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      let capturedStockCreate: any = null;

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            create: jest.fn().mockImplementation((data) => {
              capturedStockCreate = data;
              return Promise.resolve({ id: 'stock-1' });
            }),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validProductData, initialStock: 100 }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(capturedStockCreate).toMatchObject({
        data: expect.objectContaining({
          quantity: 100,
          locationId: 'location-1',
        }),
      });
    });

    it('should create product with initial stock using "stock" field', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      let capturedStockCreate: any = null;

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            create: jest.fn().mockImplementation((data) => {
              capturedStockCreate = data;
              return Promise.resolve({ id: 'stock-1' });
            }),
          },
        };
        return callback(mockTx);
      });

      const productDataWithStock = { ...validProductData };
      delete (productDataWithStock as any).initialStock;
      (productDataWithStock as any).stock = 75;

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productDataWithStock),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(capturedStockCreate).toMatchObject({
        data: expect.objectContaining({
          quantity: 75,
        }),
      });
    });

    it('should create product without initial stock when not provided', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      let stockCreateCalled = false;

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            create: jest.fn().mockImplementation(() => {
              stockCreateCalled = true;
              return Promise.resolve({ id: 'stock-1' });
            }),
          },
        };
        return callback(mockTx);
      });

      const productDataWithoutStock = { ...validProductData };
      delete (productDataWithoutStock as any).initialStock;

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productDataWithoutStock),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(stockCreateCalled).toBe(false);
    });

    it('should create default location when user has no locationId', async () => {
      const userWithoutLocation = { ...mockUser, locationId: null };
      (getCurrentUser as jest.Mock).mockResolvedValue(userWithoutLocation);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      let locationCreateCalled = false;
      let capturedLocationData: any = null;

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockResolvedValue(mockProduct),
          },
          location: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((data) => {
              locationCreateCalled = true;
              capturedLocationData = data;
              return Promise.resolve(mockLocation);
            }),
          },
          stock: {
            create: jest.fn().mockResolvedValue({ id: 'stock-1' }),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(locationCreateCalled).toBe(true);
      expect(capturedLocationData).toMatchObject({
        data: {
          tenantId: 'tenant-1',
          name: 'Sucursal Principal',
          address: '',
        },
      });
    });

    it('should use existing location when user has no locationId but tenant has location', async () => {
      const userWithoutLocation = { ...mockUser, locationId: null };
      (getCurrentUser as jest.Mock).mockResolvedValue(userWithoutLocation);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      let locationCreateCalled = false;

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockResolvedValue(mockProduct),
          },
          location: {
            findFirst: jest.fn().mockResolvedValue(mockLocation),
            create: jest.fn().mockImplementation(() => {
              locationCreateCalled = true;
              return Promise.resolve(mockLocation);
            }),
          },
          stock: {
            create: jest.fn().mockResolvedValue({ id: 'stock-1' }),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(locationCreateCalled).toBe(false);
    });
  });

  describe('SKU Uniqueness Validation', () => {
    it('should return 400 when SKU already exists for tenant', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Product with this SKU already exists' });
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_sku: {
            tenantId: 'tenant-1',
            sku: 'SKU001',
          },
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should check SKU uniqueness with correct tenant isolation', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            create: jest.fn().mockResolvedValue({ id: 'stock-1' }),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      await POST(request);

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_sku: {
            tenantId: 'tenant-1',
            sku: 'SKU001',
          },
        },
      });
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should create product with correct tenantId', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      let capturedProductData: any = null;

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockImplementation((data) => {
              capturedProductData = data;
              return Promise.resolve(mockProduct);
            }),
          },
          stock: {
            create: jest.fn().mockResolvedValue({ id: 'stock-1' }),
          },
        };
        return callback(mockTx);
      });

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      await POST(request);

      expect(capturedProductData).toMatchObject({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
        }),
      });
    });

    it('should allow same SKU for different tenants', async () => {
      // Tenant 1 creates product
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            create: jest.fn().mockResolvedValue({ id: 'stock-1' }),
          },
        };
        return callback(mockTx);
      });

      const request1 = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response1 = await POST(request1);
      expect(response1.status).toBe(201);

      // Tenant 2 creates product with same SKU
      const tenant2User = { ...mockUser, tenantId: 'tenant-2' };
      (getCurrentUser as jest.Mock).mockResolvedValue(tenant2User);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null); // No duplicate for tenant-2

      const request2 = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response2 = await POST(request2);
      expect(response2.status).toBe(201);

      expect(prisma.product.findUnique).toHaveBeenLastCalledWith({
        where: {
          tenantId_sku: {
            tenantId: 'tenant-2',
            sku: 'SKU001',
          },
        },
      });
    });
  });

  describe('Input Validation', () => {
    it('should return 400 when SKU is missing', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = { ...validProductData };
      delete (invalidData as any).sku;

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
      expect(data.details).toBeDefined();
    });

    it('should return 400 when name is missing', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = { ...validProductData };
      delete (invalidData as any).name;

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
    });

    it('should return 400 when costPrice is missing', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = { ...validProductData };
      delete (invalidData as any).costPrice;

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
    });

    it('should return 400 when salePrice is missing', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = { ...validProductData };
      delete (invalidData as any).salePrice;

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
    });

    it('should return 400 when costPrice is not positive', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = { ...validProductData, costPrice: 0 };

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
    });

    it('should return 400 when salePrice is not positive', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = { ...validProductData, salePrice: -10 };

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
    });

    it('should return 400 when taxRate is below 0', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = { ...validProductData, taxRate: -5 };

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
    });

    it('should return 400 when taxRate is above 100', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = { ...validProductData, taxRate: 150 };

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
    });

    it('should accept optional fields as undefined', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          product: {
            create: jest.fn().mockResolvedValue(mockProduct),
          },
          stock: {
            create: jest.fn().mockResolvedValue({ id: 'stock-1' }),
          },
        };
        return callback(mockTx);
      });

      const minimalData = {
        sku: 'SKU001',
        name: 'Test Product',
        costPrice: 100,
        salePrice: 150,
      };

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(minimalData),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when database error occurs during SKU check', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Internal server error' });
    });

    it('should return 500 when transaction fails', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProductData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Internal server error' });
    });

    it('should return 400 when JSON body is invalid', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const request = new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500); // JSON.parse throws, caught as internal error
      expect(data).toEqual({ error: 'Internal server error' });
    });
  });
});
