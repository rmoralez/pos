import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/db"
import { DollarSign, Package, ShoppingCart, Users } from "lucide-react"

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user) {
    return null
  }

  // Get statistics
  const [productsCount, customersCount, salesCount, totalRevenue] = await Promise.all([
    prisma.product.count({
      where: { tenantId: user.tenantId, isActive: true },
    }),
    prisma.customer.count({
      where: { tenantId: user.tenantId },
    }),
    prisma.sale.count({
      where: { tenantId: user.tenantId, status: "COMPLETED" },
    }),
    prisma.sale.aggregate({
      where: { tenantId: user.tenantId, status: "COMPLETED" },
      _sum: { total: true },
    }),
  ])

  const stats = [
    {
      title: "Ventas Totales",
      value: salesCount,
      description: "Ventas completadas",
      icon: ShoppingCart,
    },
    {
      title: "Ingresos",
      value: `$${(totalRevenue._sum.total || 0).toLocaleString("es-AR")}`,
      description: "Total recaudado",
      icon: DollarSign,
    },
    {
      title: "Productos",
      value: productsCount,
      description: "Productos activos",
      icon: Package,
    },
    {
      title: "Clientes",
      value: customersCount,
      description: "Clientes registrados",
      icon: Users,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenido, {user.name}. Aquí tienes un resumen de tu negocio.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bienvenido a SuperCommerce POS</CardTitle>
            <CardDescription>
              Sistema de punto de venta completo para tu negocio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Funcionalidades principales:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Punto de venta (POS) con múltiples medios de pago</li>
                <li>• Gestión de productos y stock por sucursal</li>
                <li>• Control de caja diario</li>
                <li>• Facturación electrónica AFIP</li>
                <li>• Reportes y estadísticas</li>
                <li>• Sistema multi-tenant y multi-sucursal</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accesos Rápidos</CardTitle>
            <CardDescription>
              Accede a las funciones más utilizadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/dashboard/pos"
              className="flex items-center p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <ShoppingCart className="h-5 w-5 mr-3 text-primary" />
              <div>
                <p className="font-medium">Punto de Venta</p>
                <p className="text-xs text-muted-foreground">Realizar ventas</p>
              </div>
            </a>
            <a
              href="/dashboard/products"
              className="flex items-center p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <Package className="h-5 w-5 mr-3 text-primary" />
              <div>
                <p className="font-medium">Productos</p>
                <p className="text-xs text-muted-foreground">Gestionar inventario</p>
              </div>
            </a>
            <a
              href="/dashboard/cash"
              className="flex items-center p-3 rounded-lg hover:bg-accent transition-colors"
            >
              <DollarSign className="h-5 w-5 mr-3 text-primary" />
              <div>
                <p className="font-medium">Control de Caja</p>
                <p className="text-xs text-muted-foreground">Gestionar caja diaria</p>
              </div>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
