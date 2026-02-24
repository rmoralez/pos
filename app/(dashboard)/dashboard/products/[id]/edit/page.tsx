import { ProductForm } from "@/components/products/product-form"
import { ProductVariantsManager } from "@/components/products/product-variants-manager"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/session"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"

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

      <ProductForm productId={params.id} initialData={productData} />

      <ProductVariantsManager productId={params.id} productSku={product.sku || undefined} />
    </div>
  )
}
