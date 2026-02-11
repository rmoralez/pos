# Movement Types Management Implementation

## Overview

This document describes the implementation of the Movement Types management feature for the SuperCommerce POS system. Movement Types are configurable categories used to classify cash register transactions as either income (INCOME) or expenses (EXPENSE).

## Implementation Date

February 11, 2026

## Features Implemented

### 1. Backend API Endpoints

**Location**: `/app/api/movement-types/`

#### GET `/api/movement-types`
- Fetches all movement types for the authenticated user's tenant
- Returns both active and inactive types
- Includes transaction count for each movement type
- Sorted by transaction type (INCOME first, then EXPENSE) and then by name

**Response Example**:
```json
[
  {
    "id": "uuid",
    "name": "Venta productos usados",
    "description": "Ingresos por venta de productos de segunda mano",
    "transactionType": "INCOME",
    "isActive": true,
    "tenantId": "uuid",
    "isSystem": false,
    "_count": {
      "transactions": 5
    }
  }
]
```

#### POST `/api/movement-types`
- Creates a new movement type
- Validates required fields (name, transactionType)
- Prevents duplicate names within the same tenant
- Auto-sets `isSystem: false` and `isActive: true`

**Request Body**:
```json
{
  "name": "Nuevo Ingreso",
  "description": "Descripción opcional",
  "transactionType": "INCOME"
}
```

#### PUT `/api/movement-types/[id]`
- Updates an existing movement type
- Prevents editing system-defined types
- Validates name uniqueness when changing name
- Can update: name, description, isActive

**Request Body**:
```json
{
  "name": "Nombre actualizado",
  "description": "Nueva descripción",
  "isActive": false
}
```

#### DELETE `/api/movement-types/[id]`
- Deletes a movement type
- Prevents deletion of system-defined types
- Prevents deletion of types with associated transactions
- Returns transaction count in error message if deletion is blocked

### 2. Frontend Components

**Location**: `/components/settings/movement-types-tab.tsx`

#### MovementTypesTab Component

A comprehensive React component that provides the user interface for managing movement types in the Settings page.

**Features**:
- Separate visual sections for Income and Expense types
- Color-coded icons (green up arrow for income, red down arrow for expense)
- Create/Edit dialog with form validation
- Delete functionality with transaction count validation
- Active/Inactive status badges
- Transaction count display for each type

**UI Structure**:
1. **Income Types Section**
   - Card with "Tipos de Ingreso" title
   - "Nuevo Ingreso" button
   - Table displaying all income types

2. **Expense Types Section**
   - Card with "Tipos de Egreso" title
   - "Nuevo Egreso" button
   - Table displaying all expense types

3. **Create/Edit Dialog**
   - Name field (required)
   - Description field (optional)
   - Transaction Type selector (INCOME/EXPENSE)
   - Active checkbox
   - Cancel/Create/Update buttons

**Table Columns**:
- Name (with icon indicator)
- Description
- Transaction Count
- Status (Active/Inactive badge)
- Actions (Edit/Delete buttons)

### 3. Settings Page Integration

**Location**: `/app/(dashboard)/dashboard/settings/page.tsx`

Added a new tab "Tipos de Movimiento" to the Settings page:
- Tab trigger with ArrowRightLeft icon
- Tab content renders the MovementTypesTab component
- Positioned between Users and AFIP tabs

## Data Model

The MovementType entity has the following fields:

```prisma
model MovementType {
  id              String            @id @default(uuid())
  name            String
  description     String?
  transactionType TransactionType   // INCOME or EXPENSE
  isSystem        Boolean           @default(false)
  isActive        Boolean           @default(true)
  tenantId        String
  tenant          Tenant            @relation(fields: [tenantId], references: [id])
  transactions    CashTransaction[]
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
}
```

## Multi-Tenancy

All API endpoints enforce tenant isolation:
- Movement types are scoped to the authenticated user's tenant
- Users can only view, create, update, and delete movement types within their own tenant
- Tenant ID is automatically set from the session during creation

## Validation Rules

1. **Name**: Required, must be unique within tenant
2. **Transaction Type**: Required, must be either "INCOME" or "EXPENSE"
3. **System Types**: Cannot be edited or deleted
4. **Types with Transactions**: Cannot be deleted (can be deactivated instead)

## User Experience

### Creating a Movement Type
1. Navigate to Settings → Tipos de Movimiento
2. Click "Nuevo Ingreso" or "Nuevo Egreso"
3. Fill in the name (required) and description (optional)
4. Click "Crear"
5. Success toast appears and type is added to the table

### Editing a Movement Type
1. Click the edit button (pencil icon) on the desired type
2. Modify the fields in the dialog
3. Click "Actualizar"
4. Success toast appears and table updates

### Deactivating a Movement Type
1. Click edit on the type
2. Uncheck "Tipo activo"
3. Click "Actualizar"
4. Status badge changes to "Inactivo"

### Deleting a Movement Type
1. Click the delete button (trash icon)
2. Confirm deletion in the browser dialog
3. If type has transactions, error message appears
4. Otherwise, success toast appears and type is removed

## Error Handling

The implementation includes comprehensive error handling:

### Backend Errors
- 401: Unauthorized (no valid session)
- 400: Bad request (validation errors, duplicate names, transaction conflicts)
- 403: Forbidden (attempting to modify system types)
- 404: Not found (type doesn't exist)
- 500: Internal server error

### Frontend Errors
- Toast notifications for all error states
- User-friendly Spanish error messages
- Prevents invalid operations (e.g., deleting types with transactions)

## Security

- All endpoints require authentication via NextAuth session
- Tenant isolation prevents cross-tenant data access
- System-defined types are protected from modification/deletion
- Input validation on both frontend and backend

## Testing

E2E tests have been created at `/e2e/settings/movement-types.spec.ts` covering:
- Display of existing movement types
- Creation of income and expense types
- Editing movement types
- Toggle active/inactive status
- Deletion of types without transactions
- Prevention of deletion for types with transactions
- Form validation
- Duplicate name prevention
- Transaction count display
- Proper separation of income/expense types

## Files Modified/Created

### Created
1. `/components/settings/movement-types-tab.tsx` - Main UI component
2. `/e2e/settings/movement-types.spec.ts` - E2E test suite
3. `/MOVEMENT_TYPES_IMPLEMENTATION.md` - This documentation

### Modified
1. `/app/api/movement-types/route.ts` - Updated GET endpoint to return all types with _count
2. `/app/(dashboard)/dashboard/settings/page.tsx` - Added movement types tab
3. `/app/api/cash-registers/current/route.ts` - Removed debug logging

## Future Enhancements

Potential improvements for future iterations:

1. **Bulk Operations**: Allow selecting and deactivating/deleting multiple types at once
2. **Search/Filter**: Add search functionality for large lists of movement types
3. **Export/Import**: Allow exporting/importing movement type configurations
4. **Usage Analytics**: Show charts/graphs of movement type usage over time
5. **Templates**: Provide pre-defined templates for common business scenarios
6. **Sorting**: Allow users to reorder types for custom display preferences

## Related Documentation

- See `E2E_TESTING_GUIDE.md` for E2E testing procedures
- See Prisma schema for complete data model
- See AFIP integration docs for fiscal compliance requirements

## Support

For questions or issues related to movement types management:
1. Check the E2E tests for usage examples
2. Review the API endpoint documentation above
3. Consult the component source code for implementation details
