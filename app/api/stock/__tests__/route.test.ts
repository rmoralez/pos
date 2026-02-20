/**
 * @jest-environment node
 */

import { GET } from '../route';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  __esModule: true,
  prisma: {
    stock: {
      findMany: jest.fn(),
    },
  },
}));

describe('Stock API - GET /api/stock', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    role: 'ADMIN',
  };

  const mockStockItems = [
    {
      id: 'stock-1',
      productId: 'product-1',
      locationId: 'location-1',
      quantity: 100,
      product: {
        id: 'product-1',
        sku: 'SKU001',
        name: 'Test Product',
        barcode: 'BAR001',
        tenantId: 'tenant-1',
        minStock: 10,
        category: {
          id: 'cat-1',
          name: 'Category 1',
        },
      },
      location: {
        id: 'location-1',
        name: 'Main Store',
      },
    },
    {
      id: 'stock-2',
      productId: 'product-2',
      locationId: 'location-1',
      quantity: 5,
      product: {
        id: 'product-2',
        sku: 'SKU002',
        name: 'Low Stock Product',
        barcode: 'BAR002',
        tenantId: 'tenant-1',
        minStock: 10,
        category: {
          id: 'cat-1',
          name: 'Category 1',
        },
      },
      location: {
        id: 'location-1',
        name: 'Main Store',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/stock');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('Successful Cases', () => {
    it('should return all stock items for user location', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStockItems);

      const request = new Request('http://localhost/api/stock');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        id: 'stock-1',
        productId: 'product-1',
        locationId: 'location-1',
        quantity: 100,
      });
      expect(prisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            locationId: 'location-1',
            product: {
              tenantId: 'tenant-1',
            },
          },
        })
      );
    });

    it('should filter stock by specified locationId', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStockItems);

      const request = new Request('http://localhost/api/stock?locationId=location-2');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            locationId: 'location-2',
            product: {
              tenantId: 'tenant-1',
            },
          },
        })
      );
    });

    it('should filter stock by search query (product name)', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([mockStockItems[0]]);

      const request = new Request('http://localhost/api/stock?search=Test');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(prisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            locationId: 'location-1',
            product: {
              tenantId: 'tenant-1',
              OR: [
                { name: { contains: 'Test', mode: 'insensitive' } },
                { sku: { contains: 'Test', mode: 'insensitive' } },
                { barcode: { contains: 'Test', mode: 'insensitive' } },
              ],
            },
          },
        })
      );
    });

    it('should filter by lowStock when requested', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStockItems);

      const request = new Request('http://localhost/api/stock?lowStock=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should only return items where quantity <= minStock (5 <= 10)
      expect(data).toHaveLength(1);
      expect(data[0].quantity).toBe(5);
      expect(data[0].product.minStock).toBe(10);
    });

    it('should not filter by lowStock when false', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStockItems);

      const request = new Request('http://localhost/api/stock?lowStock=false');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
    });

    it('should return empty array when no stock found', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request('http://localhost/api/stock');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should include product and location relations', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStockItems);

      const request = new Request('http://localhost/api/stock');
      await GET(request);

      expect(prisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            product: {
              include: {
                category: true,
              },
            },
            location: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      );
    });
  });

  describe('Input Validation', () => {
    it('should return 400 when locationId is missing and user has no locationId', async () => {
      const userWithoutLocation = { ...mockUser, locationId: null };
      (getCurrentUser as jest.Mock).mockResolvedValue(userWithoutLocation);

      const request = new Request('http://localhost/api/stock');
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: 'Location ID is required' });
    });

    it('should use query locationId when user has no locationId', async () => {
      const userWithoutLocation = { ...mockUser, locationId: null };
      (getCurrentUser as jest.Mock).mockResolvedValue(userWithoutLocation);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStockItems);

      const request = new Request('http://localhost/api/stock?locationId=location-2');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            locationId: 'location-2',
          }),
        })
      );
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only return stock for products from current tenant', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStockItems);

      const request = new Request('http://localhost/api/stock');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            product: expect.objectContaining({
              tenantId: 'tenant-1',
            }),
          }),
        })
      );
    });

    it('should filter stock by tenantId even with search', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStockItems);

      const request = new Request('http://localhost/api/stock?search=Test');
      await GET(request);

      expect(prisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            product: expect.objectContaining({
              tenantId: 'tenant-1',
            }),
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when database error occurs', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/stock');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Internal server error' });
    });

    it('should log error when database fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/stock');
      await GET(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'GET stock error:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty search string', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(mockStockItems);

      const request = new Request('http://localhost/api/stock?search=');
      const response = await GET(request);

      expect(response.status).toBe(200);
      // Empty search should not add OR filter
      expect(prisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            locationId: 'location-1',
            product: {
              tenantId: 'tenant-1',
            },
          },
        })
      );
    });

    it('should handle lowStock filter with items at exact minStock threshold', async () => {
      const thresholdStock = [
        {
          ...mockStockItems[0],
          quantity: 10, // exactly at minStock
          product: { ...mockStockItems[0].product, minStock: 10 },
        },
      ];
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue(thresholdStock);

      const request = new Request('http://localhost/api/stock?lowStock=true');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // quantity (10) <= minStock (10) should be included
      expect(data).toHaveLength(1);
    });

    it('should combine all filters correctly', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.stock.findMany as jest.Mock).mockResolvedValue([mockStockItems[1]]);

      const request = new Request(
        'http://localhost/api/stock?locationId=location-2&search=Low&lowStock=true'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            locationId: 'location-2',
            product: {
              tenantId: 'tenant-1',
              OR: [
                { name: { contains: 'Low', mode: 'insensitive' } },
                { sku: { contains: 'Low', mode: 'insensitive' } },
                { barcode: { contains: 'Low', mode: 'insensitive' } },
              ],
            },
          },
        })
      );
      // Should filter by lowStock after database query
      expect(data).toHaveLength(1);
      expect(data[0].quantity).toBeLessThanOrEqual(data[0].product.minStock);
    });
  });
});
