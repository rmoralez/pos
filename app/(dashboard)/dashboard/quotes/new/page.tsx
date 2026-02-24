"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Minus, Trash2, FileText, Save, Send, User, X, Calendar, ArrowLeft } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { VariantSelectorDialog } from "@/components/pos/variant-selector-dialog"

interface Product {
  id: string
  name: string
  sku: string
  salePrice: number
  taxRate: number
  stock: Array<{ quantity: number }>
  variants?: ProductVariant[]
}

interface ProductVariant {
  id: string
  sku: string
  variantValues: string
  salePrice: string
  costPrice: string
  Stock: Array<{ quantity: number }>
}

interface CartItem {
  product: Product
  variant?: ProductVariant
  quantity: number
  unitPrice: number
  taxRate: number
  discount: number
  total: number
}

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
}

export default function NewQuotePage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(0)
  const [showVariantSelector, setShowVariantSelector] = useState(false)
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Quote specific fields
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [validUntil, setValidUntil] = useState("")
  const [notes, setNotes] = useState("")
  const [cartDiscount, setCartDiscount] = useState(0)

  // Search products with debounce
  useEffect(() => {
    if (search.length < 2) {
      setProducts([])
      setSelectedProductIndex(0)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true)
        const normalizedSearch = search
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()

        const response = await fetch(
          `/api/products?search=${encodeURIComponent(normalizedSearch)}&isActive=true&limit=20`
        )

        if (!response.ok) throw new Error("Error al buscar productos")

        const data = await response.json()
        setProducts(data.slice(0, 20))
        setSelectedProductIndex(0)
      } catch (error) {
        console.error("Error searching products:", error)
        setProducts([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  // Search customers
  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomerResults([])
      setShowCustomerDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&limit=8`)
        if (res.ok) {
          const data = await res.json()
          setCustomerResults(Array.isArray(data) ? data.slice(0, 8) : [])
          setShowCustomerDropdown(true)
        }
      } catch {
        // ignore
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [customerSearch])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow navigation for product results
      if (products.length > 0 && document.activeElement === searchInputRef.current) {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setSelectedProductIndex((prev) => (prev + 1) % products.length)
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          setSelectedProductIndex((prev) => (prev - 1 + products.length) % products.length)
        } else if (e.key === "Enter" && products[selectedProductIndex]) {
          e.preventDefault()
          handleProductSelect(products[selectedProductIndex])
        }
      }

      // Focus search with F5 or /
      if ((e.key === "F5" || e.key === "/") && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // Clear cart with ESC
      if (e.key === "Escape" && cart.length > 0 && !showVariantSelector) {
        if (confirm("¿Limpiar el presupuesto?")) {
          clearCart()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [products, selectedProductIndex, cart, showVariantSelector])

  const handleProductSelect = (product: Product) => {
    // If product has variants, show selector
    if (product.variants && product.variants.length > 0) {
      setSelectedProductForVariant(product)
      setShowVariantSelector(true)
      return
    }

    // Add product without variant
    addToCart(product)
  }

  const addToCart = (product: Product, variant?: ProductVariant) => {
    const price = variant ? Number(variant.salePrice) : product.salePrice
    const cartKey = variant ? `${product.id}-${variant.id}` : product.id

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => {
        const itemKey = item.variant
          ? `${item.product.id}-${item.variant.id}`
          : item.product.id
        return itemKey === cartKey
      })

      if (existingIndex !== -1) {
        const newCart = [...prevCart]
        const item = newCart[existingIndex]
        const newQuantity = item.quantity + 1
        const itemTotal = price * newQuantity * (1 - item.discount / 100)

        newCart[existingIndex] = {
          ...item,
          quantity: newQuantity,
          total: itemTotal,
        }
        return newCart
      } else {
        return [
          ...prevCart,
          {
            product,
            variant,
            quantity: 1,
            unitPrice: price,
            taxRate: product.taxRate,
            discount: 0,
            total: price,
          },
        ]
      }
    })

    setSearch("")
    setProducts([])
    searchInputRef.current?.focus()
  }

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(index)
      return
    }

    setCart((prevCart) => {
      const newCart = [...prevCart]
      const item = newCart[index]
      const itemTotal = item.unitPrice * newQuantity * (1 - item.discount / 100)

      newCart[index] = {
        ...item,
        quantity: newQuantity,
        total: itemTotal,
      }
      return newCart
    })
  }

  const updateDiscount = (index: number, discount: number) => {
    setCart((prevCart) => {
      const newCart = [...prevCart]
      const item = newCart[index]
      const itemTotal = item.unitPrice * item.quantity * (1 - discount / 100)

      newCart[index] = {
        ...item,
        discount,
        total: itemTotal,
      }
      return newCart
    })
  }

  const removeFromCart = (index: number) => {
    setCart((prevCart) => prevCart.filter((_, i) => i !== index))
  }

  const clearCart = () => {
    setCart([])
    setSearch("")
    setProducts([])
    setCartDiscount(0)
    searchInputRef.current?.focus()
  }

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setCustomerSearch("")
    setShowCustomerDropdown(false)
  }

  const clearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerSearch("")
  }

  // Calculate totals
  const itemsSubtotal = cart.reduce((sum, item) => sum + item.total, 0)
  const cartDiscountAmount = itemsSubtotal * (cartDiscount / 100)
  const total = itemsSubtotal - cartDiscountAmount

  const handleSaveQuote = async (status: "DRAFT" | "SENT") => {
    if (cart.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un producto",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)

      const quoteData = {
        items: cart.map((item) => ({
          productId: item.product.id,
          productVariantId: item.variant?.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discount: item.discount,
        })),
        customerId: selectedCustomer?.id,
        discountAmount: cartDiscountAmount,
        validUntil: validUntil || undefined,
        notes: notes || undefined,
        status,
      }

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quoteData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Error al crear presupuesto")
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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/quotes")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nuevo Presupuesto</h1>
            <p className="text-sm text-muted-foreground">
              Crea una cotización para tus clientes
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left side - Products and Cart */}
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          {/* Search */}
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar producto por nombre, SKU o código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 text-lg h-12"
                  autoFocus
                />
              </div>

              {/* Product results */}
              {products.length > 0 && (
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                  {products.map((product, index) => {
                    const stockQty = product.stock?.reduce((sum, s) => sum + s.quantity, 0) || 0
                    const hasVariants = product.variants && product.variants.length > 0
                    const isSelected = index === selectedProductIndex

                    return (
                      <div
                        key={product.id}
                        onClick={() => handleProductSelect(product)}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10 border-primary" : "hover:bg-accent"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{product.name}</p>
                            {hasVariants && (
                              <Badge variant="outline" className="text-xs">
                                {product.variants!.length} variantes
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{product.sku}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={stockQty > 0 ? "default" : "destructive"}>
                            Stock: {stockQty}
                          </Badge>
                          <p className="text-lg font-bold">
                            ${Number(product.salePrice).toLocaleString("es-AR", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cart */}
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader>
              <CardTitle>Productos del Presupuesto</CardTitle>
              <CardDescription>
                {cart.length} {cart.length === 1 ? "producto" : "productos"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay productos agregados</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Busca productos para comenzar
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item, index) => {
                    const itemName = item.variant
                      ? `${item.product.name} (${item.variant.variantValues})`
                      : item.product.name

                    return (
                      <div
                        key={`${item.product.id}-${item.variant?.id || "base"}-${index}`}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{itemName}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>${item.unitPrice.toLocaleString("es-AR")}</span>
                            {item.discount > 0 && (
                              <span className="text-orange-600">-{item.discount}%</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Label className="text-xs">Dto.%</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount || ""}
                              onChange={(e) =>
                                updateDiscount(index, parseFloat(e.target.value) || 0)
                              }
                              className="h-6 w-16 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(index, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-12 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateQuantity(index, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeFromCart(index)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="text-right w-24">
                          <p className="font-bold">
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

        {/* Right side - Summary and Details */}
        <div className="w-96 border-l p-4 space-y-4 overflow-y-auto">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCustomer ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/40">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="text-sm flex-1 truncate">{selectedCustomer.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearCustomer}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Buscar cliente (opcional)..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    onFocus={() =>
                      customerSearch.length >= 2 && setShowCustomerDropdown(true)
                    }
                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                  />
                  {showCustomerDropdown && customerResults.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                          onMouseDown={() => selectCustomer(c)}
                        >
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Valid Until */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Válido Hasta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condiciones, comentarios adicionales..."
                className="min-h-[80px]"
              />
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs flex-1">Descuento General (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={cartDiscount || ""}
                  onChange={(e) => setCartDiscount(parseFloat(e.target.value) || 0)}
                  className="h-8 w-20 text-center"
                />
              </div>

              {cartDiscount > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${itemsSubtotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Descuento ({cartDiscount}%)</span>
                    <span>-${cartDiscountAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-2xl font-bold pt-2 border-t">
                <span>Total</span>
                <span>${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="space-y-2 pt-4">
                <Button
                  className="w-full"
                  onClick={() => handleSaveQuote("SENT")}
                  disabled={cart.length === 0 || isSaving}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isSaving ? "Guardando..." : "Guardar y Enviar"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleSaveQuote("DRAFT")}
                  disabled={cart.length === 0 || isSaving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Guardar como Borrador
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpiar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Variant Selector Dialog */}
      <VariantSelectorDialog
        open={showVariantSelector}
        productName={selectedProductForVariant?.name || ""}
        variants={selectedProductForVariant?.variants || []}
        onSelectVariant={(variant: any) => {
          if (selectedProductForVariant) {
            addToCart(selectedProductForVariant, variant)
          }
          setShowVariantSelector(false)
          setSelectedProductForVariant(null)
        }}
        onClose={() => {
          setShowVariantSelector(false)
          setSelectedProductForVariant(null)
        }}
      />
    </div>
  )
}
