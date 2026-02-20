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
    customer: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('Customers API - GET /api/customers', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    tenantId: 'tenant-1',
    role: 'ADMIN',
  };

  const mockCustomers = [
    {
      id: 'customer-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      documentType: 'DNI',
      documentNumber: '12345678',
      address: '123 Main St',
      tenantId: 'tenant-1',
      createdAt: new Date('2026-02-11T10:00:00.000Z'),
      _count: {
        sales: 5,
      },
    },
    {
      id: 'customer-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+9876543210',
      documentType: 'CUIT',
      documentNumber: '87654321',
      address: '456 Oak Ave',
      tenantId: 'tenant-1',
      createdAt: new Date('2026-02-10T10:00:00.000Z'),
      _count: {
        sales: 3,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/customers');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('Successful Cases', () => {
    it('should return all customers for authenticated user', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue(mockCustomers);

      const request = new Request('http://localhost/api/customers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        id: 'customer-1',
        name: 'John Doe',
        email: 'john@example.com',
        tenantId: 'tenant-1',
      });
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
          },
        })
      );
    });

    it('should filter customers by search query (name)', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([mockCustomers[0]]);

      const request = new Request('http://localhost/api/customers?search=John');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            OR: [
              { name: { contains: 'John', mode: 'insensitive' } },
              { email: { contains: 'John', mode: 'insensitive' } },
              { phone: { contains: 'John', mode: 'insensitive' } },
              { documentNumber: { contains: 'John', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('should filter customers by search query (email)', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([mockCustomers[1]]);

      const request = new Request('http://localhost/api/customers?search=jane@');
      await GET(request);

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            OR: [
              { name: { contains: 'jane@', mode: 'insensitive' } },
              { email: { contains: 'jane@', mode: 'insensitive' } },
              { phone: { contains: 'jane@', mode: 'insensitive' } },
              { documentNumber: { contains: 'jane@', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('should include sales count in response', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue(mockCustomers);

      const request = new Request('http://localhost/api/customers');
      await GET(request);

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            _count: {
              select: {
                sales: true,
              },
            },
          },
        })
      );
    });

    it('should order by createdAt desc', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue(mockCustomers);

      const request = new Request('http://localhost/api/customers');
      await GET(request);

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should return empty array when no customers found', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request('http://localhost/api/customers');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should handle empty search string', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue(mockCustomers);

      const request = new Request('http://localhost/api/customers?search=');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
          },
        })
      );
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should only return customers from current tenant', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue(mockCustomers);

      const request = new Request('http://localhost/api/customers');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
          }),
        })
      );
    });

    it('should filter by tenantId even with search', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findMany as jest.Mock).mockResolvedValue(mockCustomers);

      const request = new Request('http://localhost/api/customers?search=John');
      await GET(request);

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when database error occurs', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/customers');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Internal server error' });
    });
  });
});

describe('Customers API - POST /api/customers', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    tenantId: 'tenant-1',
    role: 'ADMIN',
  };

  const validCustomerData = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    documentType: 'DNI',
    documentNumber: '12345678',
    address: '123 Main St',
  };

  const mockCreatedCustomer = {
    id: 'customer-1',
    ...validCustomerData,
    tenantId: 'tenant-1',
    createdAt: new Date('2026-02-11T10:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCustomerData),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('Successful Customer Creation', () => {
    it('should create a customer with valid data', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.customer.create as jest.Mock).mockResolvedValue(mockCreatedCustomer);

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCustomerData),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: 'customer-1',
        name: 'John Doe',
        email: 'john@example.com',
        tenantId: 'tenant-1',
      });
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: {
          ...validCustomerData,
          tenantId: 'tenant-1',
        },
      });
    });

    it('should create customer without email', async () => {
      const dataWithoutEmail = { ...validCustomerData };
      delete dataWithoutEmail.email;

      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.create as jest.Mock).mockResolvedValue({
        ...mockCreatedCustomer,
        email: null,
      });

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutEmail),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: {
          ...dataWithoutEmail,
          email: null,
          tenantId: 'tenant-1',
        },
      });
    });

    it('should create customer with empty email string', async () => {
      const dataWithEmptyEmail = { ...validCustomerData, email: '' };

      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.create as jest.Mock).mockResolvedValue({
        ...mockCreatedCustomer,
        email: null,
      });

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithEmptyEmail),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: null,
        }),
      });
    });

    it('should create customer with only required fields', async () => {
      const minimalData = { name: 'John Doe' };

      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.create as jest.Mock).mockResolvedValue({
        id: 'customer-1',
        name: 'John Doe',
        email: null,
        tenantId: 'tenant-1',
        createdAt: new Date(),
      });

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(minimalData),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe('Duplicate Email Validation', () => {
    it('should return 400 when email already exists for tenant', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCreatedCustomer);

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCustomerData),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: 'Customer with this email already exists' });
    });

    it('should check for duplicate email with correct tenantId', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.customer.create as jest.Mock).mockResolvedValue(mockCreatedCustomer);

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCustomerData),
      });
      await POST(request);

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          email: 'john@example.com',
        },
      });
    });

    it('should not check for duplicate email when email not provided', async () => {
      const dataWithoutEmail = { ...validCustomerData };
      delete dataWithoutEmail.email;

      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.create as jest.Mock).mockResolvedValue(mockCreatedCustomer);

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataWithoutEmail),
      });
      await POST(request);

      expect(prisma.customer.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should create customer with correct tenantId', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.customer.create as jest.Mock).mockResolvedValue(mockCreatedCustomer);

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCustomerData),
      });
      await POST(request);

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
        }),
      });
    });

    it('should allow same email for different tenants', async () => {
      // First tenant creates customer
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.customer.create as jest.Mock).mockResolvedValue(mockCreatedCustomer);

      const request1 = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCustomerData),
      });
      await POST(request1);

      // Second tenant creates customer with same email
      const tenant2User = { ...mockUser, tenantId: 'tenant-2' };
      (getCurrentUser as jest.Mock).mockResolvedValue(tenant2User);
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.customer.create as jest.Mock).mockResolvedValue({
        ...mockCreatedCustomer,
        id: 'customer-2',
        tenantId: 'tenant-2',
      });

      const request2 = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCustomerData),
      });
      const response = await POST(request2);

      expect(response.status).toBe(201);
      expect(prisma.customer.findFirst).toHaveBeenLastCalledWith({
        where: {
          tenantId: 'tenant-2',
          email: 'john@example.com',
        },
      });
    });
  });

  describe('Input Validation', () => {
    it('should return 400 when name is missing', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = { ...validCustomerData };
      delete invalidData.name;

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
      expect(data.details).toBeDefined();
    });

    it('should return 400 when name is empty string', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = { ...validCustomerData, name: '' };

      const request = new Request('http://localhost/api/customers', {
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
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const invalidData = { ...validCustomerData, email: 'not-an-email' };

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });

    it('should return 400 for invalid JSON', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 when database error occurs during duplicate check', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findFirst as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCustomerData),
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Internal server error' });
    });

    it('should return 500 when database error occurs during creation', async () => {
      (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.customer.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validCustomerData),
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Internal server error' });
    });
  });
});
