# Customer Selection Implementation for POS

## Overview

This document describes the implementation of customer selection functionality in the SuperCommerce POS system, which enables users to select customers when processing sales, particularly required for the ACCOUNT (Cuenta Corriente) payment method.

## Implementation Date

February 20, 2026

## Problem Statement

The POS system was missing customer selection functionality, which is required when using the ACCOUNT payment method. The payment dialog showed a warning: "Debe seleccionar un cliente en el POS para usar cuenta corriente" (You must select a customer in the POS to use current account), but there was no way to actually select a customer.

## Solution Overview

Implemented a complete customer selection workflow with the following components:

1. **UI Components**: Added Radix UI Command and Popover components for combobox functionality
2. **Customer Selector Component**: Created a reusable customer search/selection component
3. **POS Integration**: Integrated customer selection into the POS page
4. **Payment Dialog Integration**: Updated payment dialog to receive and validate customer data

## Technical Implementation

### 1. Dependencies Added

```bash
npm install @radix-ui/react-popover cmdk
```

- `@radix-ui/react-popover`: Provides the popover component for the dropdown
- `cmdk`: Command menu component for searchable selection

### 2. New UI Components

#### `/components/ui/command.tsx`
Shadcn-style Command component wrapper around cmdk library. Provides:
- Command root container
- CommandInput for search
- CommandList for results
- CommandEmpty for no results state
- CommandGroup for organizing items
- CommandItem for selectable items

#### `/components/ui/popover.tsx`
Shadcn-style Popover component wrapper around Radix UI. Provides:
- Popover root container
- PopoverTrigger for opening the dropdown
- PopoverContent for the dropdown content

### 3. Customer Selector Component

#### `/components/pos/customer-selector.tsx`

**Features:**
- Real-time customer search with 300ms debounce
- Searches by name, email, phone, or document number
- Displays up to 20 customers at a time
- Shows customer details (name, document, email, phone) in dropdown
- Clear visual indication of selected customer
- Automatic loading state

**Props:**
```typescript
interface CustomerSelectorProps {
  value: Customer | null
  onChange: (customer: Customer | null) => void
  disabled?: boolean
}
```

**Customer Interface:**
```typescript
interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  documentType: string | null
  documentNumber: string | null
}
```

**Implementation Details:**
- Uses existing `/api/customers?search=` endpoint (already supports multi-tenant filtering)
- Fetches customers when popover opens
- Re-fetches on search query change with debouncing
- Limits results to 20 for performance

### 4. POS Page Updates

#### `/app/(dashboard)/dashboard/pos/page.tsx`

**Changes Made:**

1. **Import CustomerSelector:**
   ```typescript
   import { CustomerSelector, type Customer } from "@/components/pos/customer-selector"
   ```

2. **Add State:**
   ```typescript
   const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
   ```

3. **Clear Customer on Cart Clear:**
   ```typescript
   const clearCart = () => {
     setCart([])
     setSearch("")
     setProducts([])
     setCartDiscountType("FIXED")
     setCartDiscountValue(0)
     setSelectedCustomer(null) // Clear selected customer
   }
   ```

4. **Add Customer Selector UI:**
   Added in the Cart Summary card, before the discount section:
   ```tsx
   <div className="space-y-2">
     <Label className="text-sm font-medium">Cliente (Opcional)</Label>
     <CustomerSelector
       value={selectedCustomer}
       onChange={setSelectedCustomer}
       disabled={!hasCashRegister}
     />
     {selectedCustomer && (
       <div className="text-xs text-muted-foreground">
         Cliente seleccionado para la venta
       </div>
     )}
   </div>
   ```

5. **Pass Customer to Payment Dialog:**
   ```tsx
   <PaymentDialog
     open={showPayment}
     onClose={() => setShowPayment(false)}
     cart={cart}
     totals={totals}
     onSuccess={handlePaymentSuccess}
     initialPaymentMethod={initialPaymentMethod}
     customerId={selectedCustomer?.id ?? null}
     customerName={selectedCustomer?.name ?? null}
   />
   ```

### 5. Payment Dialog Integration

The PaymentDialog component already had support for customer validation:

**Existing Features:**
- Accepts `customerId` and `customerName` as props
- Validates customer presence when ACCOUNT payment method is used
- Displays warning if customer not selected for ACCOUNT payment
- Fetches customer account information when needed
- Shows customer balance and credit limit
- Validates credit availability before processing sale
- Includes customer in sale data when creating the sale

**No changes were needed** in the payment dialog as it already had proper customer handling.

## User Experience Flow

### Selecting a Customer

1. User opens POS page
2. In the Cart Summary section, user sees "Cliente (Opcional)" selector
3. User clicks the selector button
4. Popover opens showing customer search
5. User types to search by name, email, phone, or document
6. Results appear in real-time with customer details
7. User clicks on a customer to select them
8. Selected customer is displayed in the button
9. Helper text confirms "Cliente seleccionado para la venta"

### Using ACCOUNT Payment Method

1. User selects a customer using the selector
2. User adds products to cart
3. User clicks "Cuenta Corriente F6" payment button
4. Payment dialog opens showing:
   - Customer name
   - Current account balance
   - Available credit (if applicable)
   - Balance after the sale
5. If customer NOT selected:
   - Warning shown: "Debe seleccionar un cliente en el POS para usar cuenta corriente"
   - "Cobrar" button is disabled
6. If customer selected:
   - Customer account info is validated
   - Sale can be processed if credit is available

### Clearing Selection

The customer selection is automatically cleared when:
- Cart is cleared (ESC key or "Limpiar Carrito" button)
- Sale is successfully completed
- User clicks the selector again and chooses the same customer (toggles off)

## Multi-Tenant Security

All customer data is properly filtered by tenantId:
- Customer search API endpoint uses `tenantId: user.tenantId` filter
- Only customers belonging to the current tenant are shown
- Customer account validation also respects tenant boundaries

## API Endpoints Used

### GET /api/customers
- **Query Params**: `search` (optional string)
- **Returns**: Array of customers filtered by tenant
- **Search Fields**: name, email, phone, documentNumber
- **Already Existed**: Yes, no changes needed

### GET /api/customers/[id]/account
- **Returns**: Customer account with balance and credit limit
- **Used By**: Payment dialog to validate ACCOUNT payments
- **Already Existed**: Yes, no changes needed

## Testing Recommendations

### Manual Testing Checklist

1. **Customer Selection:**
   - [ ] Open POS page
   - [ ] Verify customer selector is visible in Cart Summary
   - [ ] Click selector and verify popover opens
   - [ ] Verify initial customers load
   - [ ] Type search query and verify results update
   - [ ] Select a customer and verify it displays correctly
   - [ ] Click selector again and select same customer to deselect

2. **ACCOUNT Payment Without Customer:**
   - [ ] Add products to cart without selecting customer
   - [ ] Click "Cuenta Corriente F6"
   - [ ] Verify warning message appears
   - [ ] Verify "Cobrar" button is disabled

3. **ACCOUNT Payment With Customer:**
   - [ ] Select a customer with active account
   - [ ] Add products to cart
   - [ ] Click "Cuenta Corriente F6"
   - [ ] Verify customer account info is displayed
   - [ ] Verify balance and credit calculations are correct
   - [ ] Process the sale successfully

4. **Customer Clearing:**
   - [ ] Select a customer and add products
   - [ ] Press ESC or click "Limpiar Carrito"
   - [ ] Verify customer selection is cleared
   - [ ] Select customer and complete a sale
   - [ ] Verify customer selection is cleared after successful sale

5. **Multi-tenant Isolation:**
   - [ ] Login as different tenants
   - [ ] Verify each tenant only sees their own customers
   - [ ] Verify customer search respects tenant boundaries

### Automated Testing

Consider adding:
- Component tests for CustomerSelector
- Integration tests for POS with customer selection
- E2E tests for complete flow with ACCOUNT payment

## Files Modified

- `/package.json` - Added dependencies
- `/components/ui/command.tsx` - New component
- `/components/ui/popover.tsx` - New component
- `/components/pos/customer-selector.tsx` - New component
- `/app/(dashboard)/dashboard/pos/page.tsx` - Updated with customer selection

## Files Not Modified

- `/components/pos/payment-dialog.tsx` - Already had customer support
- `/app/api/customers/route.ts` - Already supported search
- `/prisma/schema.prisma` - Customer model already existed

## Performance Considerations

1. **Debouncing**: 300ms debounce on search prevents excessive API calls
2. **Result Limiting**: Maximum 20 customers shown to prevent UI slowdown
3. **Lazy Loading**: Customers only fetched when popover opens
4. **Efficient Re-renders**: Component uses proper React hooks and state management

## Browser Compatibility

The implementation uses modern React and Radix UI components that support:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Future Enhancements

Potential improvements for the future:

1. **Quick Customer Creation**: Add "+ Nuevo Cliente" option in dropdown
2. **Recent Customers**: Show recently used customers at the top
3. **Customer Favorites**: Allow marking frequent customers for quick access
4. **Keyboard Navigation**: Add keyboard shortcuts for customer selection
5. **Customer Details Preview**: Show more customer info on hover
6. **Virtual Scrolling**: For tenants with thousands of customers
7. **Offline Support**: Cache frequently used customers

## Troubleshooting

### Customer Selector Not Appearing
- Check that user is logged in and has active session
- Verify user has an open cash register
- Check browser console for errors

### Customers Not Loading
- Check network tab for API request failures
- Verify user has proper permissions
- Check backend logs for authentication issues

### ACCOUNT Payment Still Disabled
- Verify customer is actually selected (check POS state)
- Confirm customer has an active account
- Check that account has available credit
- Verify customer belongs to current tenant

## Summary

The customer selection functionality has been successfully implemented in the SuperCommerce POS system. Users can now:

- Search and select customers in the POS interface
- Use the ACCOUNT payment method with proper validation
- See customer account information during checkout
- Have customers automatically associated with sales

The implementation follows existing codebase patterns, maintains multi-tenant security, and provides a smooth user experience.
