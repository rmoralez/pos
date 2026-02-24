import { ProductForm } from "@/components/products/product-form"
import { ProductVariantsManager } from "@/components/products/product-variants-manager"
import { PriceHistoryTable } from "@/components/products/price-history-table"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  const product = await prisma.product.findFirst({
    where: {
      id: params.id,
      tenantId: user.tenantId,
    },
    include: {
      category: true,
      supplier: true,
    },
  })

  if (!product) {
    redirect("/dashboard/products")
  }

  // Convert Decimal to number for form
  const productData = {
    ...product,
    costPrice: Number(product.costPrice),
    salePrice: Number(product.salePrice),
    taxRate: Number(product.taxRate),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/products">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Producto</h1>
          <p className="text-muted-foreground">
            Modifica los datos del producto
          </p>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="variants">Variantes</TabsTrigger>
          <TabsTrigger value="price-history">Historial de Precios</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <ProductForm productId={params.id} initialData={productData} />
        </TabsContent>

        <TabsContent value="variants" className="space-y-6">
          <ProductVariantsManager productId={params.id} productSku={product.sku || undefined} />
        </TabsContent>

        <TabsContent value="price-history" className="space-y-6">
          <PriceHistoryTable productId={params.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
