/**
 * Utilidades para cálculos de precios y márgenes de productos
 */

export interface PriceCalculation {
  costPrice: number
  salePrice: number
  margin: number
}

/**
 * Calcula el margen de ganancia basado en costo y precio de venta
 * Margen = ((Precio Venta - Precio Costo) / Precio Costo) * 100
 */
export function calculateMargin(costPrice: number, salePrice: number): number {
  if (costPrice <= 0) return 0
  const margin = ((salePrice - costPrice) / costPrice) * 100
  return Math.round(margin * 100) / 100 // Redondear a 2 decimales
}

/**
 * Calcula el precio de venta basado en costo y margen deseado
 * Precio Venta = Precio Costo * (1 + Margen/100)
 */
export function calculateSalePrice(costPrice: number, margin: number): number {
  if (costPrice <= 0) return 0
  const salePrice = costPrice * (1 + margin / 100)
  return Math.round(salePrice * 100) / 100 // Redondear a 2 decimales
}

/**
 * Calcula el costo basado en precio de venta y margen
 * Precio Costo = Precio Venta / (1 + Margen/100)
 */
export function calculateCostPrice(salePrice: number, margin: number): number {
  if (salePrice <= 0) return 0
  if (margin <= -100) return 0 // Prevenir división por cero
  const costPrice = salePrice / (1 + margin / 100)
  return Math.round(costPrice * 100) / 100 // Redondear a 2 decimales
}

/**
 * Redondea un precio hacia arriba usando diferentes estrategias
 */
export type RoundingStrategy = 'none' | 'nearestTen' | 'nearestFifty' | 'nearestHundred' | 'nearestFive'

export function roundPrice(price: number, strategy: RoundingStrategy = 'none'): number {
  if (strategy === 'none') return price

  switch (strategy) {
    case 'nearestFive':
      // Redondear al múltiplo de 5 más cercano
      return Math.round(price / 5) * 5

    case 'nearestTen':
      // Redondear al múltiplo de 10 más cercano
      return Math.round(price / 10) * 10

    case 'nearestFifty':
      // Redondear al múltiplo de 50 más cercano
      return Math.round(price / 50) * 50

    case 'nearestHundred':
      // Redondear al múltiplo de 100 más cercano
      return Math.round(price / 100) * 100

    default:
      return price
  }
}

/**
 * Aplica redondeo al precio de venta y recalcula el margen
 */
export function roundSalePriceAndRecalculateMargin(
  costPrice: number,
  salePrice: number,
  strategy: RoundingStrategy
): PriceCalculation {
  const roundedSalePrice = roundPrice(salePrice, strategy)
  const newMargin = calculateMargin(costPrice, roundedSalePrice)

  return {
    costPrice,
    salePrice: roundedSalePrice,
    margin: newMargin,
  }
}

/**
 * Calcula el precio de venta incluyendo IVA y margen
 * Precio Venta = Precio Costo * (1 + IVA/100) * (1 + Margen/100)
 */
export function calculateSalePriceWithTax(
  costPrice: number,
  taxRate: number,
  margin: number
): number {
  if (costPrice <= 0) return 0
  const priceWithTax = costPrice * (1 + taxRate / 100)
  const salePrice = priceWithTax * (1 + margin / 100)
  return Math.round(salePrice * 100) / 100
}

/**
 * Calcula el margen sobre (costo + IVA) dado el precio de venta
 * Margen = (Precio Venta / (Costo * (1 + IVA/100)) - 1) * 100
 */
export function calculateMarginWithTax(
  costPrice: number,
  taxRate: number,
  salePrice: number
): number {
  if (costPrice <= 0) return 0
  const priceWithTax = costPrice * (1 + taxRate / 100)
  if (priceWithTax <= 0) return 0
  const margin = (salePrice / priceWithTax - 1) * 100
  return Math.round(margin * 100) / 100
}

/**
 * Valida que los valores de precio sean válidos
 */
export function validatePrices(costPrice: number, salePrice: number, margin: number): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (costPrice < 0) {
    errors.push('El precio de costo no puede ser negativo')
  }

  if (salePrice < 0) {
    errors.push('El precio de venta no puede ser negativo')
  }

  if (margin < -100) {
    errors.push('El margen no puede ser menor a -100%')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Formatea un número como porcentaje
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Formatea un número como precio (moneda)
 */
export function formatPrice(value: number, decimals: number = 2): string {
  return `$${value.toFixed(decimals)}`
}

/**
 * Tipos de descuento disponibles
 */
export type DiscountType = 'PERCENTAGE' | 'FIXED'

/**
 * Calcula el monto de descuento basado en el tipo y valor
 * - PERCENTAGE: descuentoValue es un porcentaje (ej: 10 = 10%)
 * - FIXED: descuentoValue es un monto fijo en pesos
 */
export function calculateDiscountAmount(
  baseAmount: number,
  discountType: DiscountType,
  discountValue: number
): number {
  if (discountValue <= 0 || baseAmount <= 0) return 0

  if (discountType === 'PERCENTAGE') {
    // Calcular porcentaje del monto base
    const discount = (baseAmount * discountValue) / 100
    return Math.round(discount * 100) / 100
  } else {
    // Descuento fijo - no puede ser mayor que el monto base
    return Math.min(discountValue, baseAmount)
  }
}

/**
 * Aplica un descuento a un precio y devuelve el precio final
 */
export function applyDiscount(
  price: number,
  discountType: DiscountType,
  discountValue: number
): number {
  const discountAmount = calculateDiscountAmount(price, discountType, discountValue)
  const finalPrice = price - discountAmount
  return Math.max(0, Math.round(finalPrice * 100) / 100) // No puede ser negativo
}

/**
 * Calcula el porcentaje de descuento dado un precio original y un monto de descuento
 */
export function calculateDiscountPercentage(originalPrice: number, discountAmount: number): number {
  if (originalPrice <= 0) return 0
  const percentage = (discountAmount / originalPrice) * 100
  return Math.round(percentage * 100) / 100
}
