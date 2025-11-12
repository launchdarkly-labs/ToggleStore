"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Product } from "@/types/product"
import { Plus, Minus } from "lucide-react"
import Image from "next/image"
import { useState, useEffect } from "react"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { useFlags } from "launchdarkly-react-client-sdk"
import { useToast } from "@/lib/toast"
import { logger } from "@/lib/logger"
import { recordErrorToLD } from "@/lib/launchdarkly/observability"
import { useFlashSale } from "@/lib/flash-sale"

interface ProductDetailDialogProps {
  product: Product | null
  open: boolean
  onClose: () => void
  onAddToCart: (product: Product, quantity: number, selectedSize?: string) => void
}

export function ProductDetailDialog({ product, open, onClose, onAddToCart }: ProductDetailDialogProps) {
  const [quantity, setQuantity] = useState(1)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const flags = useFlags()
  const { showToast } = useToast()
  const { isFlashSaleActive, getDiscountedPrice: getFlashSalePrice } = useFlashSale()
  
  // Check the apiRelease feature flag
  const apiReleaseEnabled = flags["apiRelease"] === true
  
  // Check if 20% off promo is active (DARKLY20)
  const storePromoBanner = flags.storePromoBanner as string | undefined
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
  const isApparel = product?.category === "Apparel"
  
  // Calculate final price: flash sale takes precedence, then 20% off promo for Apparel
  const getFinalPrice = (): number => {
    if (!product) return 0
    if (isFlashSaleActive) {
      return getFlashSalePrice(product.price)
    }
    if (promo20OffActive && isApparel) {
      return product.price * 0.8 // 20% off
    }
    return product.price
  }
  
  const displayPrice = getFinalPrice()
  const originalPrice = product?.price || 0
  const showDiscount = (isFlashSaleActive || (promo20OffActive && isApparel)) && !apiReleaseEnabled && product

  // Show error toasts and throw errors when flag is enabled and dialog opens
  useEffect(() => {
    if (open && apiReleaseEnabled && product) {
      // Show error toasts to demonstrate the broken v3.0 release
      showToast("error", "API v3.0 release failed: Product data could not be loaded")
      
      // Create and log first error
      const error1 = new Error("API v3.0 release failed: Product data could not be loaded")
      ;(error1 as Error & { code?: string; productId?: string }).code = "PRODUCT_DATA_LOAD_ERROR"
      ;(error1 as Error & { code?: string; productId?: string }).productId = product.id
      logger.error(
        "Product detail dialog error: Product data could not be loaded",
        error1,
        {
          component: "ProductDetailDialog",
          productId: product.id,
          productName: product.name,
          flagEnabled: true,
        }
      )

      // Record error to LaunchDarkly observability
      recordErrorToLD(
        error1,
        "Product detail dialog error: Product data could not be loaded",
        {
          component: "ProductDetailDialog",
          productId: product.id,
          productName: product.name,
          flagEnabled: true,
        }
      )

      setTimeout(() => {
        showToast("error", "Backend error: Invalid response format from product service")
        
        // Create and log second error
        const error2 = new Error("Backend error: Invalid response format from product service")
        ;(error2 as Error & { code?: string; productId?: string }).code = "INVALID_RESPONSE_FORMAT"
        ;(error2 as Error & { code?: string; productId?: string }).productId = product.id
        logger.error(
          "Product detail dialog error: Invalid response format",
          error2,
          {
            component: "ProductDetailDialog",
            productId: product.id,
            productName: product.name,
            flagEnabled: true,
          }
        )
        
        // Record error to LaunchDarkly observability
        recordErrorToLD(
          error2,
          "Product detail dialog error: Invalid response format",
          {
            component: "ProductDetailDialog",
            productId: product.id,
            productName: product.name,
            flagEnabled: true,
          }
        )
        
        // Throw error asynchronously for LaunchDarkly observability
        setTimeout(() => {
          throw error2
        }, 0)
      }, 1000)

      setTimeout(() => {
        showToast("error", "Service unavailable: Product API endpoint returned 500 error")
        
        // Create and log third error
        const error3 = new Error("Service unavailable: Product API endpoint returned 500 error")
        ;(error3 as Error & { code?: string; statusCode?: number; productId?: string }).code = "SERVICE_UNAVAILABLE"
        ;(error3 as Error & { code?: string; statusCode?: number; productId?: string }).statusCode = 500
        ;(error3 as Error & { code?: string; statusCode?: number; productId?: string }).productId = product.id
        logger.error(
          "Product detail dialog error: Service unavailable",
          error3,
          {
            component: "ProductDetailDialog",
            productId: product.id,
            productName: product.name,
            flagEnabled: true,
          }
        )
        
        // Record error to LaunchDarkly observability
        recordErrorToLD(
          error3,
          "Product detail dialog error: Service unavailable",
          {
            component: "ProductDetailDialog",
            productId: product.id,
            productName: product.name,
            flagEnabled: true,
          }
        )
        
        // Throw error asynchronously for LaunchDarkly observability
        setTimeout(() => {
          throw error3
        }, 0)
      }, 2000)

      // Throw first error asynchronously
      setTimeout(() => {
        throw error1
      }, 0)
    }
  }, [open, apiReleaseEnabled, product, showToast])

  if (!product) return null

  const handleAddToCart = () => {
    onAddToCart(product, quantity, selectedSize || undefined)
    setQuantity(1)
    setSelectedSize(null)
    onClose()
  }

  const handleIncrement = () => {
    if (quantity < product.stock) {
      setQuantity(quantity + 1)
    }
  }

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-full sm:max-w-[90vw] lg:max-w-[935px] w-full sm:w-auto h-screen sm:h-auto border-0 sm:border border-[#58595b] rounded-0 sm:rounded-[30px] p-0 bg-[#191919] max-h-screen sm:max-h-[90vh] overflow-y-auto top-0! left-0! translate-x-0! translate-y-0! sm:top-[50%]! sm:left-[50%]! sm:-translate-x-1/2! sm:-translate-y-1/2!"
        style={{
          backgroundImage:
            "linear-gradient(179.99999992093447deg, rgba(0, 0, 0, 0) 23.03%, rgba(0, 0, 0, 1) 129.6%), linear-gradient(90deg, rgba(25, 25, 25, 1) 0%, rgba(25, 25, 25, 1) 100%)",
        }}
        showCloseButton={false}
      >
        {/* Accessible title for screen readers */}
        <VisuallyHidden>
          <DialogTitle>{product.name} - Product Details</DialogTitle>
        </VisuallyHidden>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 sm:right-8 lg:right-[40.5px] top-4 sm:top-8 lg:top-[40.5px] w-[54px] h-[54px] rounded-full border-[1.125px] border-[#7084FF] flex items-center justify-center hover:bg-[#7084FF]/10 transition-colors z-10"
        >
          <Image src="/assets/icons/close.svg" alt="Close" width={31.5} height={31.5} className="w-[31.5px] h-[31.5px]" />
        </button>

        {/* Content */}
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 lg:gap-[82px] items-start lg:items-center px-4 sm:px-6 lg:px-[53px] py-6 sm:py-8 lg:py-[75px] w-full">
          {/* Product Image */}
          <div className="w-full sm:w-[300px] lg:w-[375px] h-[250px] sm:h-[300px] lg:h-[394px] shrink-0 overflow-hidden flex items-center justify-center mx-auto lg:mx-0">
            {apiReleaseEnabled ? (
              // Broken image placeholder - shows "?" when API fails
              <div className="w-full h-full border-2 border-[#58595b] border-opacity-10 rounded-[10px] flex items-center justify-center">
                <div
                  className="text-white text-[59.676px] tracking-[2.9838px] font-mono bg-clip-text"
                  style={{
                    WebkitTextFillColor: "transparent",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)",
                  }}
                >
                  ?
                </div>
              </div>
            ) : (
              <Image
                src={product.images.main}
                alt={product.name}
                width={375}
                height={394}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-col justify-between w-full lg:w-auto lg:flex-1 lg:max-w-[400px] gap-6 lg:gap-8">
            {/* Text Content */}
            <div className="flex flex-col gap-5 sm:gap-6 lg:gap-[35px]">
              <div className="flex flex-col gap-4 sm:gap-5">
                {/* Stock Status */}
                <div
                  className={`text-[12px] tracking-[1.8px] uppercase font-bold ${
                    apiReleaseEnabled ? "text-[#FF35A2]" : "bg-clip-text"
                  }`}
                  style={
                    apiReleaseEnabled
                      ? {}
                      : { WebkitTextFillColor: "transparent" }
                  }
                >
                  {apiReleaseEnabled ? "ERROR" : product.stock > 0 ? "IN STOCK" : "OUT OF STOCK"}
                </div>

                {/* Price */}
                <div className="flex flex-col gap-1">
                  {showDiscount ? (
                    <>
                      <span className="text-[#a7a9ac] text-[20px] sm:text-[24px] tracking-[1.2px] font-mono line-through opacity-50">
                        ${originalPrice.toFixed(2)}
                      </span>
                      <span className="text-[#EBFF38] text-[20px] sm:text-[24px] tracking-[1.2px] font-mono">
                        ${displayPrice.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[#a7a9ac] text-[20px] sm:text-[24px] tracking-[1.2px] font-mono">
                      {apiReleaseEnabled ? "$Price)" : `$${product.price.toFixed(2)}`}
                    </span>
                  )}
                </div>

                {/* Name and Description */}
                <div className="flex flex-col gap-3 sm:gap-4">
                  <h2
                    className="text-[20px] sm:text-[24px] font-bold text-white bg-clip-text leading-tight"
                    style={{
                      WebkitTextFillColor: "transparent",
                      backgroundImage:
                        "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)",
                    }}
                  >
                    {apiReleaseEnabled ? "(Load.Itemname.{error}" : product.name}
                  </h2>

                  <p className="text-[#a7a9ac] text-[12px] leading-normal">
                    {apiReleaseEnabled ? (
                      <>
                        Available in <span className="text-white">0</span> sizes. 
                      </>
                    ) : (
                      <>
                        {product.sizes.length > 0 && (
                          <>
                            Available in <span className="text-white">{product.sizes.length}</span> sizes.{" "}
                          </>
                        )}
                        {product.description}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Size Selector */}
              {product.sizes.length > 0 && (
                <div className="flex gap-2 sm:gap-[12px] items-center flex-wrap">
                  {apiReleaseEnabled ? (
                    // Broken size buttons showing "??" and "???"
                    <>
                      <button className="bg-[#212121] border border-[#414042] rounded-[5px] px-4 sm:px-[24px] py-[8px] text-[14px] sm:text-[16px] text-[#a7a9ac]">
                        ??
                      </button>
                      <button className="bg-[#212121] border border-[#414042] rounded-[5px] px-4 sm:px-[24px] py-[8px] text-[14px] sm:text-[16px] text-[#a7a9ac]">
                        ??
                      </button>
                      <button className="bg-[#212121] border border-[#414042] rounded-[5px] px-4 sm:px-[24px] py-[8px] text-[14px] sm:text-[16px] text-[#a7a9ac]">
                        ??
                      </button>
                      <button className="bg-[#212121] border border-[#414042] rounded-[5px] px-4 sm:px-[24px] py-[8px] text-[14px] sm:text-[16px] text-[#a7a9ac]">
                        ???
                      </button>
                    </>
                  ) : (
                    product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`bg-[#212121] border border-[#414042] rounded-[5px] px-4 sm:px-[24px] py-[8px] text-[14px] sm:text-[16px] transition-colors ${
                          selectedSize === size
                            ? "border-[#7084FF] text-[#7084FF]"
                            : "text-[#a7a9ac] hover:border-[#7084FF]/50"
                        }`}
                      >
                        {size}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Product Features */}
              <div className="flex flex-wrap gap-4 sm:gap-6 lg:gap-[35px] items-center">
                <div className="flex gap-[8px] items-center">
                  <Image
                    src="/assets/icons/shopping-bag-speed.svg"
                    alt=""
                    width={16}
                    height={16}
                    className="w-[16px] h-[16px]"
                  />
                  <span className="text-[#a7a9ac] text-[12px]">Free shipping</span>
                </div>
                <div className="flex gap-[8px] items-center">
                  <Image src="/assets/icons/apparel.svg" alt="" width={16} height={16} className="w-[16px] h-[16px]" />
                  <span className="text-[#a7a9ac] text-[12px]">{apiReleaseEnabled ? "Lorem ipsum" : product.category}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-[20px] items-stretch sm:items-center w-full">
              {apiReleaseEnabled ? (
                // Broken "Unavailable" button in pink
                <button
                  disabled
                  className="border border-[#FF35A2] rounded-[60px] px-[38px] py-[15px] md:py-[28px] text-[#FF35A2] text-[16px] flex-1 sm:flex-initial cursor-not-allowed opacity-100"
                >
                  Unavailable
                </button>
              ) : (
                <>
                  <Button
                    onClick={handleAddToCart}
                    disabled={product.stock === 0 || (product.sizes.length > 0 && !selectedSize)}
                    className="rounded-[60px] px-[38px] py-[15px] md:py-[28px] text-white text-[16px] category-button-selected disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-initial"
                  >
                    Add to cart
                  </Button>

                  {/* Quantity Counter */}
                  <div className="flex items-center justify-center gap-[10px] border border-[#7084ff] rounded-[60px] px-[30px] py-[15px]">
                    <button
                      onClick={handleDecrement}
                      disabled={quantity <= 1}
                      className="text-[#7084ff] hover:text-[#B3BDFF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={20} />
                    </button>
                    <span className="text-[#7084ff] text-[16px] font-sans min-w-[20px] text-center">{quantity}</span>
                    <button
                      onClick={handleIncrement}
                      disabled={quantity >= product.stock}
                      className="text-[#7084ff] hover:text-[#B3BDFF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Increase quantity"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

