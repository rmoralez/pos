"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import Link from "next/link"

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
      const subtotal = Number(product.salePrice)
      const taxAmount = (subtotal * Number(product.taxRate)) / 100
      const total = subtotal + taxAmount

      setCart([...cart, {
        product,
        quantity: 1,
        subtotal,
        taxAmount,
        total,
      }])
      setSearch("")
      setProducts([])
    }
  }

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const subtotal = Number(item.product.salePrice) * newQuantity
        const taxAmount = (subtotal * Number(item.product.taxRate)) / 100
        const total = subtotal + taxAmount

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
    const total = cart.reduce((acc, item) => acc + item.total, 0)

    return { subtotal, taxAmount, total }
  }

  const clearCart = () => {
    setCart([])
    setSearch("")
    setProducts([])
  }

  const handlePaymentSuccess = () => {
    setShowPayment(false)
    clearCart()
    toast({
      title: "Venta completada",
      description: "La venta se ha registrado exitosamente",
    })
  }

  const totals = getCartTotals()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Punto de Venta</h1>
        <p className="text-muted-foreground">
          Registra ventas de forma rápida y sencilla
        </p>
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
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFromCart(item.product.id)}
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
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    ${totals.subtotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA</span>
                  <span className="font-medium">
                    ${totals.taxAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${totals.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  className="w-full"
                  size="lg"
                  disabled={cart.length === 0 || !hasCashRegister}
                  onClick={() => setShowPayment(true)}
                >
                  <DollarSign className="mr-2 h-5 w-5" />
                  Procesar Pago
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                >
                  Limpiar Carrito
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
      />
    </div>
  )
}
