"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Receipt,
  DollarSign,
  BarChart3,
  Settings,
  Store,
  Banknote,
  FolderOpen,
  FileText,
  CreditCard,
  Truck,
  ClipboardList,
  FileSpreadsheet,
  Landmark,
} from "lucide-react"

const navigation = [
  { name: "POS", href: "/dashboard/pos", icon: ShoppingCart },
  { name: "Productos", href: "/dashboard/products", icon: Package },
  { name: "Stock", href: "/dashboard/stock", icon: Boxes },
  { name: "Ventas", href: "/dashboard/sales", icon: Receipt },
  { name: "Presupuestos", href: "/dashboard/quotes", icon: FileText },
  { name: "Órdenes de Compra", href: "/dashboard/purchase-orders", icon: ClipboardList },
  { name: "Caja", href: "/dashboard/cash", icon: DollarSign },
  { name: "Tesorería", href: "/dashboard/treasury", icon: Landmark },
  { name: "Caja Chica", href: "/dashboard/petty-cash", icon: Banknote },
  { name: "Cuentas", href: "/dashboard/cash-accounts", icon: FolderOpen },
  { name: "Ctas. Corrientes", href: "/dashboard/accounts", icon: CreditCard },
  { name: "Ctas. por Pagar", href: "/dashboard/accounts-payable", icon: FileSpreadsheet },
  { name: "Clientes", href: "/dashboard/customers", icon: Users },
  { name: "Proveedores", href: "/dashboard/suppliers", icon: Truck },
  { name: "P&L / Resultado", href: "/dashboard/reports/profit-loss", icon: BarChart3 },
  { name: "Configuración", href: "/dashboard/settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col fixed inset-y-0 z-50 bg-gray-900">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gray-900 border-b border-gray-800">
          <Store className="h-8 w-8 text-primary" />
          <span className="ml-2 text-xl font-bold text-white">
            SuperCommerce
          </span>
        </div>
        <div className="flex-1 flex flex-col overflow-y-auto">
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-gray-800 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0",
                      isActive ? "text-primary" : "text-gray-400 group-hover:text-gray-300"
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}
