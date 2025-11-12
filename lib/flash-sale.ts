import { useFlags } from "launchdarkly-react-client-sdk"

/**
 * Checks if the Flash Sale variation is currently active
 * Uses the same logic as the Banner component
 */
export function useFlashSale() {
  const flags = useFlags()
  const storePromoBanner = flags.storePromoBanner as string | undefined

  const isFlashSaleActive = (): boolean => {
    if (!storePromoBanner) return false
    const normalized = storePromoBanner.toLowerCase().trim()
    return (
      normalized === "flash sale" ||
      (normalized.includes("flash") && normalized.includes("sale"))
    )
  }

  const flashSaleActive = isFlashSaleActive()
  const discountPercent = 50 // 50% off as mentioned in banner

  /**
   * Calculates the discounted price for a product
   * @param originalPrice - The original product price
   * @returns The discounted price (50% off)
   */
  const getDiscountedPrice = (originalPrice: number): number => {
    if (!flashSaleActive) return originalPrice
    return originalPrice * (1 - discountPercent / 100)
  }

  return {
    isFlashSaleActive: flashSaleActive,
    discountPercent: flashSaleActive ? discountPercent : 0,
    getDiscountedPrice,
  }
}

