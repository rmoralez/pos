import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create a demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { cuit: '20123456789' },
    update: {},
    create: {
      name: 'Comercio Demo',
      cuit: '20123456789',
      email: 'demo@supercommerce.com',
      phone: '+54 11 1234-5678',
      address: 'Av. Corrientes 1234',
      city: 'CABA',
      province: 'Buenos Aires',
      zipCode: 'C1043',
      afipPuntoVenta: 1,
    },
  })

  console.log('✓ Tenant created:', tenant.name)

  // Create a location
  const location = await prisma.location.upsert({
    where: { id: tenant.id + '-loc-1' },
    update: {},
    create: {
      id: tenant.id + '-loc-1',
      name: 'Sucursal Centro',
      address: 'Av. Corrientes 1234',
      phone: '+54 11 1234-5678',
      tenantId: tenant.id,
    },
  })

  console.log('✓ Location created:', location.name)

  // Create admin user
  const hashedPassword = await bcrypt.hash('demo123', 10)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@supercommerce.com' },
    update: {},
    create: {
      email: 'admin@supercommerce.com',
      name: 'Admin Demo',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      tenantId: tenant.id,
      locationId: location.id,
    },
  })

  console.log('✓ Admin user created:', adminUser.email)

  // Create cashier user
  const cashierUser = await prisma.user.upsert({
    where: { email: 'cajero@supercommerce.com' },
    update: {},
    create: {
      email: 'cajero@supercommerce.com',
      name: 'Cajero Demo',
      password: hashedPassword,
      role: 'CASHIER',
      tenantId: tenant.id,
      locationId: location.id,
    },
  })

  console.log('✓ Cashier user created:', cashierUser.email)

  // Create categories
  const electronicsCategory = await prisma.category.create({
    data: {
      name: 'Electrónica',
      description: 'Productos electrónicos',
      tenantId: tenant.id,
    },
  })

  const foodCategory = await prisma.category.create({
    data: {
      name: 'Alimentos',
      description: 'Productos alimenticios',
      tenantId: tenant.id,
    },
  })

  console.log('✓ Categories created')

  // Create supplier
  const supplier = await prisma.supplier.create({
    data: {
      name: 'Proveedor Demo SA',
      email: 'proveedor@demo.com',
      phone: '+54 11 9999-9999',
      cuit: '30123456789',
      address: 'Av. Libertador 5555',
      tenantId: tenant.id,
    },
  })

  console.log('✓ Supplier created')

  // Create products
  const products = [
    {
      sku: 'PROD-001',
      barcode: '7790001234567',
      name: 'Mouse Inalámbrico',
      description: 'Mouse inalámbrico con sensor óptico',
      costPrice: 5000,
      salePrice: 8500,
      taxRate: 21,
      categoryId: electronicsCategory.id,
      supplierId: supplier.id,
      minStock: 5,
    },
    {
      sku: 'PROD-002',
      barcode: '7790001234568',
      name: 'Teclado USB',
      description: 'Teclado estándar USB',
      costPrice: 7000,
      salePrice: 12000,
      taxRate: 21,
      categoryId: electronicsCategory.id,
      supplierId: supplier.id,
      minStock: 3,
    },
    {
      sku: 'PROD-003',
      barcode: '7790001234569',
      name: 'Café Molido 500g',
      description: 'Café molido premium 500g',
      costPrice: 2500,
      salePrice: 4200,
      taxRate: 10.5,
      unit: 'PAQUETE',
      categoryId: foodCategory.id,
      supplierId: supplier.id,
      minStock: 10,
    },
    {
      sku: 'PROD-004',
      barcode: '7790001234570',
      name: 'Azúcar 1kg',
      description: 'Azúcar refinada 1kg',
      costPrice: 800,
      salePrice: 1400,
      taxRate: 10.5,
      unit: 'KG',
      categoryId: foodCategory.id,
      supplierId: supplier.id,
      minStock: 20,
    },
  ]

  for (const productData of products) {
    const product = await prisma.product.create({
      data: {
        ...productData,
        tenantId: tenant.id,
      },
    })

    // Create initial stock
    await prisma.stock.create({
      data: {
        productId: product.id,
        locationId: location.id,
        quantity: 50,
      },
    })

    console.log(`✓ Product created: ${product.name} with stock: 50`)
  }

  // Create a customer
  const customer = await prisma.customer.create({
    data: {
      name: 'Juan Pérez',
      email: 'juan.perez@email.com',
      phone: '+54 11 5555-5555',
      documentType: 'DNI',
      documentNumber: '12345678',
      address: 'Calle Falsa 123',
      tenantId: tenant.id,
    },
  })

  console.log('✓ Customer created:', customer.name)

  console.log('🎉 Seeding completed!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
