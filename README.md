# SuperCommerce POS

Sistema de punto de venta completo para retail en Argentina con facturación AFIP, gestión de stock, multi-sucursal y control de caja.

## Stack Tecnológico

```
┌─────────────────────────────────────────────┐
│  Frontend/Backend: Next.js 14 App Router   │
│  Database: PostgreSQL + Prisma              │
│  Multi-tenancy: Shared DB + tenant_id      │
│  Auth: NextAuth.js + RBAC custom           │
│  UI: Tailwind CSS + shadcn/ui              │
│  Real-time: Pusher (inicio) → Socket.io    │
│  AFIP: @afipsdk/afip.js                    │
│  Payments: Mercado Pago API                │
│  Hosting: Vercel (web) + Neon (DB)         │
│  Queue: BullMQ + Redis (para jobs)         │
└─────────────────────────────────────────────┘
```

## Características Principales

### 🏪 Gestión Multi-Tenant
- Múltiples empresas (tenants) en una sola instancia
- Aislamiento total de datos por tenant
- Gestión de múltiples sucursales por tenant
- Roles y permisos granulares (SUPER_ADMIN, ADMIN, CASHIER, STOCK_MANAGER, VIEWER)

### 🛒 Punto de Venta (POS)
- Interfaz rápida y optimizada para ventas
- Búsqueda de productos por SKU, código de barras o nombre
- Soporte para múltiples medios de pago (efectivo, tarjetas, QR, etc)
- Descuentos por producto o venta total
- Gestión de clientes con historial de compras

### 📦 Gestión de Inventario
- Control de stock por sucursal
- Alertas de stock mínimo
- Movimientos de stock (compras, ventas, ajustes, transferencias, pérdidas)
- Categorización de productos
- Gestión de proveedores
- Códigos de barras

### 💰 Control de Caja
- Apertura/cierre de caja diaria
- Balance inicial y final
- Registro de ingresos/egresos
- Diferencias de caja
- Historial completo de transacciones

### 🧾 Facturación AFIP
- Integración con AFIP para facturación electrónica
- Soporte para facturas A, B, C
- Generación de CAE automático
- Almacenamiento de certificados AFIP por tenant
- Puntos de venta configurables

### 📊 Reportes y Analytics
- Ventas por período
- Productos más vendidos
- Performance por cajero
- Estado de stock
- Análisis de rentabilidad

### 👥 Gestión de Usuarios y Roles
- **SUPER_ADMIN**: Control total del tenant
- **ADMIN**: Gerente de sucursales
- **CASHIER**: Operador de caja
- **STOCK_MANAGER**: Encargado de inventario
- **VIEWER**: Solo consulta

## Arquitectura de Base de Datos

### Modelos Principales

```
Tenant (Empresa)
├── Users (Usuarios)
├── Locations (Sucursales)
├── Products (Productos)
│   ├── Categories (Categorías)
│   ├── Stock (por sucursal)
│   └── StockMovements (Historial)
├── Sales (Ventas)
│   ├── SaleItems (Items de venta)
│   └── Payments (Pagos)
├── Customers (Clientes)
├── Suppliers (Proveedores)
├── CashRegisters (Cajas)
│   └── CashTransactions
└── Invoices (Facturas AFIP)
```

### Multi-Tenancy Pattern

Usamos **Shared Database with Row-Level Isolation**:
- Todas las tablas tienen `tenantId`
- Queries automáticamente filtradas por tenant
- Máxima eficiencia de recursos
- Escalable hasta cientos de tenants

## Instalación

### Prerequisitos

- Node.js 18+
- PostgreSQL (o cuenta en Neon/Supabase)
- npm o pnpm

### 1. Clonar e instalar

```bash
cd pos
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```env
# PostgreSQL - Neon (gratis): https://neon.tech
DATABASE_URL="postgresql://user:password@host:5432/supercommerce?sslmode=require"

# NextAuth - Generar: openssl rand -base64 32
NEXTAUTH_SECRET="tu-secret-aqui"
NEXTAUTH_URL="http://localhost:3000"

# AFIP
AFIP_CUIT="20123456789"
AFIP_PRODUCTION="false"

# Mercado Pago (opcional)
MERCADOPAGO_ACCESS_TOKEN="APP_USR-xxx"
MERCADOPAGO_PUBLIC_KEY="APP_USR-xxx"
```

### 3. Setup de base de datos

```bash
# Generar cliente Prisma
npm run db:generate

# Crear tablas
npm run db:push

# Cargar datos de demo
npm run db:seed
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Credenciales de Demo

Después del seed:

- **Admin**: admin@supercommerce.com / demo123
- **Cajero**: cajero@supercommerce.com / demo123

## Estructura del Proyecto

```
pos/
├── .claude/                    # Claude Code config (skills, commands)
├── app/                        # Next.js App Router
│   ├── (auth)/                # Páginas de autenticación
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/           # Páginas del dashboard
│   │   ├── pos/              # Punto de venta
│   │   ├── products/         # Gestión de productos
│   │   ├── stock/            # Control de inventario
│   │   ├── sales/            # Historial de ventas
│   │   ├── cash/             # Control de caja
│   │   ├── customers/        # Clientes
│   │   ├── invoices/         # Facturas AFIP
│   │   ├── reports/          # Reportes
│   │   └── settings/         # Configuración
│   ├── api/                   # API Routes
│   │   ├── auth/
│   │   ├── products/
│   │   ├── sales/
│   │   ├── stock/
│   │   ├── invoices/
│   │   └── webhooks/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── dashboard/             # Dashboard components
│   └── pos/                   # POS-specific components
├── lib/
│   ├── db.ts                  # Prisma client
│   ├── auth.ts                # NextAuth config
│   ├── utils.ts               # Utilities
│   └── afip/                  # AFIP integration
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed data
├── types/
│   └── next-auth.d.ts         # Type definitions
└── ...
```

## Scripts Disponibles

```bash
# Desarrollo
npm run dev                    # Servidor de desarrollo
npm run build                  # Build para producción
npm run start                  # Servidor de producción

# Base de datos
npm run db:generate           # Generar Prisma Client
npm run db:push               # Push schema a DB (dev)
npm run db:migrate            # Crear migración
npm run db:seed               # Seed data
npm run db:studio             # Prisma Studio (GUI)

# Testing
npm run test                  # Run tests
npm run test:watch            # Tests en modo watch
npm run test:coverage         # Coverage report
npm run test:e2e              # E2E tests (Playwright)
```

## Roadmap

### Fase 1: Core POS (En progreso)
- [x] Estructura base del proyecto
- [x] Autenticación multi-tenant
- [x] Schema de base de datos
- [ ] Interfaz POS básica
- [ ] Gestión de productos
- [ ] Control de stock
- [ ] Sistema de ventas

### Fase 2: Facturación AFIP
- [ ] Integración con WSAA/WSFE
- [ ] Generación de facturas A/B/C
- [ ] Gestión de certificados
- [ ] Validación de CAE

### Fase 3: Reportes y Analytics
- [ ] Dashboard de ventas
- [ ] Reportes de stock
- [ ] Performance por usuario
- [ ] Exportación a Excel/PDF

### Fase 4: Features Avanzadas
- [ ] Sistema de promociones y descuentos
- [ ] Programa de fidelización
- [ ] Integración con e-commerce
- [ ] App móvil (React Native)
- [ ] Modo offline para POS
- [ ] Impresión de tickets
- [ ] Balanza electrónica

### Fase 5: Integraciones
- [ ] Mercado Pago checkout
- [ ] Mobbex
- [ ] TodoPago
- [ ] Notificaciones por email/SMS
- [ ] WhatsApp Business API

## Deployment

### Vercel (Recomendado)

```bash
npm install -g vercel
vercel
```

### Base de Datos

**Neon** (PostgreSQL serverless - Recomendado)
- Crear cuenta en [neon.tech](https://neon.tech)
- Crear proyecto
- Copiar connection string a `DATABASE_URL`

**Supabase** (Alternativa)
- Crear cuenta en [supabase.com](https://supabase.com)
- Crear proyecto
- Obtener connection string en Settings > Database

### Variables de Entorno

Configurar en Vercel Dashboard:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (https://tu-dominio.vercel.app)
- Credenciales AFIP
- Credenciales Mercado Pago

## Configuración AFIP

### 1. Obtener Certificado

1. Generar CSR (Certificate Signing Request)
2. Solicitar certificado en AFIP
3. Descargar certificado firmado
4. Guardar en directorio seguro

### 2. Configurar en el Sistema

- Subir certificado y key desde la UI de Settings
- Configurar punto de venta
- Realizar pruebas en ambiente homologación
- Activar producción

## Seguridad

- ✅ Autenticación con NextAuth.js
- ✅ Passwords hasheados con bcrypt
- ✅ Row Level Security via tenantId
- ✅ Validación con Zod
- ✅ HTTPS only en producción
- ✅ CSRF protection
- ✅ Rate limiting (TODO)
- ✅ SQL injection prevention (Prisma)

## Soporte

Para bugs o feature requests, crear un issue en el repositorio.

## Licencia

Propietario - Todos los derechos reservados
