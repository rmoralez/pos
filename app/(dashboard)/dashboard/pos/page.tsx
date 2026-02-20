"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, Plus, Minus, Trash2, ShoppingCart, DollarSign, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { PaymentDialog } from "@/components/pos/payment-dialog"
import { KeyboardShortcutsHelp, KeyboardShortcutsTrigger } from "@/components/pos/keyboard-shortcuts-help"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import Link from "next/link"
import { calculateDiscountAmount, type DiscountType } from "@/lib/pricing"
import { CustomerSelector, type Customer } from "@/components/pos/customer-selector"

interface Product {
  id: string
  sku: string
  name: string
  salePrice: number
  taxRate: number
  stock: Array<{ quantity: number }>
}

interface CartItem {
  product: Product
  quantity: number
  subtotal: number
  taxAmount: number
  total: number
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [hasCashRegister, setHasCashRegister] = useState(true)
  const [checkingCashRegister, setCheckingCashRegister] = useState(true)
  const [cartDiscountType, setCartDiscountType] = useState<DiscountType>("FIXED")
  const [cartDiscountValue, setCartDiscountValue] = useState(0)
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<string>("CASH")
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Refs for focusing inputs via keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null)
  const discountInputRef = useRef<HTMLInputElement>(null)

  // Check for open cash register on component mount
  useEffect(() => {
    const checkCashRegister = async () => {
      try {
        const response = await fetch("/api/cash-registers/current")
        setHasCashRegister(response.ok)
      } catch (error) {
        console.error("Error checking cash register:", error)
        setHasCashRegister(false)
      } finally {
        setCheckingCashRegister(false)
      }
    }

    checkCashRegister()
  }, [])

  const searchProducts = useCallback(async () => {
    try {
      setIsSearching(true)
      const response = await fetch(`/api/products?search=${encodeURIComponent(search)}&isActive=true`)
      if (!response.ok) throw new Error("Failed to search products")
      const data = await response.json()
      setProducts(data.slice(0, 10)) // Limit to 10 results
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron buscar los productos",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }, [search])

  useEffect(() => {
    if (search.length >= 2) {
      searchProducts()
    } else {
      setProducts([])
    }
  }, [search, searchProducts])

  const addToCart = (product: Product) => {
    const stockTotal = product.stock.reduce((acc, s) => acc + s.quantity, 0)

    if (stockTotal === 0) {
      toast({
        title: "Sin stock",
        description: "Este producto no tiene stock disponible",
        variant: "destructive",
      })
      return
    }

    const existingItem = cart.find(item => item.product.id === product.id)

    if (existingItem) {
      if (existingItem.quantity >= stockTotal) {
        toast({
          title: "Stock insuficiente",
          description: `Solo hay ${stockTotal} unidades disponibles`,
          variant: "destructive",
        })
        return
      }
      updateQuantity(product.id, existingItem.quantity + 1)
    } else {
      // salePrice already includes tax - we just extract it for display purposes
      const total = Number(product.salePrice)
      const taxRate = Number(product.taxRate)
      const subtotal = total / (1 + taxRate / 100)
      const taxAmount = total - subtotal

      setCart([...cart, {
        product,
        quantity: 1,
        subtotal,
        taxAmount,
        total,
      }])
      // Don't clear search - allows adding multiple items quickly
    }
  }

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCart(cart.map(item => {
      if (item.product.id === productId) {
        // salePrice already includes tax - we just extract it for display purposes
        const total = Number(item.product.salePrice) * newQuantity
        const taxRate = Number(item.product.taxRate)
        const subtotal = total / (1 + taxRate / 100)
        const taxAmount = total - subtotal

        return {
          ...item,
          quantity: newQuantity,
          subtotal,
          taxAmount,
          total,
        }
      }
      return item
    }))
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId))
  }

  const getCartTotals = () => {
    const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0)
    const taxAmount = cart.reduce((acc, item) => acc + item.taxAmount, 0)
    const totalBeforeDiscount = cart.reduce((acc, item) => acc + item.total, 0)

    // Calculate cart-level discount
    const cartDiscountAmount = calculateDiscountAmount(totalBeforeDiscount, cartDiscountType, cartDiscountValue)
    const total = totalBeforeDiscount - cartDiscountAmount

    return {
      subtotal,
      taxAmount,
      total,
      cartDiscountAmount,
      cartDiscountType,
      cartDiscountValue
    }
  }

  const clearCart = () => {
    setCart([])
    setSearch("")
    setProducts([])
    setCartDiscountType("FIXED")
    setCartDiscountValue(0)
    setSelectedCustomer(null)
  }

  const handleClearCartWithConfirmation = () => {
    if (cart.length === 0) return

    const confirmed = window.confirm(
      "¿Estás seguro de que deseas limpiar el carrito? Se perderán todos los productos."
    )

    if (confirmed) {
      clearCart()
      toast({
        title: "Carrito limpiado",
        description: "Se han eliminado todos los productos del carrito",
      })
    }
  }

  const handleOpenPayment = (method: string) => {
    if (cart.length === 0 || !hasCashRegister) return
    setInitialPaymentMethod(method)
    setShowPayment(true)
  }

  const handleFocusSearch = () => {
    searchInputRef.current?.focus()
  }

  const handleFocusDiscount = () => {
    if (cart.length === 0) return
    discountInputRef.current?.focus()
  }

  const handleAddFirstProduct = () => {
    if (products.length > 0 && search.length >= 2) {
      addToCart(products[0])
      toast({
        title: "Producto agregado",
        description: `${products[0].name} agregado al carrito`,
      })
    }
  }

  const handlePaymentSuccess = () => {
    setShowPayment(false)
    clearCart()
    toast({
      title: "Venta completada",
      description: "La venta se ha registrado exitosamente",
    })
  }

  // Keyboard shortcuts - only active when payment dialog is closed
  useKeyboardShortcuts([
    // Payment methods
    {
      key: "F1",
      description: "Abrir pago con Efectivo",
      action: () => handleOpenPayment("CASH"),
      disabled: showPayment,
    },
    {
      key: "1",
      description: "Abrir pago con Efectivo",
      action: () => handleOpenPayment("CASH"),
      disabled: showPayment,
    },
    {
      key: "F2",
      description: "Abrir pago con Débito",
      action: () => handleOpenPayment("DEBIT_CARD"),
      disabled: showPayment,
    },
    {
      key: "2",
      description: "Abrir pago con Débito",
      action: () => handleOpenPayment("DEBIT_CARD"),
      disabled: showPayment,
    },
    {
      key: "F3",
      description: "Abrir pago con Crédito",
      action: () => handleOpenPayment("CREDIT_CARD"),
      disabled: showPayment,
    },
    {
      key: "3",
      description: "Abrir pago con Crédito",
      action: () => handleOpenPayment("CREDIT_CARD"),
      disabled: showPayment,
    },
    {
      key: "F4",
      description: "Abrir pago con Transferencia",
      action: () => handleOpenPayment("TRANSFER"),
      disabled: showPayment,
    },
    {
      key: "4",
      description: "Abrir pago con Transferencia",
      action: () => handleOpenPayment("TRANSFER"),
      disabled: showPayment,
    },
    {
      key: "F6",
      description: "Abrir pago con Cuenta Corriente",
      action: () => handleOpenPayment("ACCOUNT"),
      disabled: showPayment,
    },
    {
      key: "6",
      description: "Abrir pago con Cuenta Corriente",
      action: () => handleOpenPayment("ACCOUNT"),
      disabled: showPayment,
    },
    // Search
    {
      key: "F5",
      description: "Focus en búsqueda de productos",
      action: handleFocusSearch,
      disabled: showPayment,
    },
    {
      key: "/",
      description: "Focus en búsqueda de productos",
      action: handleFocusSearch,
      disabled: showPayment,
    },
    // Discount
    {
      key: "D",
      description: "Focus en input de descuento",
      action: handleFocusDiscount,
      disabled: showPayment,
    },
    {
      key: "%",
      description: "Cambiar a descuento porcentual",
      action: () => {
        if (cart.length === 0) return
        setCartDiscountType("PERCENTAGE")
        setCartDiscountValue(0)
        discountInputRef.current?.focus()
      },
      disabled: showPayment,
    },
    {
      key: "$",
      description: "Cambiar a descuento monto fijo",
      action: () => {
        if (cart.length === 0) return
        setCartDiscountType("FIXED")
        setCartDiscountValue(0)
        discountInputRef.current?.focus()
      },
      disabled: showPayment,
    },
    // Cart actions
    {
      key: "Escape",
      description: "Limpiar carrito",
      action: handleClearCartWithConfirmation,
      disabled: showPayment,
    },
    // Help
    {
      key: "?",
      description: "Mostrar ayuda de atajos",
      action: () => setShowShortcutsHelp(true),
      disabled: showPayment,
    },
  ])

  // Handle Enter key in search input to add first product
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddFirstProduct()
    }
  }

  const totals = getCartTotals()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Punto de Venta</h1>
          <p className="text-muted-foreground">
            Registra ventas de forma rápida y sencilla
          </p>
        </div>
        <KeyboardShortcutsTrigger onClick={() => setShowShortcutsHelp(true)} />
      </div>

      {!checkingCashRegister && !hasCashRegister && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No hay caja abierta</AlertTitle>
          <AlertDescription>
            Debes abrir una caja antes de poder registrar ventas.{" "}
            <Link href="/dashboard/cash" className="underline font-medium">
              Ir a Gestión de Caja
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Search */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Buscar Productos</CardTitle>
              <CardDescription>
                Busca por nombre, SKU o código de barras
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar producto... (F5 o /)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="pl-10"
                  autoFocus
                  aria-keyshortcuts="F5 /"
                />
              </div>

              {products.length > 0 && (
                <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
                  {products.map((product) => {
                    const stockTotal = product.stock.reduce((acc, s) => acc + s.quantity, 0)
                    return (
                      <div
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.sku}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={stockTotal > 0 ? "default" : "destructive"}>
                            Stock: {stockTotal}
                          </Badge>
                          <p className="text-lg font-bold">
                            ${Number(product.salePrice).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cart Items */}
          <Card>
            <CardHeader>
              <CardTitle>Carrito</CardTitle>
              <CardDescription>
                {cart.length} {cart.length === 1 ? "producto" : "productos"} en el carrito
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">El carrito está vacío</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Busca productos para comenzar
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center gap-4 p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          ${item.product.salePrice.toLocaleString("es-AR")} x {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          aria-label="Minus"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          aria-label="Plus"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFromCart(item.product.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${item.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Cliente (Opcional)</Label>
                <CustomerSelector
                  value={selectedCustomer}
                  onChange={setSelectedCustomer}
                />
                {selectedCustomer && (
                  <div className="text-xs text-muted-foreground">
                    Cliente seleccionado para la venta
                  </div>
                )}
              </div>

              {/* Prices already include tax - no need to display IVA separately */}

              {/* Discount Section */}
              {cart.length > 0 && (
                <div className="border-t pt-4 space-y-3">
                  <Label className="text-sm font-medium">Descuento General</Label>
                  <RadioGroup
                    value={cartDiscountType}
                    onValueChange={(value) => {
                      setCartDiscountType(value as DiscountType)
                      setCartDiscountValue(0)
                    }}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="PERCENTAGE" id="discount-percentage" />
                      <Label htmlFor="discount-percentage" className="font-normal cursor-pointer">
                        Porcentaje
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="FIXED" id="discount-fixed" />
                      <Label htmlFor="discount-fixed" className="font-normal cursor-pointer">
                        Monto Fijo
                      </Label>
                    </div>
                  </RadioGroup>
                  <div className="flex items-center gap-2">
                    <Input
                      ref={discountInputRef}
                      type="number"
                      min="0"
                      step={cartDiscountType === "PERCENTAGE" ? "1" : "0.01"}
                      max={cartDiscountType === "PERCENTAGE" ? "100" : undefined}
                      value={cartDiscountValue === 0 ? "" : cartDiscountValue}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        if (cartDiscountType === "PERCENTAGE") {
                          setCartDiscountValue(Math.min(100, Math.max(0, value)))
                        } else {
                          const totalBeforeDiscount = cart.reduce((acc, item) => acc + item.total, 0)
                          setCartDiscountValue(Math.min(totalBeforeDiscount, Math.max(0, value)))
                        }
                      }}
                      placeholder={cartDiscountType === "PERCENTAGE" ? "% (Shift+5)" : "$ (Shift+4)"}
                      className="flex-1"
                      aria-keyshortcuts="D"
                    />
                    {cartDiscountType === "PERCENTAGE" && (
                      <span className="text-sm text-muted-foreground">%</span>
                    )}
                  </div>
                  {totals.cartDiscountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Descuento aplicado:</span>
                      <span className="font-medium">
                        -${totals.cartDiscountAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-2 flex justify-between text-2xl font-bold">
                <span>Total</span>
                <span>${totals.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    disabled={cart.length === 0 || !hasCashRegister}
                    onClick={() => handleOpenPayment("CASH")}
                    aria-keyshortcuts="F1 1"
                    className="relative"
                  >
                    <span className="flex items-center gap-1">
                      Efectivo
                      <kbd className="hidden sm:inline-block ml-1 px-1 py-0.5 text-xs font-mono bg-primary-foreground/20 rounded">
                        F1
                      </kbd>
                    </span>
                  </Button>
                  <Button
                    size="sm"
                    disabled={cart.length === 0 || !hasCashRegister}
                    onClick={() => handleOpenPayment("DEBIT_CARD")}
                    aria-keyshortcuts="F2 2"
                    className="relative"
                  >
                    <span className="flex items-center gap-1">
                      Débito
                      <kbd className="hidden sm:inline-block ml-1 px-1 py-0.5 text-xs font-mono bg-primary-foreground/20 rounded">
                        F2
                      </kbd>
                    </span>
                  </Button>
                  <Button
                    size="sm"
                    disabled={cart.length === 0 || !hasCashRegister}
                    onClick={() => handleOpenPayment("CREDIT_CARD")}
                    aria-keyshortcuts="F3 3"
                    className="relative"
                  >
                    <span className="flex items-center gap-1">
                      Crédito
                      <kbd className="hidden sm:inline-block ml-1 px-1 py-0.5 text-xs font-mono bg-primary-foreground/20 rounded">
                        F3
                      </kbd>
                    </span>
                  </Button>
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  variant="outline"
                  disabled={cart.length === 0 || !hasCashRegister}
                  onClick={() => handleOpenPayment("TRANSFER")}
                  aria-keyshortcuts="F4 4"
                >
                  <span className="flex items-center justify-center gap-2">
                    Transferencia
                    <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">
                      F4
                    </kbd>
                  </span>
                </Button>
                <Button
                  className="w-full"
                  size="sm"
                  variant="outline"
                  disabled={cart.length === 0 || !hasCashRegister}
                  onClick={() => handleOpenPayment("ACCOUNT")}
                  aria-keyshortcuts="F6 6"
                >
                  <span className="flex items-center justify-center gap-2">
                    Cuenta Corriente
                    <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">
                      F6
                    </kbd>
                  </span>
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleClearCartWithConfirmation}
                  disabled={cart.length === 0}
                  aria-keyshortcuts="Escape"
                >
                  <span className="flex items-center justify-center gap-2">
                    Limpiar Carrito
                    <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">
                      ESC
                    </kbd>
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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

      <KeyboardShortcutsHelp
        open={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </div>
  )
}
