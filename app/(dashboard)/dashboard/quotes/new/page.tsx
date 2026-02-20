"use client"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus, Minus, Trash2, ShoppingCart, Save, Send, User, X, Calendar } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface Product {
  id: string
  sku: string
  name: string
  barcode?: string | null
  salePrice: number
  taxRate: number
  stock: Array<{ quantity: number }>
}

interface CartItem {
  product: Product
  quantity: number
  discount: number
  total: number
}

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
}

function computeItemTotal(price: number, quantity: number, discount: number): number {
  return price * (1 - discount / 100) * quantity
}

export default function NewQuotePage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Customer selection
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // Quote fields
  const [cartDiscount, setCartDiscount] = useState<number>(0)
  const [validUntil, setValidUntil] = useState<string>("")
  const [notes, setNotes] = useState<string>("")

  // Search customers
  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomerResults([])
      setShowCustomerDropdown(false)
      return
    }
    const timer = setTimeout(async () => {
      setIsSearchingCustomer(true)
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&limit=8`)
        if (res.ok) {
          const data = await res.json()
          setCustomerResults(Array.isArray(data) ? data.slice(0, 8) : [])
          setShowCustomerDropdown(true)
        }
      } catch {
        // ignore
      } finally {
        setIsSearchingCustomer(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [customerSearch])

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c)
    setCustomerSearch("")
    setCustomerResults([])
    setShowCustomerDropdown(false)
  }

  const clearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerSearch("")
    setCustomerResults([])
  }

  // Search products
  const searchProducts = useCallback(async () => {
    try {
      setIsSearching(true)
      const response = await fetch(`/api/products?search=${encodeURIComponent(search)}&isActive=true`)
      if (!response.ok) throw new Error("Failed to search products")
      const data = await response.json()
      setProducts(data.slice(0, 10))
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

  // Cart operations
  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id)

      if (existingItem) {
        return prevCart.map(item => {
          if (item.product.id === product.id) {
            const newQty = item.quantity + 1
            return {
              ...item,
              quantity: newQty,
              total: computeItemTotal(Number(item.product.salePrice), newQty, item.discount),
            }
          }
          return item
        })
      } else {
        return [
          ...prevCart,
          {
            product,
            quantity: 1,
            discount: 0,
            total: Number(product.salePrice),
          },
        ]
      }
    })
  }

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCart(cart.map(item => {
      if (item.product.id === productId) {
        return {
          ...item,
          quantity: newQuantity,
          total: computeItemTotal(Number(item.product.salePrice), newQuantity, item.discount),
        }
      }
      return item
    }))
  }

  const updateItemDiscount = (productId: string, discountStr: string) => {
    const parsed = parseFloat(discountStr)
    const discount = isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed))
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        return {
          ...item,
          discount,
          total: computeItemTotal(Number(item.product.salePrice), item.quantity, discount),
        }
      }
      return item
    }))
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId))
  }

  // Totals
  const getCartTotals = () => {
    const itemsSubtotal = cart.reduce((acc, item) => acc + item.total, 0)
    const cartDiscountAmount = itemsSubtotal * (cartDiscount / 100)
    const subtotalAfterDiscount = itemsSubtotal - cartDiscountAmount
    const total = subtotalAfterDiscount
    return { itemsSubtotal, cartDiscountAmount, subtotalAfterDiscount, total }
  }

  const clearCart = () => {
    setCart([])
    setSearch("")
    setProducts([])
    setCartDiscount(0)
  }

  const totals = getCartTotals()

  // Save quote
  const handleSave = async (status: "DRAFT" | "SENT") => {
    if (cart.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un producto al presupuesto",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)

      const quoteData = {
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: Number(item.product.salePrice),
          taxRate: Number(item.product.taxRate),
          discount: item.discount,
        })),
        customerId: selectedCustomer?.id,
        discountAmount: totals.cartDiscountAmount,
        validUntil: validUntil || undefined,
        notes: notes || undefined,
        status,
      }

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(quoteData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Error al crear el presupuesto")
      }

      const quote = await response.json()

      toast({
        title: "Presupuesto creado",
        description: `Presupuesto ${quote.quoteNumber} creado exitosamente`,
      })

      router.push(`/dashboard/quotes/${quote.id}`)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el presupuesto",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Presupuesto</h1>
          <p className="text-muted-foreground">
            Crea un nuevo presupuesto para tus clientes
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Search */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Buscar Productos</CardTitle>
              <CardDescription>
                Busca por nombre o SKU
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  autoFocus
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
              <CardTitle>Items del Presupuesto</CardTitle>
              <CardDescription>
                {cart.length} {cart.length === 1 ? "producto" : "productos"} agregados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay productos agregados</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Busca productos para comenzar
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => {
                    const effectivePrice = Number(item.product.salePrice) * (1 - item.discount / 100)
                    return (
                      <div
                        key={item.product.id}
                        className="flex items-start gap-4 p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.product.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <p className="text-sm text-muted-foreground">
                              ${Number(item.product.salePrice).toLocaleString("es-AR")}
                            </p>
                            {item.discount > 0 && (
                              <>
                                <span className="text-xs text-green-600 font-medium">
                                  -{item.discount}%
                                </span>
                                <span className="text-xs font-medium">
                                  ${effectivePrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                </span>
                              </>
                            )}
                            <span className="text-xs text-muted-foreground">x {item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">
                              Dto. %
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={item.discount === 0 ? "" : item.discount}
                              onChange={e => updateItemDiscount(item.product.id, e.target.value)}
                              placeholder="0"
                              className="h-6 w-16 text-xs text-center px-1"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="text-right shrink-0 w-20">
                          <p className="font-bold text-sm">
                            ${item.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary & Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {(totals.cartDiscountAmount > 0 || cartDiscount > 0) && (
                  <>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal</span>
                      <span>${totals.itemsSubtotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    {totals.cartDiscountAmount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Descuento gral. ({cartDiscount}%)</span>
                        <span>-${totals.cartDiscountAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between text-2xl font-bold">
                  <span>Total</span>
                  <span>${totals.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {cart.length > 0 && (
                <div className="flex items-center gap-2 border rounded-md px-3 py-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap flex-1">
                    Descuento general (%)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={cartDiscount === 0 ? "" : cartDiscount}
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      setCartDiscount(isNaN(val) ? 0 : Math.min(100, Math.max(0, val)))
                    }}
                    placeholder="0"
                    className="h-7 w-16 text-xs text-center px-1"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalles del Presupuesto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cliente (opcional)</Label>
                {selectedCustomer ? (
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/40">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium flex-1 truncate">{selectedCustomer.name}</span>
                    <button
                      type="button"
                      onClick={clearCustomer}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Buscar cliente..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      onFocus={() => customerSearch.length >= 2 && setShowCustomerDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                      className="text-sm h-9"
                    />
                    {isSearchingCustomer && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">...</span>
                    )}
                    {showCustomerDropdown && customerResults.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                        {customerResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                            onMouseDown={() => selectCustomer(c)}
                          >
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{c.name}</span>
                            {c.email && <span className="text-xs text-muted-foreground truncate">{c.email}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Valid Until */}
              <div className="space-y-1">
                <Label htmlFor="validUntil" className="text-xs text-muted-foreground">Válido hasta (opcional)</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="validUntil"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label htmlFor="notes" className="text-xs text-muted-foreground">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Condiciones, comentarios adicionales..."
                  className="min-h-[80px]"
                />
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-4">
                <Button
                  className="w-full"
                  onClick={() => handleSave("SENT")}
                  disabled={cart.length === 0 || isSaving}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isSaving ? "Guardando..." : "Guardar y Enviar"}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleSave("DRAFT")}
                  disabled={cart.length === 0 || isSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Guardar como Borrador
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  size="sm"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                >
                  Limpiar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
