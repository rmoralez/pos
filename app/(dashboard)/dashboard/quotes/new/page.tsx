"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Search, Plus, Minus, Trash2, FileText, Save, Send, Calendar, ArrowLeft, Percent } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { calculateDiscountAmount, type DiscountType } from "@/lib/pricing"
import { CustomerSelector, type Customer } from "@/components/pos/customer-selector"
import { VariantSelectorDialog } from "@/components/pos/variant-selector-dialog"
import { ItemDiscountDialog } from "@/components/pos/item-discount-dialog"

interface ProductVariant {
  id: string
  sku: string
  variantValues: string
  salePrice: string
  costPrice: string
  Stock: Array<{ quantity: number }>
}

interface Product {
  id: string
  sku: string
  name: string
  salePrice: number
  taxRate: number
  stock: Array<{ quantity: number }>
  hasVariants?: boolean
  ProductVariant?: ProductVariant[]
}

interface CartItem {
  product: Product
  quantity: number
  subtotal: number
  taxAmount: number
  total: number
  variant?: ProductVariant
  discountType: DiscountType
  discountValue: number
}

export default function NewQuotePage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [cartDiscountType, setCartDiscountType] = useState<DiscountType>("FIXED")
  const [cartDiscountValue, setCartDiscountValue] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showVariantSelector, setShowVariantSelector] = useState(false)
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null)
  const [showItemDiscount, setShowItemDiscount] = useState(false)
  const [selectedItemForDiscount, setSelectedItemForDiscount] = useState<{index: number, item: CartItem} | null>(null)
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(0)
  const [pendingQuantity, setPendingQuantity] = useState<number>(1)
  const [validUntil, setValidUntil] = useState("")
  const [notes, setNotes] = useState("")

  // Refs for focusing inputs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const discountInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    setSelectedProductIndex(0)
  }, [products])

  const addToCart = (product: Product) => {
    if (product.hasVariants && product.ProductVariant && product.ProductVariant.length > 0) {
      setSelectedProductForVariant(product)
      setShowVariantSelector(true)
      return
    }

    const stockTotal = product.stock.reduce((acc, s) => acc + s.quantity, 0)

    if (stockTotal === 0) {
      toast({
        title: "Sin stock",
        description: "Este producto no tiene stock disponible",
        variant: "destructive",
      })
      return
    }

    const existingItem = cart.find(item => item.product.id === product.id && !item.variant)
    const quantityToAdd = pendingQuantity

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantityToAdd
      if (newQuantity > stockTotal) {
        toast({
          title: "Stock insuficiente",
          description: `Solo hay ${stockTotal} unidades disponibles. Cantidad actual en carrito: ${existingItem.quantity}`,
          variant: "destructive",
        })
        return
      }
      updateQuantity(product.id, newQuantity)
    } else {
      if (quantityToAdd > stockTotal) {
        toast({
          title: "Stock insuficiente",
          description: `Solo hay ${stockTotal} unidades disponibles`,
          variant: "destructive",
        })
        return
      }
      const unitPrice = Number(product.salePrice)
      const taxRate = Number(product.taxRate)
      const total = unitPrice * quantityToAdd
      const subtotal = total / (1 + taxRate / 100)
      const taxAmount = total - subtotal

      setCart([...cart, {
        product,
        quantity: quantityToAdd,
        subtotal,
        taxAmount,
        total,
        discountType: "FIXED",
        discountValue: 0,
      }])
    }

    setPendingQuantity(1)
  }

  const addVariantToCart = (variant: ProductVariant) => {
    if (!selectedProductForVariant) return

    const stockTotal = variant.Stock.reduce((acc, s) => acc + s.quantity, 0)

    if (stockTotal === 0) {
      toast({
        title: "Sin stock",
        description: "Esta variante no tiene stock disponible",
        variant: "destructive",
      })
      return
    }

    const existingItem = cart.find(
      item => item.product.id === selectedProductForVariant.id && item.variant?.id === variant.id
    )
    const quantityToAdd = pendingQuantity

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantityToAdd
      if (newQuantity > stockTotal) {
        toast({
          title: "Stock insuficiente",
          description: `Solo hay ${stockTotal} unidades disponibles. Cantidad actual en carrito: ${existingItem.quantity}`,
          variant: "destructive",
        })
        return
      }
      setCart(cart.map(item => {
        if (item.product.id === selectedProductForVariant.id && item.variant?.id === variant.id) {
          const total = Number(variant.salePrice) * newQuantity
          const taxRate = Number(selectedProductForVariant.taxRate)
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
    } else {
      if (quantityToAdd > stockTotal) {
        toast({
          title: "Stock insuficiente",
          description: `Solo hay ${stockTotal} unidades disponibles`,
          variant: "destructive",
        })
        return
      }
      const unitPrice = Number(variant.salePrice)
      const taxRate = Number(selectedProductForVariant.taxRate)
      const total = unitPrice * quantityToAdd
      const subtotal = total / (1 + taxRate / 100)
      const taxAmount = total - subtotal

      setCart([...cart, {
        product: selectedProductForVariant,
        variant,
        quantity: quantityToAdd,
        subtotal,
        taxAmount,
        total,
        discountType: "FIXED",
        discountValue: 0,
      }])
    }

    setPendingQuantity(1)
  }

  const updateQuantity = (productId: string, newQuantity: number, variantId?: string) => {
    if (newQuantity <= 0) {
      removeFromCart(productId, variantId)
      return
    }

    setCart(cart.map(item => {
      const matchesProduct = item.product.id === productId
      const matchesVariant = variantId ? item.variant?.id === variantId : !item.variant

      if (matchesProduct && matchesVariant) {
        const unitPrice = item.variant ? Number(item.variant.salePrice) : Number(item.product.salePrice)
        const baseTotal = unitPrice * newQuantity

        const itemDiscountAmount = calculateDiscountAmount(baseTotal, item.discountType, item.discountValue)
        const totalAfterDiscount = baseTotal - itemDiscountAmount

        const taxRate = Number(item.product.taxRate)
        const subtotal = totalAfterDiscount / (1 + taxRate / 100)
        const taxAmount = totalAfterDiscount - subtotal

        return {
          ...item,
          quantity: newQuantity,
          subtotal,
          taxAmount,
          total: totalAfterDiscount,
        }
      }
      return item
    }))
  }

  const removeFromCart = (productId: string, variantId?: string) => {
    setCart(cart.filter(item => {
      const matchesProduct = item.product.id === productId
      const matchesVariant = variantId ? item.variant?.id === variantId : !item.variant
      return !(matchesProduct && matchesVariant)
    }))
  }

  const handleOpenItemDiscount = (index: number, item: CartItem) => {
    setSelectedItemForDiscount({ index, item })
    setShowItemDiscount(true)
  }

  const handleApplyItemDiscount = (discountType: DiscountType, discountValue: number) => {
    if (selectedItemForDiscount === null) return

    const { index, item } = selectedItemForDiscount

    setCart(cart.map((cartItem, idx) => {
      if (idx === index) {
        const unitPrice = item.variant ? Number(item.variant.salePrice) : Number(item.product.salePrice)
        const baseTotal = unitPrice * item.quantity

        const itemDiscountAmount = calculateDiscountAmount(baseTotal, discountType, discountValue)
        const totalAfterDiscount = baseTotal - itemDiscountAmount

        const taxRate = Number(item.product.taxRate)
        const subtotal = totalAfterDiscount / (1 + taxRate / 100)
        const taxAmount = totalAfterDiscount - subtotal

        return {
          ...cartItem,
          discountType,
          discountValue,
          subtotal,
          taxAmount,
          total: totalAfterDiscount,
        }
      }
      return cartItem
    }))
  }

  const getCartTotals = () => {
    const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0)
    const taxAmount = cart.reduce((acc, item) => acc + item.taxAmount, 0)
    const totalBeforeDiscount = cart.reduce((acc, item) => acc + item.total, 0)

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
    setPendingQuantity(1)
    setValidUntil("")
    setNotes("")
  }

  const handleSaveQuote = async (status: "DRAFT" | "SENT") => {
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

      const totals = getCartTotals()

      const quoteData = {
        items: cart.map(item => ({
          productId: item.product.id,
          variantId: item.variant?.id,
          quantity: item.quantity,
          unitPrice: item.variant ? Number(item.variant.salePrice) : Number(item.product.salePrice),
          taxRate: Number(item.product.taxRate),
          discount: item.discountValue,
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

      router.push("/dashboard/quotes")
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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()

      const numericValue = parseInt(search.trim())
      if (!isNaN(numericValue) && numericValue > 0 && search.trim() === numericValue.toString()) {
        setPendingQuantity(numericValue)
        setSearch("")
        setProducts([])
        toast({
          title: "Cantidad establecida",
          description: `Próximo producto: ${numericValue} unidad${numericValue > 1 ? 'es' : ''}`,
        })
        return
      }

      if (products.length > 0 && selectedProductIndex >= 0 && selectedProductIndex < products.length) {
        const selectedProduct = products[selectedProductIndex]
        addToCart(selectedProduct)
        toast({
          title: "Producto agregado",
          description: `${selectedProduct.name} agregado al presupuesto`,
        })
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (products.length > 0) {
        setSelectedProductIndex((prev) => (prev + 1) % products.length)
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (products.length > 0) {
        setSelectedProductIndex((prev) => (prev - 1 + products.length) % products.length)
      }
    }
  }

  const totals = getCartTotals()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/quotes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Nuevo Presupuesto</h1>
            <p className="text-muted-foreground">
              Crea una cotización para tus clientes
            </p>
          </div>
        </div>
      </div>

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
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="pl-10"
                    autoFocus
                  />
                </div>
                {pendingQuantity > 1 && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <Badge variant="default" className="bg-blue-600">
                      Cantidad: {pendingQuantity}
                    </Badge>
                    <span className="text-sm text-blue-700">
                      El próximo producto se agregará con {pendingQuantity} unidades
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingQuantity(1)}
                      className="ml-auto h-6 px-2 text-xs"
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>

              {products.length > 0 && (
                <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
                  {products.map((product, index) => {
                    const stockTotal = product.stock.reduce((acc, s) => acc + s.quantity, 0)
                    const isSelected = index === selectedProductIndex
                    return (
                      <div
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className={`flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10 border-primary" : ""
                        }`}
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
              <CardTitle>Productos del Presupuesto</CardTitle>
              <CardDescription>
                {cart.length} {cart.length === 1 ? "producto" : "productos"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No hay productos agregados</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Busca productos para comenzar
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item, index) => {
                    const itemPrice = item.variant ? Number(item.variant.salePrice) : item.product.salePrice
                    const parseVariantValues = (variantValues: string): Record<string, string> => {
                      try {
                        return JSON.parse(variantValues)
                      } catch {
                        return {}
                      }
                    }

                    const baseTotal = itemPrice * item.quantity
                    const itemDiscountAmount = calculateDiscountAmount(baseTotal, item.discountType, item.discountValue)
                    const hasItemDiscount = item.discountValue > 0

                    return (
                      <div
                        key={item.variant ? `${item.product.id}-${item.variant.id}` : `${item.product.id}-${index}`}
                        className="flex items-center gap-4 p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.product.name}</p>
                          {item.variant && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(parseVariantValues(item.variant.variantValues)).map(
                                ([key, value]) => (
                                  <Badge key={key} variant="secondary" className="text-xs">
                                    {key}: {value}
                                  </Badge>
                                )
                              )}
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground mt-1">
                            ${itemPrice.toLocaleString("es-AR")} x {item.quantity}
                          </p>
                          {hasItemDiscount && (
                            <div className="text-xs text-green-600 font-medium mt-1">
                              Descuento: -{itemDiscountAmount.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={hasItemDiscount ? "default" : "outline"}
                            size="icon"
                            onClick={() => handleOpenItemDiscount(index, item)}
                            aria-label="Discount"
                            title="Aplicar descuento"
                            className={hasItemDiscount ? "bg-green-600 hover:bg-green-700" : "border-orange-300 hover:bg-orange-50"}
                          >
                            <Percent className={`h-4 w-4 ${hasItemDiscount ? "text-white" : "text-orange-600"}`} />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.variant?.id)}
                            aria-label="Minus"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-12 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variant?.id)}
                            aria-label="Plus"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromCart(item.product.id, item.variant?.id)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">${item.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
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
              </div>

              {/* Valid Until */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Válido hasta (Opcional)</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notas (Opcional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Condiciones, comentarios..."
                  className="min-h-[80px]"
                />
              </div>

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
                      placeholder={cartDiscountType === "PERCENTAGE" ? "%" : "$"}
                      className="flex-1"
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
                <Button
                  className="w-full"
                  disabled={cart.length === 0 || isSaving}
                  onClick={() => handleSaveQuote("DRAFT")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Guardando..." : "Guardar Borrador"}
                </Button>
                <Button
                  className="w-full"
                  variant="default"
                  disabled={cart.length === 0 || isSaving}
                  onClick={() => handleSaveQuote("SENT")}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isSaving ? "Guardando..." : "Guardar y Enviar"}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
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

      <VariantSelectorDialog
        open={showVariantSelector}
        onClose={() => {
          setShowVariantSelector(false)
          setSelectedProductForVariant(null)
        }}
        productName={selectedProductForVariant?.name || ""}
        variants={selectedProductForVariant?.ProductVariant || []}
        onSelectVariant={addVariantToCart}
      />

      <ItemDiscountDialog
        open={showItemDiscount}
        onClose={() => {
          setShowItemDiscount(false)
          setSelectedItemForDiscount(null)
        }}
        itemName={selectedItemForDiscount?.item.product.name || ""}
        unitPrice={selectedItemForDiscount?.item.variant
          ? Number(selectedItemForDiscount.item.variant.salePrice)
          : selectedItemForDiscount?.item.product.salePrice || 0}
        quantity={selectedItemForDiscount?.item.quantity || 0}
        currentDiscountType={selectedItemForDiscount?.item.discountType || "FIXED"}
        currentDiscountValue={selectedItemForDiscount?.item.discountValue || 0}
        onApply={handleApplyItemDiscount}
      />
    </div>
  )
}
