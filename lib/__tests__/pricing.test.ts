import {
  calculateMargin,
  calculateSalePrice,
  calculateCostPrice,
  roundPrice,
  roundSalePriceAndRecalculateMargin,
  validatePrices,
  formatPercentage,
  formatPrice,
  calculateDiscountAmount,
  applyDiscount,
  calculateDiscountPercentage,
} from '../pricing'

describe('pricing utilities', () => {
  describe('calculateMargin', () => {
    it('should calculate margin correctly for standard prices', () => {
      expect(calculateMargin(100, 150)).toBe(50)
      expect(calculateMargin(80, 120)).toBe(50)
      expect(calculateMargin(50, 100)).toBe(100)
    })

    it('should return 0 for zero or negative cost price', () => {
      expect(calculateMargin(0, 100)).toBe(0)
      expect(calculateMargin(-10, 100)).toBe(0)
    })

    it('should handle negative margins', () => {
      expect(calculateMargin(100, 80)).toBe(-20)
      expect(calculateMargin(200, 150)).toBe(-25)
    })

    it('should round to 2 decimal places', () => {
      expect(calculateMargin(100, 133.33)).toBe(33.33)
      expect(calculateMargin(77, 99.99)).toBe(29.86)
    })

    it('should handle very small margins', () => {
      expect(calculateMargin(100, 100.01)).toBe(0.01)
    })

    it('should handle very large margins', () => {
      expect(calculateMargin(10, 1000)).toBe(9900)
    })
  })

  describe('calculateSalePrice', () => {
    it('should calculate sale price correctly from cost and margin', () => {
      expect(calculateSalePrice(100, 50)).toBe(150)
      expect(calculateSalePrice(80, 25)).toBe(100)
      expect(calculateSalePrice(50, 100)).toBe(100)
    })

    it('should return 0 for zero or negative cost price', () => {
      expect(calculateSalePrice(0, 50)).toBe(0)
      expect(calculateSalePrice(-10, 50)).toBe(0)
    })

    it('should handle negative margins', () => {
      expect(calculateSalePrice(100, -20)).toBe(80)
      expect(calculateSalePrice(200, -50)).toBe(100)
    })

    it('should round to 2 decimal places', () => {
      expect(calculateSalePrice(77.77, 33.33)).toBe(103.69)
    })

    it('should handle zero margin', () => {
      expect(calculateSalePrice(100, 0)).toBe(100)
    })

    it('should handle very large margins', () => {
      expect(calculateSalePrice(10, 1000)).toBe(110)
    })
  })

  describe('calculateCostPrice', () => {
    it('should calculate cost price correctly from sale price and margin', () => {
      expect(calculateCostPrice(150, 50)).toBe(100)
      expect(calculateCostPrice(100, 25)).toBe(80)
      expect(calculateCostPrice(100, 100)).toBe(50)
    })

    it('should return 0 for zero or negative sale price', () => {
      expect(calculateCostPrice(0, 50)).toBe(0)
      expect(calculateCostPrice(-10, 50)).toBe(0)
    })

    it('should return 0 for margin <= -100', () => {
      expect(calculateCostPrice(100, -100)).toBe(0)
      expect(calculateCostPrice(100, -150)).toBe(0)
    })

    it('should handle negative margins (less than -100)', () => {
      expect(calculateCostPrice(80, -20)).toBe(100)
    })

    it('should round to 2 decimal places', () => {
      expect(calculateCostPrice(133.33, 33.33)).toBe(100)
    })

    it('should handle very small margins', () => {
      expect(calculateCostPrice(100.01, 0.01)).toBe(100)
    })
  })

  describe('roundPrice', () => {
    describe('none strategy', () => {
      it('should not modify price', () => {
        expect(roundPrice(123.45, 'none')).toBe(123.45)
        expect(roundPrice(99.99, 'none')).toBe(99.99)
      })
    })

    describe('nearestFive strategy', () => {
      it('should round up to nearest 5', () => {
        expect(roundPrice(123, 'nearestFive')).toBe(125)
        expect(roundPrice(121, 'nearestFive')).toBe(125)
        expect(roundPrice(125, 'nearestFive')).toBe(125)
        expect(roundPrice(126, 'nearestFive')).toBe(130)
      })

      it('should handle decimals', () => {
        expect(roundPrice(123.01, 'nearestFive')).toBe(125)
        expect(roundPrice(124.99, 'nearestFive')).toBe(125)
      })
    })

    describe('nearestTen strategy', () => {
      it('should round up to nearest 10', () => {
        expect(roundPrice(123, 'nearestTen')).toBe(130)
        expect(roundPrice(125, 'nearestTen')).toBe(130)
        expect(roundPrice(130, 'nearestTen')).toBe(130)
        expect(roundPrice(131, 'nearestTen')).toBe(140)
      })

      it('should handle decimals', () => {
        expect(roundPrice(125.01, 'nearestTen')).toBe(130)
        expect(roundPrice(129.99, 'nearestTen')).toBe(130)
      })
    })

    describe('nearestFifty strategy', () => {
      it('should round up to nearest 50', () => {
        expect(roundPrice(123, 'nearestFifty')).toBe(150)
        expect(roundPrice(150, 'nearestFifty')).toBe(150)
        expect(roundPrice(151, 'nearestFifty')).toBe(200)
        expect(roundPrice(199, 'nearestFifty')).toBe(200)
      })

      it('should handle decimals', () => {
        expect(roundPrice(125.50, 'nearestFifty')).toBe(150)
      })
    })

    describe('nearestHundred strategy', () => {
      it('should round up to nearest 100', () => {
        expect(roundPrice(123, 'nearestHundred')).toBe(200)
        expect(roundPrice(199, 'nearestHundred')).toBe(200)
        expect(roundPrice(200, 'nearestHundred')).toBe(200)
        expect(roundPrice(201, 'nearestHundred')).toBe(300)
      })

      it('should handle decimals', () => {
        expect(roundPrice(150.50, 'nearestHundred')).toBe(200)
      })
    })
  })

  describe('roundSalePriceAndRecalculateMargin', () => {
    it('should round sale price and recalculate margin', () => {
      const result = roundSalePriceAndRecalculateMargin(100, 123, 'nearestTen')
      expect(result.costPrice).toBe(100)
      expect(result.salePrice).toBe(130)
      expect(result.margin).toBe(30)
    })

    it('should handle different rounding strategies', () => {
      const result1 = roundSalePriceAndRecalculateMargin(100, 123, 'nearestFive')
      expect(result1.salePrice).toBe(125)
      expect(result1.margin).toBe(25)

      const result2 = roundSalePriceAndRecalculateMargin(100, 123, 'nearestFifty')
      expect(result2.salePrice).toBe(150)
      expect(result2.margin).toBe(50)

      const result3 = roundSalePriceAndRecalculateMargin(100, 123, 'nearestHundred')
      expect(result3.salePrice).toBe(200)
      expect(result3.margin).toBe(100)
    })

    it('should handle none strategy', () => {
      const result = roundSalePriceAndRecalculateMargin(100, 123.45, 'none')
      expect(result.salePrice).toBe(123.45)
      expect(result.margin).toBe(23.45)
    })

    it('should maintain cost price', () => {
      const result = roundSalePriceAndRecalculateMargin(87.50, 123, 'nearestTen')
      expect(result.costPrice).toBe(87.50)
      expect(result.salePrice).toBe(130)
    })
  })

  describe('validatePrices', () => {
    it('should validate correct prices', () => {
      const result = validatePrices(100, 150, 50)
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should reject negative cost price', () => {
      const result = validatePrices(-10, 150, 50)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('El precio de costo no puede ser negativo')
    })

    it('should reject negative sale price', () => {
      const result = validatePrices(100, -150, 50)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('El precio de venta no puede ser negativo')
    })

    it('should reject margin less than -100', () => {
      const result = validatePrices(100, 150, -101)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('El margen no puede ser menor a -100%')
    })

    it('should allow margin of exactly -100', () => {
      const result = validatePrices(100, 0, -100)
      expect(result.isValid).toBe(true)
    })

    it('should allow zero values', () => {
      const result = validatePrices(0, 0, 0)
      expect(result.isValid).toBe(true)
    })

    it('should accumulate multiple errors', () => {
      const result = validatePrices(-10, -20, -150)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(3)
    })
  })

  describe('formatPercentage', () => {
    it('should format percentage with default decimals', () => {
      expect(formatPercentage(50)).toBe('50.00%')
      expect(formatPercentage(33.33)).toBe('33.33%')
    })

    it('should format percentage with custom decimals', () => {
      expect(formatPercentage(50, 0)).toBe('50%')
      expect(formatPercentage(33.333, 1)).toBe('33.3%')
      expect(formatPercentage(33.333, 3)).toBe('33.333%')
    })

    it('should handle negative percentages', () => {
      expect(formatPercentage(-20)).toBe('-20.00%')
    })

    it('should handle zero', () => {
      expect(formatPercentage(0)).toBe('0.00%')
    })
  })

  describe('formatPrice', () => {
    it('should format price with default decimals', () => {
      expect(formatPrice(100)).toBe('$100.00')
      expect(formatPrice(150.50)).toBe('$150.50')
    })

    it('should format price with custom decimals', () => {
      expect(formatPrice(100, 0)).toBe('$100')
      expect(formatPrice(150.567, 1)).toBe('$150.6')
      expect(formatPrice(150.567, 3)).toBe('$150.567')
    })

    it('should handle negative prices', () => {
      expect(formatPrice(-50)).toBe('$-50.00')
    })

    it('should handle zero', () => {
      expect(formatPrice(0)).toBe('$0.00')
    })
  })

  describe('calculateDiscountAmount', () => {
    describe('PERCENTAGE discount type', () => {
      it('should calculate percentage discount correctly', () => {
        expect(calculateDiscountAmount(1000, 'PERCENTAGE', 10)).toBe(100)
        expect(calculateDiscountAmount(500, 'PERCENTAGE', 20)).toBe(100)
        expect(calculateDiscountAmount(1234.56, 'PERCENTAGE', 15)).toBe(185.18)
      })

      it('should handle 0% discount', () => {
        expect(calculateDiscountAmount(1000, 'PERCENTAGE', 0)).toBe(0)
      })

      it('should handle 100% discount', () => {
        expect(calculateDiscountAmount(1000, 'PERCENTAGE', 100)).toBe(1000)
      })

      it('should return 0 for negative discount value', () => {
        expect(calculateDiscountAmount(1000, 'PERCENTAGE', -10)).toBe(0)
      })

      it('should return 0 for zero base amount', () => {
        expect(calculateDiscountAmount(0, 'PERCENTAGE', 10)).toBe(0)
      })

      it('should return 0 for negative base amount', () => {
        expect(calculateDiscountAmount(-100, 'PERCENTAGE', 10)).toBe(0)
      })
    })

    describe('FIXED discount type', () => {
      it('should calculate fixed discount correctly', () => {
        expect(calculateDiscountAmount(1000, 'FIXED', 150)).toBe(150)
        expect(calculateDiscountAmount(500, 'FIXED', 50)).toBe(50)
        expect(calculateDiscountAmount(1234.56, 'FIXED', 100.50)).toBe(100.5)
      })

      it('should not allow fixed discount greater than base amount', () => {
        expect(calculateDiscountAmount(100, 'FIXED', 200)).toBe(100)
        expect(calculateDiscountAmount(50, 'FIXED', 75)).toBe(50)
      })

      it('should handle zero discount', () => {
        expect(calculateDiscountAmount(1000, 'FIXED', 0)).toBe(0)
      })

      it('should return 0 for negative discount value', () => {
        expect(calculateDiscountAmount(1000, 'FIXED', -50)).toBe(0)
      })

      it('should return 0 for zero base amount', () => {
        expect(calculateDiscountAmount(0, 'FIXED', 50)).toBe(0)
      })

      it('should return 0 for negative base amount', () => {
        expect(calculateDiscountAmount(-100, 'FIXED', 50)).toBe(0)
      })
    })
  })

  describe('applyDiscount', () => {
    describe('PERCENTAGE discount type', () => {
      it('should apply percentage discount correctly', () => {
        expect(applyDiscount(1000, 'PERCENTAGE', 10)).toBe(900)
        expect(applyDiscount(500, 'PERCENTAGE', 20)).toBe(400)
        expect(applyDiscount(1000, 'PERCENTAGE', 100)).toBe(0)
      })

      it('should round to 2 decimal places', () => {
        expect(applyDiscount(1234.56, 'PERCENTAGE', 15)).toBe(1049.38)
      })

      it('should return original price for 0% discount', () => {
        expect(applyDiscount(1000, 'PERCENTAGE', 0)).toBe(1000)
      })

      it('should not return negative values', () => {
        expect(applyDiscount(100, 'PERCENTAGE', 150)).toBe(0)
      })
    })

    describe('FIXED discount type', () => {
      it('should apply fixed discount correctly', () => {
        expect(applyDiscount(1000, 'FIXED', 250)).toBe(750)
        expect(applyDiscount(500, 'FIXED', 100)).toBe(400)
      })

      it('should not allow discount greater than price', () => {
        expect(applyDiscount(100, 'FIXED', 150)).toBe(0)
        expect(applyDiscount(50, 'FIXED', 75)).toBe(0)
      })

      it('should return original price for zero discount', () => {
        expect(applyDiscount(1000, 'FIXED', 0)).toBe(1000)
      })

      it('should round to 2 decimal places', () => {
        expect(applyDiscount(1234.567, 'FIXED', 100.123)).toBe(1134.44)
      })

      it('should not return negative values', () => {
        expect(applyDiscount(100, 'FIXED', 200)).toBe(0)
      })
    })
  })

  describe('calculateDiscountPercentage', () => {
    it('should calculate discount percentage correctly', () => {
      expect(calculateDiscountPercentage(1000, 100)).toBe(10)
      expect(calculateDiscountPercentage(500, 100)).toBe(20)
      expect(calculateDiscountPercentage(1000, 250)).toBe(25)
    })

    it('should handle 100% discount', () => {
      expect(calculateDiscountPercentage(1000, 1000)).toBe(100)
    })

    it('should return 0 for zero discount amount', () => {
      expect(calculateDiscountPercentage(1000, 0)).toBe(0)
    })

    it('should return 0 for zero original price', () => {
      expect(calculateDiscountPercentage(0, 100)).toBe(0)
    })

    it('should return 0 for negative original price', () => {
      expect(calculateDiscountPercentage(-100, 50)).toBe(0)
    })

    it('should round to 2 decimal places', () => {
      expect(calculateDiscountPercentage(1234.56, 185.18)).toBe(15)
      expect(calculateDiscountPercentage(777, 100)).toBe(12.87)
    })

    it('should handle discount greater than original price', () => {
      expect(calculateDiscountPercentage(100, 150)).toBe(150)
    })
  })
})
