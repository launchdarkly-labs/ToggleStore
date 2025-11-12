"use client"

import { useState, useEffect, useCallback } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CartItem } from "@/types/product"
import { X, Plus, Minus, ShoppingCart, Check } from "lucide-react"
import { useToast } from "@/lib/toast"
import Image from "next/image"
import { useFlashSale } from "@/lib/flash-sale"
import { useLoginContext } from "@/lib/login-context"
import { useFlags } from "launchdarkly-react-client-sdk"
import { useTrackMetric } from "@/lib/launchdarkly/metrics"

interface CartProps {
  open: boolean
  onClose: () => void
  items: CartItem[]
  onUpdateQuantity?: (productId: string, quantity: number) => void
  onRemoveItem?: (productId: string) => void
  onCheckout?: () => void
  onOpen?: () => void
}

interface CheckoutEventData {
  items: CartItem[]
  subtotal: number
  shipping: number
  total: number
  itemCount: number
}

/**
 * Sends custom checkout event to analytics/tracking services
 * This function can be extended to integrate with LaunchDarkly, analytics platforms, etc.
 * 
 * @param data - Checkout transaction data
 */
function sendCheckoutEvent(data: CheckoutEventData) {
  // TODO: Add custom event tracking logic here
  // Example integrations:
  // - LaunchDarkly track() for custom events
  // - Analytics platforms (Google Analytics, Segment, etc.)
  // - Webhook notifications
  // - Database logging
  
  console.log("Checkout event:", {
    eventType: "checkout_completed",
    ...data,
  })
  
  // Example: LaunchDarkly custom event (uncomment when SDK is available)
  // if (typeof window !== 'undefined' && window.ldClient) {
  //   window.ldClient.track('checkout_completed', {
  //     total: data.total,
  //     itemCount: data.itemCount,
  //     subtotal: data.subtotal,
  //   })
  // }
}

// Shipping cost constant
const SHIPPING_COST = 5.99
const FREE_SHIPPING_THRESHOLD = 50

// Promo code constants
const PROMO_CODE_20_OFF = "DARKLY20"
const PROMO_CODE_FREE_SHIPPING = "FREESHIP"
const PROMO_CODE_FLASH_SALE = "FLASHSALE"
const PROMO_DISCOUNT_PERCENT = 20

export function Cart({ open, onClose, items, onUpdateQuantity, onCheckout, onOpen }: CartProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [promoCode, setPromoCode] = useState("")
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null)
  const { showToast } = useToast()
  const trackMetric = useTrackMetric()
  const { isFlashSaleActive, getDiscountedPrice: getFlashSalePrice } = useFlashSale()
  const { isLoggedIn, userObject } = useLoginContext()
  const flags = useFlags()
  const storePromoBanner = flags.storePromoBanner as string | undefined
  const rewardsProgramEnabled = flags.rewardsProgram as boolean | undefined ?? false
  
  // Check if 20% off promo is active (DARKLY20)
  const is20PercentOffActive = (): boolean => {
    if (!storePromoBanner) return false
    const normalized = storePromoBanner.toLowerCase().trim()
    return (
      normalized === "20 percent off" ||
      normalized.includes("20 percent") ||
      normalized.includes("20%")
    )
  }
  const promo20OffActive = is20PercentOffActive()
  
  // Calculate item price with all discounts applied
  const getItemPrice = (productPrice: number, category: string): number => {
    if (isFlashSaleActive) {
      return getFlashSalePrice(productPrice)
    }
    if (promo20OffActive && category === "Apparel") {
      return productPrice * 0.8 // 20% off
    }
    return productPrice
  }
  
  // Calculate subtotal using original prices (discounts shown separately)
  const subtotal = items.reduce((sum, item) => {
    return sum + item.product.price * item.quantity
  }, 0)
  
  // Determine which promo code to use based on storePromoBanner flag
  const getPromoCodeForBanner = useCallback((): string | null => {
    if (!storePromoBanner) return null
    
    const normalizedBanner = storePromoBanner.toLowerCase().trim()
    
    // Check for "20 Percent Off"
    if (
      normalizedBanner === "20 percent off" ||
      normalizedBanner.includes("20 percent") ||
      normalizedBanner.includes("20%")
    ) {
      return PROMO_CODE_20_OFF
    }
    
    // Check for "Free Shipping"
    if (
      normalizedBanner === "free shipping" ||
      (normalizedBanner.includes("free") && normalizedBanner.includes("shipping"))
    ) {
      return PROMO_CODE_FREE_SHIPPING
    }
    
    // Check for "Flash Sale"
    if (
      normalizedBanner === "flash sale" ||
      (normalizedBanner.includes("flash") && normalizedBanner.includes("sale"))
    ) {
      return PROMO_CODE_FLASH_SALE
    }
    
    return null
  }, [storePromoBanner])
  
  // Check if user qualifies for auto-applied promo code
  const qualifiesForPromoCode = useCallback((code: string): boolean => {
    if (code === PROMO_CODE_20_OFF) {
      // DARKLY20 promo has no minimum order requirement
      return true
    }
    if (code === PROMO_CODE_FREE_SHIPPING) {
      // Free shipping promo qualifies if subtotal >= $50 (for anonymous users)
      // For logged-in users with rewards program enabled, free shipping is based on tier, not promo code
      // If rewards program is disabled, all users are treated as anonymous for shipping
      return !isLoggedIn && subtotal >= FREE_SHIPPING_THRESHOLD
    }
    if (code === PROMO_CODE_FLASH_SALE) {
      // Flash sale qualifies if the flash sale is actually active
      return isFlashSaleActive
    }
    return false
  }, [isLoggedIn, subtotal, isFlashSaleActive])
  
  // Auto-fill and apply promo code based on storePromoBanner flag
  useEffect(() => {
    const bannerPromoCode = getPromoCodeForBanner()
    
    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(() => {
      // If banner has a promo code and no code is currently set/applied
      if (bannerPromoCode && !appliedPromoCode && !promoCode) {
        setPromoCode(bannerPromoCode)
        // Auto-apply if user qualifies
        if (qualifiesForPromoCode(bannerPromoCode)) {
          setAppliedPromoCode(bannerPromoCode)
        }
      }
      // If banner no longer has promo code, clear it
      else if (!bannerPromoCode && appliedPromoCode) {
        setPromoCode("")
        setAppliedPromoCode(null)
      }
      // If banner changed to a different promo code, update it
      else if (bannerPromoCode && bannerPromoCode !== appliedPromoCode && bannerPromoCode !== promoCode) {
        setPromoCode(bannerPromoCode)
        if (qualifiesForPromoCode(bannerPromoCode)) {
          setAppliedPromoCode(bannerPromoCode)
        } else {
          setAppliedPromoCode(null)
        }
      }
      // Re-check qualification if subtotal changes
      else if (bannerPromoCode && promoCode === bannerPromoCode && !appliedPromoCode) {
        if (qualifiesForPromoCode(bannerPromoCode)) {
          setAppliedPromoCode(bannerPromoCode)
        }
      }
    }, 0)
    
    return () => clearTimeout(timeoutId)
  }, [storePromoBanner, subtotal, appliedPromoCode, promoCode, isLoggedIn, isFlashSaleActive, getPromoCodeForBanner, qualifiesForPromoCode])
  
  // Calculate promo code discount (only applies to Apparel products)
  // Note: This discount is only applied when the promo code is manually entered/applied
  // The price display already shows the discounted price, so this calculates the discount amount
  const getPromoDiscount = (): number => {
    if (!appliedPromoCode || appliedPromoCode !== PROMO_CODE_20_OFF) return 0
    // Don't apply promo discount if flash sale is active (flash sale takes precedence)
    if (isFlashSaleActive) return 0
    
    // Calculate discount only for Apparel products based on original prices
    const apparelSubtotal = items.reduce((sum, item) => {
      if (item.product.category === "Apparel") {
        return sum + item.product.price * item.quantity
      }
      return sum
    }, 0)
    
    return apparelSubtotal * (PROMO_DISCOUNT_PERCENT / 100)
  }
  
  // Get promo code display name
  const getPromoCodeDisplayName = (code: string): string => {
    if (code === PROMO_CODE_20_OFF) return "DARKLY20"
    if (code === PROMO_CODE_FREE_SHIPPING) return "Free Shipping over $50"
    if (code === PROMO_CODE_FLASH_SALE) return "Flash Sale"
    return code
  }
  
  const promoDiscount = getPromoDiscount()
  const subtotalAfterDiscount = subtotal - promoDiscount
  
  // Calculate shipping based on user tier and storePromoBanner flag
  const calculateShipping = (): number => {
    // If rewards program is disabled, ignore tier-based benefits
    // Treat all users (including logged-in) as anonymous for shipping purposes
    if (!rewardsProgramEnabled) {
      // Anonymous users: free shipping over $50 only if storePromoBanner is "Free Shipping"
      const normalizedBanner = storePromoBanner?.toLowerCase().trim() || ""
      const hasFreeShippingBanner = normalizedBanner === "free shipping" || 
        (normalizedBanner.includes("free") && normalizedBanner.includes("shipping"))
      
      if (hasFreeShippingBanner && subtotal >= FREE_SHIPPING_THRESHOLD) {
        return 0
      }
      // Users without the banner pay shipping regardless of order total
      return SHIPPING_COST
    }
    
    // Rewards program is enabled - apply tier-based benefits
    // Platinum users always get free shipping
    if (isLoggedIn && userObject.personatier === "Platinum") {
      return 0
    }
    
    // Other reward tiers (Standard, Silver, Gold) get free shipping on orders over $50
    if (isLoggedIn && userObject.personatier !== "Platinum") {
      return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
    }
    
    // Anonymous users: free shipping over $50 only if storePromoBanner is "Free Shipping"
    if (!isLoggedIn) {
      const normalizedBanner = storePromoBanner?.toLowerCase().trim() || ""
      const hasFreeShippingBanner = normalizedBanner === "free shipping" || 
        (normalizedBanner.includes("free") && normalizedBanner.includes("shipping"))
      
      if (hasFreeShippingBanner && subtotal >= FREE_SHIPPING_THRESHOLD) {
        return 0
      }
      // Anonymous users without the banner pay shipping regardless of order total
      return SHIPPING_COST
    }
    
    // Default: charge shipping
    return SHIPPING_COST
  }
  
  const shipping = calculateShipping()
  const total = subtotalAfterDiscount + shipping
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  
  // Track cart metrics when cart opens
  useEffect(() => {
    if (open) {
      // Track cart-accessed (already tracked in parent, but also track here for completeness)
      if (onOpen) {
        onOpen()
      }
      
      // Track cart-total and cart-items as value metrics
      // Round cart-total to 2 decimal places max
      trackMetric("cart-total", Math.round(total * 100) / 100)
      trackMetric("cart-items", totalItems)
    }
  }, [open, total, totalItems, trackMetric, onOpen])
  
  // Handle promo code application
  const handleApplyPromoCode = () => {
    const code = promoCode.trim().toUpperCase()
    
    if (code === PROMO_CODE_20_OFF) {
      // DARKLY20 has no minimum order requirement
      setAppliedPromoCode(code)
      trackMetric("cart-promo")
      showToast("success", "Promo code applied! 20% off Apparel products.")
    } else if (code === PROMO_CODE_FREE_SHIPPING) {
      if (!isLoggedIn && subtotal >= FREE_SHIPPING_THRESHOLD) {
        setAppliedPromoCode(code)
        trackMetric("cart-promo")
        showToast("success", "Promo code applied! Free shipping on your order.")
      } else if (isLoggedIn) {
        showToast("success", "Free shipping is already available based on your account tier.")
      } else {
        showToast("error", `Free shipping requires a minimum order of $${FREE_SHIPPING_THRESHOLD}. Add $${(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2)} more to qualify.`)
      }
    } else if (code === PROMO_CODE_FLASH_SALE) {
      if (isFlashSaleActive) {
        setAppliedPromoCode(code)
        trackMetric("cart-promo")
        showToast("success", "Promo code applied! Flash sale prices active.")
      } else {
        showToast("error", "Flash sale is not currently active.")
      }
    } else if (code) {
      showToast("error", "Invalid promo code. Please try again.")
    }
  }
  
  // Handle promo code removal
  const handleRemovePromoCode = () => {
    setAppliedPromoCode(null)
    setPromoCode("")
    showToast("success", "Promo code removed.")
  }
  
  const handleCheckout = async () => {
    if (items.length === 0 || isProcessing) return
    
    setIsProcessing(true)
    
    try {
      // Send custom checkout event
      sendCheckoutEvent({
        items,
        subtotal,
        shipping,
        total,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      })
      
      // Track checkout-complete metric
      trackMetric("checkout-complete")
      
      // Call parent checkout handler if provided
      if (onCheckout) {
        onCheckout()
      }
      
      // Show success toast
      showToast("success", "Checkout Completed! Thank you for shopping at ToggleStore.")

      // Close cart after successful checkout
      setTimeout(() => {
        onClose()
        setIsProcessing(false)
      }, 500)
    } catch (error) {
      console.error("Checkout error:", error)
      showToast("error", "Could not complete checkout. Please try again.")
      setIsProcessing(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (isOpen && onOpen) {
        onOpen()
      } else if (!isOpen) {
        onClose()
      }
    }}>
      <SheetContent
        side="right"
        hideCloseButton
        className="w-full max-w-full sm:max-w-full md:max-w-[605px] md:w-[605px] bg-linear-to-b from-transparent via-black/80 to-black border-l-0 border-t-0 border-b-0 flex flex-col"
        style={{
          backgroundImage:
            "linear-gradient(179.999999670063deg, rgba(0, 0, 0, 0) 23.03%, rgba(0, 0, 0, 1) 129.6%), linear-gradient(90deg, rgba(25, 25, 25, 1) 0%, rgba(25, 25, 25, 1) 100%)",
        }}
      >
        {/* Header */}
        <SheetHeader className="relative pt-6 sm:pt-12 px-4 sm:px-[33.5px] shrink-0">
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full overflow-clip flex items-center justify-center">
              <ShoppingCart size={32} className="sm:w-12 sm:h-12 text-white" />
            </div>
            <SheetTitle className="text-white text-xl sm:text-2xl md:text-[32px] font-bold">Cart</SheetTitle>
          </div>
          <button
            onClick={onClose}
            className="absolute right-4 sm:right-[39px] top-6 sm:top-[50px] w-10 h-10 sm:w-[54px] sm:h-[54px] rounded-full border-[1.125px] border-[#7084FF] flex items-center justify-center hover:bg-[#7084FF]/10 transition-colors"
          >
            <X size={20} className="sm:w-[31.5px] sm:h-[31.5px] text-[#7084FF]" />
          </button>
        </SheetHeader>

        {/* Cart Items - Scrollable */}
        <div className="mt-6 sm:mt-12 px-4 sm:px-[33.5px] flex-1 overflow-y-auto pb-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#A7A9AC] text-base sm:text-lg">Your cart is empty</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:gap-6">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="
                    relative min-h-[200px] sm:min-h-[255px]
                    rounded-[20px] sm:rounded-[30px]
                    border border-[rgba(178,141,255,0.55)]
                    overflow-hidden
                    p-4 sm:p-6
                    grid grid-cols-2 grid-rows-2
                    gap-y-2 gap-x-4
                    sm:gap-y-4 sm:gap-x-6
                    items-stretch
                  "
                  style={{ gridTemplateRows: "1fr auto" }}
                >
                  {/* Top Row: Product Image (25%) and Details (75%) */}
                  <div className="col-span-2 flex w-full gap-4 sm:gap-6 items-start">
                    {/* Product Image - 25% */}
                    <div className="shrink-0 grow-0 basis-1/4 max-w-[25%]">
                      <div className="w-full aspect-square max-w-[90px] sm:max-w-[110px] bg-[#2a2a2a] flex items-center justify-center text-white/40 text-sm sm:text-[23px] rounded-lg overflow-hidden">
                        {item.product.images?.main ? (
                          <Image
                            src={item.product.images.main}
                            alt={item.product.name}
                            width={110}
                            height={110}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>FPO</span>
                        )}
                      </div>
                    </div>
                    {/* Product Details - 75% */}
                    <div className="flex flex-col grow basis-3/4 min-w-0 max-w-full items-start text-left justify-start gap-1 sm:gap-1.5">
                      <h3
                        className="font-bold text-white bg-clip-text leading-tight w-full break-words"
                        style={{
                          fontSize: "clamp(0.875rem, 2.5vw, 2.5rem)",
                          WebkitTextFillColor: "transparent",
                          backgroundImage:
                            "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)",
                        }}
                      >
                        {item.product.name}
                      </h3>
                      {/* <p className="text-[#a7a9ac] text-xs sm:text-[12px] leading-normal line-clamp-2 mt-0">
                        {item.product.description}
                      </p> */}
                    </div>
                  </div>

                  {/* Quantity Counter - Bottom Left */}
                  <div className="flex items-end sm:items-center self-end">
                    <div className="flex items-center gap-2 sm:gap-2.5 border border-[#7084ff] rounded-[60px] px-3 sm:px-[30px] py-2 sm:py-[15px]">
                      <button
                        onClick={() => onUpdateQuantity?.(item.product.id, item.quantity - 1)}
                        className="text-[#7084ff] hover:text-[#B3BDFF] transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={16} className="sm:w-5 sm:h-5" />
                      </button>
                      <span className="text-[#7084ff] text-sm sm:text-base font-sans min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity?.(item.product.id, item.quantity + 1)}
                        className="text-[#7084ff] hover:text-[#B3BDFF] transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus size={16} className="sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Price - Bottom Right */}
                  <div className="flex items-end sm:items-center justify-end self-end">
                    <div className="flex flex-col items-end gap-1">
                      {(isFlashSaleActive || (promo20OffActive && item.product.category === "Apparel")) ? (
                        <>
                          <span className="text-[#a7a9ac] text-base sm:text-lg md:text-[24px] font-mono tracking-[1.2px] line-through opacity-50">
                            ${(item.product.price * item.quantity).toFixed(2)}
                          </span>
                          <span className="text-[#EBFF38] text-base sm:text-lg md:text-[24px] font-mono tracking-[1.2px]">
                            ${(getItemPrice(item.product.price, item.product.category) * item.quantity).toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[#a7a9ac] text-base sm:text-lg md:text-[24px] font-mono tracking-[1.2px]">
                          ${(item.product.price * item.quantity).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary - Fixed at bottom */}
        {items.length > 0 && (
          <div className="mt-auto pt-4 px-4 sm:px-[39px] pb-4 sm:pb-12 space-y-4 sm:space-y-6 shrink-0 border-t border-[#58595b]/30">
            {/* Promo Code Section */}
            <div className="space-y-2">
              {appliedPromoCode ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#7084FF]/10 border border-[#7084FF]/30">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-[#7084FF]" />
                    <span className="text-[#7084FF] text-sm font-medium">{getPromoCodeDisplayName(appliedPromoCode)}</span>
                  </div>
                  <button
                    onClick={handleRemovePromoCode}
                    className="text-[#A7A9AC] hover:text-white text-xs underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleApplyPromoCode()
                      }
                    }}
                    className="flex-1 h-9 text-sm bg-[#2a2a2a] border-[#58595B] text-white placeholder:text-[#58595B] focus-visible:border-[#7084FF]"
                  />
                  <Button
                    onClick={handleApplyPromoCode}
                    disabled={!promoCode.trim()}
                    className="h-9 px-4 text-sm bg-[#7084FF] hover:bg-[#7084FF]/80 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply
                  </Button>
                </div>
              )}
            </div>
            
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between text-[#a7a9ac] text-sm sm:text-base">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {promoDiscount > 0 && (
                <div className="flex items-center justify-between text-[#EBFF38] text-sm sm:text-base">
                  <span>Discount ({appliedPromoCode === PROMO_CODE_20_OFF ? `${PROMO_DISCOUNT_PERCENT}%` : getPromoCodeDisplayName(appliedPromoCode || "")})</span>
                  <span>-${promoDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="h-px bg-[#58595b]" />
              <div className="flex items-center justify-between text-[#a7a9ac] text-sm sm:text-base">
                <span>Shipping</span>
                <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
              </div>
              <div className="h-px bg-[#58595b]" />
              <div className="flex items-center justify-between text-[#7084ff] text-lg sm:text-xl font-bold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <Button 
              onClick={handleCheckout}
              disabled={isProcessing || items.length === 0}
              className="w-full h-12 sm:h-[54px] text-white rounded-[60px] px-6 sm:px-[37.8px] py-[29px] text-base sm:text-xl category-button-selected disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Processing..." : "Checkout"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

