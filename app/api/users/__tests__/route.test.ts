/**
 * @jest-environment node
 */

import { GET, POST } from '../route';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  __esModule: true,
  prisma: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    location: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

describe('Users API - GET /api/users', () => {
  const mockAdminUser = {
    id: 'user-1',
    email: 'admin@test.com',
    tenantId: 'tenant-1',
    role: 'ADMIN',
  };

  const mockUsers = [
    {
      id: 'user-1',
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'ADMIN',
      isActive: true,
      locationId: 'location-1',
      location: {
        id: 'location-1',
        name: 'Main Store',
      },
      createdAt: new Date('2026-02-11T10:00:00.000Z'),
      _count: {
        sales: 10,
        cashRegisters: 2,
      },
    },
    {
      id: 'user-2',
      name: 'Cashier User',
      email: 'cashier@test.com',
      role: 'CASHIER',
      isActive: true,
      locationId: 'location-1',
      location: {
        id: 'location-1',
        name: 'Main Store',
      },
      createdAt: new Date('2026-02-10T10:00:00.000Z'),
      _count: {
        sales: 50,
        cashRegisters: 0,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      const response = await GET();

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('Authorization', () => {
    it('should return 403 when user is not an admin', async () => {
      const cashierUser = { ...mockAdminUser, role: 'CASHIER' };
      (getCurrentUser as jest.Mock).mockResolvedValue(cashierUser);

      const response = await GET();

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({ error: 'Forbidden' });
    });

    it('should allow SUPER_ADMIN to list users', async () => {
      const superAdmin = { ...mockAdminUser, role: 'SUPER_ADMIN' };
      (getCurrentUser as jest.Mock).mockResolvedValue(superAdmin);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const response = await GET();

      expect(response.status).toBe(200);
    });

    it('should allow ADMIN to list users', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const response = await GET();

      expect(response.status).toBe(200);
    });

    it('should return 403 for STOCK_MANAGER', async () => {
      const stockManager = { ...mockAdminUser, role: 'STOCK_MANAGER' };
      (getCurrentUser as jest.Mock).mockResolvedValue(stockManager);

      const response = await GET();

      expect(response.status).toBe(403);
    });

    it('should return 403 for VIEWER', async () => {
      const viewer = { ...mockAdminUser, role: 'VIEWER' };
      (getCurrentUser as jest.Mock).mockResolvedValue(viewer);

      const response = await GET();

      expect(response.status).toBe(403);
    });
  });

  describe('Successful Cases', () => {
    it('should return all users for authenticated admin', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@test.com',
        role: 'ADMIN',
      });
    });

    it('should include location and count relations', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      await GET();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            location: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                sales: true,
                cashRegisters: true,
              },
            },
          }),
        })
      );
    });

    it('should not include password in response', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      await GET();

      const selectFields = (prisma.user.findMany as jest.Mock).mock.calls[0][0].select;
      expect(selectFields.password).toBeUndefined();
    });

    it('should order by createdAt desc', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      await GET();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only return users from current tenant', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      await GET();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when database error occurs', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await GET();

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Internal server error' });
    });
  });
});

describe('Users API - POST /api/users', () => {
  const mockAdminUser = {
    id: 'user-1',
    email: 'admin@test.com',
    tenantId: 'tenant-1',
    role: 'ADMIN',
  };

  const validUserData = {
    name: 'New User',
    email: 'newuser@test.com',
    password: 'password123',
    role: 'CASHIER' as const,
    locationId: 'location-1',
    isActive: true,
  };

  const mockCreatedUser = {
    id: 'user-2',
    name: 'New User',
    email: 'newuser@test.com',
    role: 'CASHIER',
    isActive: true,
    locationId: 'location-1',
    createdAt: new Date('2026-02-11T10:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedpassword123');
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUserData),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('Authorization', () => {
    it('should return 403 when user is not an admin', async () => {
      const cashierUser = { ...mockAdminUser, role: 'CASHIER' };
      (getCurrentUser as jest.Mock).mockResolvedValue(cashierUser);

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUserData),
      });
      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({ error: 'Forbidden' });
    });

    it('should allow SUPER_ADMIN to create users', async () => {
      const superAdmin = { ...mockAdminUser, role: 'SUPER_ADMIN' };
      (getCurrentUser as jest.Mock).mockResolvedValue(superAdmin);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({ id: 'location-1' });
      (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUserData),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should allow ADMIN to create users', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({ id: 'location-1' });
      (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUserData),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe('Successful User Creation', () => {
    it('should create a user with valid data', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({ id: 'location-1' });
      (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUserData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: 'user-2',
        name: 'New User',
        email: 'newuser@test.com',
        role: 'CASHIER',
      });
      expect(data.password).toBeUndefined();
    });

    it('should hash the password before storing', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({ id: 'location-1' });
      (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUserData),
      });
      await POST(request);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: 'hashedpassword123',
          }),
        })
      );
    });

    it('should create user without locationId', async () => {
      const dataWithoutLocation = { ...validUserData };
      delete dataWithoutLocation.locationId;

      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        ...mockCreatedUser,
        locationId: null,
      });

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutLocation),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(prisma.location.findFirst).not.toHaveBeenCalled();
    });

    it('should create user with all roles', async () => {
      const roles = ['SUPER_ADMIN', 'ADMIN', 'CASHIER', 'STOCK_MANAGER', 'VIEWER'];

      for (const role of roles) {
        (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.user.create as jest.Mock).mockResolvedValue({
          ...mockCreatedUser,
          role,
        });

        const request = new Request('http://localhost/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...validUserData, role, email: `${role}@test.com` }),
        });
        const response = await POST(request);

        expect(response.status).toBe(201);
      }
    });
  });

  describe('Email Uniqueness Validation', () => {
    it('should return 400 when email already exists', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockCreatedUser);

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUserData),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: 'User with this email already exists' });
    });

    it('should check email uniqueness globally (not per tenant)', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-other-tenant' });

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUserData),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'newuser@test.com' },
      });
    });
  });

  describe('Location Validation', () => {
    it('should return 404 when location does not exist', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUserData),
      });
      const response = await POST(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toEqual({ error: 'Location not found' });
    });

    it('should return 404 when location belongs to different tenant', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUserData),
      });
      await POST(request);

      expect(prisma.location.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'location-1',
          tenantId: 'tenant-1',
        },
      });
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should create user with correct tenantId', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({ id: 'location-1' });
      (prisma.user.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUserData),
      });
      await POST(request);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
          }),
        })
      );
    });
  });

  describe('Input Validation', () => {
    it('should return 400 when name is missing', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);

      const invalidData = { ...validUserData };
      delete invalidData.name;

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });

    it('should return 400 when email is invalid', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);

      const invalidData = { ...validUserData, email: 'not-an-email' };

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });

    it('should return 400 when password is too short', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);

      const invalidData = { ...validUserData, password: '12345' };

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });

    it('should return 400 when role is invalid', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);

      const invalidData = { ...validUserData, role: 'INVALID_ROLE' };

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when database error occurs', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUserData),
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Internal server error' });
    });
  });
});
