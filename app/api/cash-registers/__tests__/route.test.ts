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
    cashRegister: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    location: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Helper function to create NextRequest-like objects
function createMockRequest(url: string, options?: RequestInit): any {
  const urlObj = new URL(url);
  const request = new Request(urlObj, options) as any;
  request.nextUrl = { searchParams: urlObj.searchParams };
  return request;
}

describe('Cash Registers API - GET /api/cash-registers', () => {
  const mockDate = new Date('2026-02-11T14:10:35.527Z');

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    role: 'CASHIER',
  };

  const mockCashRegisters = [
    {
      id: 'register-1',
      tenantId: 'tenant-1',
      locationId: 'location-1',
      userId: 'user-1',
      openingBalance: 1000,
      closingBalance: null,
      status: 'OPEN',
      openedAt: mockDate,
      closedAt: null,
      notes: 'Test notes',
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@test.com',
      },
      location: {
        id: 'location-1',
        name: 'Main Location',
      },
      _count: {
        sales: 5,
        transactions: 3,
      },
    },
    {
      id: 'register-2',
      tenantId: 'tenant-1',
      locationId: 'location-1',
      userId: 'user-1',
      openingBalance: 500,
      closingBalance: 800,
      status: 'CLOSED',
      openedAt: mockDate,
      closedAt: mockDate,
      notes: null,
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@test.com',
      },
      location: {
        id: 'location-1',
        name: 'Main Location',
      },
      _count: {
        sales: 2,
        transactions: 1,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest('http://localhost/api/cash-registers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(prisma.cashRegister.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Successful Cases', () => {
    it('should return all cash registers with pagination', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findMany as jest.Mock).mockResolvedValue(mockCashRegisters);
      (prisma.cashRegister.count as jest.Mock).mockResolvedValue(2);

      const request = createMockRequest('http://localhost/api/cash-registers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cashRegisters).toHaveLength(2);
      expect(data.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 2,
        pages: 1,
      });
      expect(prisma.cashRegister.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              sales: true,
              transactions: true,
            },
          },
        },
        orderBy: {
          openedAt: 'desc',
        },
        skip: 0,
        take: 50,
      });
    });

    it('should filter by status=OPEN', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findMany as jest.Mock).mockResolvedValue([mockCashRegisters[0]]);
      (prisma.cashRegister.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest('http://localhost/api/cash-registers?status=OPEN');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cashRegisters).toHaveLength(1);
      expect(data.cashRegisters[0].status).toBe('OPEN');
      expect(prisma.cashRegister.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            status: 'OPEN',
          },
        })
      );
    });

    it('should filter by status=CLOSED', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findMany as jest.Mock).mockResolvedValue([mockCashRegisters[1]]);
      (prisma.cashRegister.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest('http://localhost/api/cash-registers?status=CLOSED');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cashRegisters).toHaveLength(1);
      expect(data.cashRegisters[0].status).toBe('CLOSED');
      expect(prisma.cashRegister.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            status: 'CLOSED',
          },
        })
      );
    });

    it('should filter by locationId', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findMany as jest.Mock).mockResolvedValue(mockCashRegisters);
      (prisma.cashRegister.count as jest.Mock).mockResolvedValue(2);

      const request = createMockRequest('http://localhost/api/cash-registers?locationId=location-1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cashRegisters).toHaveLength(2);
      expect(prisma.cashRegister.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            locationId: 'location-1',
          },
        })
      );
    });

    it('should handle pagination with custom page and limit', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findMany as jest.Mock).mockResolvedValue([mockCashRegisters[0]]);
      (prisma.cashRegister.count as jest.Mock).mockResolvedValue(100);

      const request = createMockRequest('http://localhost/api/cash-registers?page=2&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 100,
        pages: 10,
      });
      expect(prisma.cashRegister.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page 2 - 1) * 10
          take: 10,
        })
      );
    });

    it('should combine status and location filters', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findMany as jest.Mock).mockResolvedValue([mockCashRegisters[0]]);
      (prisma.cashRegister.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest(
        'http://localhost/api/cash-registers?status=OPEN&locationId=location-1'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.cashRegister.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            status: 'OPEN',
            locationId: 'location-1',
          },
        })
      );
    });

    it('should ignore invalid status values', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findMany as jest.Mock).mockResolvedValue(mockCashRegisters);
      (prisma.cashRegister.count as jest.Mock).mockResolvedValue(2);

      const request = createMockRequest('http://localhost/api/cash-registers?status=INVALID');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.cashRegister.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            // status should not be in where clause
          },
        })
      );
      // Verify status is NOT in the where clause
      const callArgs = (prisma.cashRegister.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.status).toBeUndefined();
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only return cash registers from current tenant', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findMany as jest.Mock).mockResolvedValue(mockCashRegisters);
      (prisma.cashRegister.count as jest.Mock).mockResolvedValue(2);

      const request = createMockRequest('http://localhost/api/cash-registers');
      await GET(request);

      expect(prisma.cashRegister.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
          }),
        })
      );
      expect(prisma.cashRegister.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
        }),
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when database error occurs', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('http://localhost/api/cash-registers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to fetch cash registers' });
    });
  });
});

describe('Cash Registers API - POST /api/cash-registers', () => {
  const mockDate = new Date('2026-02-11T14:10:35.527Z');

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    role: 'CASHIER',
  };

  const validOpenData = {
    openingBalance: 1000,
    locationId: 'location-1',
    notes: 'Opening shift',
  };

  const mockLocation = {
    id: 'location-1',
    tenantId: 'tenant-1',
    name: 'Main Location',
    address: '123 Main St',
    isMain: true,
  };

  const mockCashRegister = {
    id: 'register-1',
    tenantId: 'tenant-1',
    locationId: 'location-1',
    userId: 'user-1',
    openingBalance: 1000,
    closingBalance: null,
    status: 'OPEN',
    openedAt: mockDate,
    closedAt: null,
    notes: 'Opening shift',
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@test.com',
    },
    location: {
      id: 'location-1',
      name: 'Main Location',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validOpenData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Unauthorized' });
      expect(prisma.cashRegister.create).not.toHaveBeenCalled();
    });
  });

  describe('Successful Cash Register Opening', () => {
    it('should open a cash register successfully with valid data', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashRegister.create as jest.Mock).mockResolvedValue(mockCashRegister);

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validOpenData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: 'register-1',
        openingBalance: 1000,
        status: 'OPEN',
      });
      expect(prisma.cashRegister.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          locationId: 'location-1',
          userId: 'user-1',
          openingBalance: 1000,
          status: 'OPEN',
          notes: 'Opening shift',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should use user locationId when not provided in request', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashRegister.create as jest.Mock).mockResolvedValue(mockCashRegister);

      const dataWithoutLocation = {
        openingBalance: 1000,
        notes: 'Opening shift',
      };

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutLocation),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(prisma.cashRegister.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            locationId: 'location-1', // Should use user's locationId
          }),
        })
      );
    });

    it('should create default location when user has no locationId', async () => {
      const userWithoutLocation = { ...mockUser, locationId: null };
      (getCurrentUser as jest.Mock).mockResolvedValue(userWithoutLocation);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.location.create as jest.Mock).mockResolvedValue(mockLocation);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashRegister.create as jest.Mock).mockResolvedValue(mockCashRegister);

      const dataWithoutLocation = {
        openingBalance: 1000,
      };

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutLocation),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(prisma.location.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          name: 'Sucursal Principal',
          address: '',
        },
      });
    });

    it('should use existing default location when user has no locationId', async () => {
      const userWithoutLocation = { ...mockUser, locationId: null };
      (getCurrentUser as jest.Mock).mockResolvedValue(userWithoutLocation);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(mockLocation);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashRegister.create as jest.Mock).mockResolvedValue(mockCashRegister);

      const dataWithoutLocation = {
        openingBalance: 1000,
      };

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutLocation),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(prisma.location.create).not.toHaveBeenCalled();
      expect(prisma.cashRegister.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            locationId: 'location-1',
          }),
        })
      );
    });

    it('should allow opening cash register with zero balance', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashRegister.create as jest.Mock).mockResolvedValue({
        ...mockCashRegister,
        openingBalance: 0,
      });

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingBalance: 0 }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should allow opening cash register without notes', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashRegister.create as jest.Mock).mockResolvedValue(mockCashRegister);

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingBalance: 1000 }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe('Duplicate Open Register Validation', () => {
    it('should return 400 when cash register is already open for location', async () => {
      const existingOpenRegister = { ...mockCashRegister, id: 'existing-1' };
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(existingOpenRegister);

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validOpenData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        error: 'There is already an open cash register for this location',
      });
      expect(prisma.cashRegister.create).not.toHaveBeenCalled();
    });

    it('should check for open registers with correct tenant and location', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashRegister.create as jest.Mock).mockResolvedValue(mockCashRegister);

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validOpenData),
      });

      await POST(request);

      expect(prisma.cashRegister.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          locationId: 'location-1',
          status: 'OPEN',
        },
      });
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should create cash register with correct tenantId', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashRegister.create as jest.Mock).mockResolvedValue(mockCashRegister);

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validOpenData),
      });

      await POST(request);

      expect(prisma.cashRegister.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
          }),
        })
      );
    });

    it('should allow same location to have open register for different tenants', async () => {
      // Tenant 1 opens register
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashRegister.create as jest.Mock).mockResolvedValue(mockCashRegister);

      const request1 = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validOpenData),
      });

      const response1 = await POST(request1);
      expect(response1.status).toBe(201);

      // Tenant 2 opens register for same locationId (different tenant)
      const tenant2User = { ...mockUser, tenantId: 'tenant-2' };
      (getCurrentUser as jest.Mock).mockResolvedValue(tenant2User);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);

      const request2 = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validOpenData),
      });

      const response2 = await POST(request2);
      expect(response2.status).toBe(201);

      // Verify tenant-2 check used correct tenantId
      expect(prisma.cashRegister.findFirst).toHaveBeenLastCalledWith({
        where: {
          tenantId: 'tenant-2',
          locationId: 'location-1',
          status: 'OPEN',
        },
      });
    });
  });

  describe('Input Validation', () => {
    it('should return 400 when openingBalance is missing', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid data');
      expect(data.details).toBeDefined();
    });

    it('should return 400 when openingBalance is negative', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingBalance: -100 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid data');
    });

    it('should return 400 when openingBalance is not a number', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingBalance: 'invalid' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid data');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when database error occurs during location check', async () => {
      const userWithoutLocation = { ...mockUser, locationId: null };
      (getCurrentUser as jest.Mock).mockResolvedValue(userWithoutLocation);
      (prisma.location.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingBalance: 1000 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to open cash register' });
    });

    it('should return 500 when database error occurs during creation', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.cashRegister.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.cashRegister.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/cash-registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validOpenData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to open cash register' });
    });
  });
});
