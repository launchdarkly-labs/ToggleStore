"use client"

import { useState, useEffect } from "react"
import { Product } from "@/types/product"
import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"
import Image from "next/image"
import { useFlags } from "launchdarkly-react-client-sdk"
import { motion } from "framer-motion"
import { logger } from "@/lib/logger"
import { recordErrorToLD } from "@/lib/launchdarkly/observability"
import { useFlashSale } from "@/lib/flash-sale"

interface ProductCardProps {
  product: Product
  onAddToCart?: (product: Product, quantity?: number, selectedSize?: string) => void
  onViewDetails?: (product: Product) => void
  featured?: boolean
}

export function ProductCard({
  product,
  onAddToCart,
  onViewDetails,
  featured = false,
}: ProductCardProps) {
  const flags = useFlags()
  // Check the apiRelease feature flag
  const apiReleaseEnabled = flags["apiRelease"] === true
  const { isFlashSaleActive, getDiscountedPrice: getFlashSalePrice } = useFlashSale()
  const [isHovered, setIsHovered] = useState(false)
  
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
  const isApparel = product.category === "Apparel"
  
  // Calculate final price: flash sale takes precedence, then 20% off promo for Apparel
  const getFinalPrice = (): number => {
    if (isFlashSaleActive) {
      return getFlashSalePrice(product.price)
    }
    if (promo20OffActive && isApparel) {
      return product.price * 0.8 // 20% off
    }
    return product.price
  }
  
  const displayPrice = getFinalPrice()
  const originalPrice = product.price
  const showDiscount = (isFlashSaleActive || (promo20OffActive && isApparel)) && !apiReleaseEnabled

  // Throw errors when apiRelease flag is enabled to simulate broken API
  useEffect(() => {
    if (apiReleaseEnabled) {
      const error = new Error(
        `Product API error: Failed to load product data for ${product.id}. Invalid response format from product service.`
      )
      ;(error as Error & { code?: string; productId?: string }).code = "PRODUCT_LOAD_ERROR"
      ;(error as Error & { code?: string; productId?: string }).productId = product.id

      // Log error for structured logging
      logger.error(
        `Product card error: Failed to load product ${product.name}`,
        error,
        {
          component: "ProductCard",
          productId: product.id,
          productName: product.name,
          featured,
          flagEnabled: true,
        }
      )

      // Record error to LaunchDarkly observability
      recordErrorToLD(
        error,
        `Product card error: Failed to load product ${product.name}`,
        {
          component: "ProductCard",
          productId: product.id,
          productName: product.name,
          featured,
          flagEnabled: true,
        }
      )

      // Throw error asynchronously for LaunchDarkly observability to track
      setTimeout(() => {
        throw error
      }, 0)
    }
  }, [apiReleaseEnabled, product.id, product.name, featured])

  if (featured) {
    return (
      <div
        className="relative w-[280px] sm:w-[340px] md:w-[380px] lg:w-[404px] h-[480px] sm:h-[540px] md:h-[570px] lg:h-[595px] rounded-[20px] md:rounded-[25px] lg:rounded-[30px] border border-[#58595b] cursor-pointer hover:border-[#7084FF] transition-colors shrink-0 overflow-hidden group"
        style={{
          backgroundImage:
            "linear-gradient(179.99999981826284deg, rgba(0, 0, 0, 0) 23.03%, rgba(0, 0, 0, 1) 129.6%), linear-gradient(90deg, rgba(25, 25, 25, 1) 0%, rgba(25, 25, 25, 1) 100%)",
        }}
        onClick={() => onViewDetails?.(product)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Product Image */}
        <motion.div 
          className="absolute left-1/2 top-[24px] sm:top-[32px] md:top-[38px] lg:top-[42px] -translate-x-1/2 w-[240px] sm:w-[280px] md:w-[320px] lg:w-[340px] h-[280px] sm:h-[320px] md:h-[360px] lg:h-[380px] pointer-events-none flex items-center justify-center"
          animate={{ scale: isHovered ? 1.15 : 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {apiReleaseEnabled ? (
            // Broken image placeholder - shows "?" when API fails
            <div className="w-full h-full border-2 border-[#545050] border-opacity-10 rounded-[10px] flex items-center justify-center">
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
              width={340}
              height={380}
              className="w-full h-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
              priority
            />
          )}
        </motion.div>

        {/* Content */}
        <div className="absolute left-[24px] sm:left-[32px] md:left-[38px] lg:left-[42px] bottom-[24px] sm:bottom-[32px] md:bottom-[38px] lg:bottom-[42px] right-[24px] sm:right-[32px] md:right-[38px] lg:right-[34px] flex flex-col gap-[24px] sm:gap-[30px] md:gap-[34px] lg:gap-[37px]">
          <div className="flex flex-col gap-3 md:gap-4">
            <div
              className={`w-fit text-[10px] sm:text-[11px] md:text-[12px] tracking-[1.5px] sm:tracking-[1.6px] md:tracking-[1.8px] uppercase ${
                apiReleaseEnabled ? "text-[#FF35A2]" : "bg-clip-text"
              }`}
              style={
                apiReleaseEnabled
                  ? {}
                  : { WebkitTextFillColor: "transparent" }
              }
            >
              {apiReleaseEnabled ? "ERROR" : "FEATURED"}
            </div>
            <div className="flex flex-col gap-4 md:gap-5 lg:gap-6">
              <h3
                className="text-[18px] sm:text-[20px] md:text-[22px] lg:text-[24px] font-bold text-white bg-clip-text leading-[1.4]"
                style={{
                  WebkitTextFillColor: "transparent",
                  backgroundImage:
                    "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)",
                }}
              >
                {apiReleaseEnabled ? "$Load.Itemname.{error}" : product.name}
              </h3>
              {apiReleaseEnabled && (
                <p className="text-[#58595b] text-[11px] sm:text-[11.5px] md:text-[12px] leading-normal">
                  25 in stock. Available in 5 sizes. Lorem ipsum description of the item. Lorem ipsum description of the item.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              {showDiscount ? (
                <>
                  <span className="text-[#a7a9ac] text-[18px] sm:text-[20px] md:text-[22px] lg:text-[24px] font-mono tracking-[1px] sm:tracking-[1.1px] md:tracking-[1.2px] line-through opacity-50">
                    ${originalPrice.toFixed(2)}
                  </span>
                  <span className="text-[#EBFF38] text-[18px] sm:text-[20px] md:text-[22px] lg:text-[24px] font-mono tracking-[1px] sm:tracking-[1.1px] md:tracking-[1.2px]">
                    ${displayPrice.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-[#a7a9ac] text-[18px] sm:text-[20px] md:text-[22px] lg:text-[24px] font-mono tracking-[1px] sm:tracking-[1.1px] md:tracking-[1.2px]">
                  {apiReleaseEnabled ? ".$Price)" : `$${product.price.toFixed(2)}`}
                </span>
              )}
            </div>
            {apiReleaseEnabled ? (
              <button
                disabled
                className="border border-[#FF35A2] rounded-[60px] px-4 sm:px-5 md:px-6 py-[15px] text-[#FF35A2] text-[13px] sm:text-[14px] md:text-[15px] lg:text-[16px] cursor-not-allowed opacity-100"
              >
                Unavailable
              </button>
            ) : (
              <Button
                variant="outline"
                className="rounded-[60px] border-[#7084ff] text-[#7084ff] hover:bg-[#7084ff]/10 text-[13px] sm:text-[14px] md:text-[15px] lg:text-[16px] px-4 sm:px-5 md:px-6"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddToCart?.(product)
                }}
                data-dev-highlight="add-button"
              >
                Add
                <ShoppingCart size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative w-full max-w-[364px] rounded-[20px] sm:rounded-[25px] md:rounded-[30px] border border-[#58595b] cursor-pointer hover:border-[#7084FF] transition-colors"
      style={{
        backgroundImage:
          "linear-gradient(179.99999985167307deg, rgba(0, 0, 0, 0) 23.03%, rgba(0, 0, 0, 1) 129.6%), linear-gradient(90deg, rgba(25, 25, 25, 1) 0%, rgba(25, 25, 25, 1) 100%)",
      }}
      onClick={() => onViewDetails?.(product)}
    >
      <div className="p-5 sm:p-6 md:p-7 lg:p-8 flex flex-col gap-[20px] sm:gap-[24px] md:gap-[28px]">
        <div className="flex flex-col gap-4 sm:gap-5 flex-1">
          <div
            className={`w-fit text-[10px] sm:text-[11px] md:text-[12px] tracking-[1.5px] sm:tracking-[1.6px] md:tracking-[1.8px] uppercase ${
              apiReleaseEnabled ? "text-[#FF35A2]" : "bg-clip-text"
            }`}
            style={
              apiReleaseEnabled
                ? {}
                : { WebkitTextFillColor: "transparent" }
            }
          >
            {apiReleaseEnabled ? "ERROR" : product.category.toUpperCase()}
          </div>

          {/* Product Image */}
          <div className="flex-1 rounded flex items-center justify-center min-h-[140px] sm:min-h-[150px] md:min-h-[160px]">
            {apiReleaseEnabled ? (
              // Broken image placeholder - shows "?" when API fails
              <div className="w-full h-full border-2 border-[#545050] border-opacity-10 rounded-[10px] flex items-center justify-center">
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
                width={240}
                height={160}
                className="max-w-full max-h-full w-auto h-auto object-contain"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5 sm:gap-6 md:gap-7 lg:gap-8">
          <h3
            className="text-[18px] sm:text-[20px] md:text-[22px] lg:text-[24px] font-bold text-white bg-clip-text leading-[1.4]"
            style={{
              WebkitTextFillColor: "transparent",
              backgroundImage:
                "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)",
            }}
          >
            {apiReleaseEnabled ? "$Load.Itemname.{error}" : product.name}
          </h3>

          {apiReleaseEnabled && (
            <p className="text-[#58595b] text-[11px] sm:text-[11.5px] md:text-[12px] leading-normal">
              25 in stock. Available in 5 sizes. Lorem ipsum description of the item. Lorem ipsum description of the item.
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              {showDiscount ? (
                <>
                  <span className="text-[#a7a9ac] text-[18px] sm:text-[20px] md:text-[22px] lg:text-[24px] font-mono tracking-[1px] sm:tracking-[1.1px] md:tracking-[1.2px] line-through opacity-50">
                    ${originalPrice.toFixed(2)}
                  </span>
                  <span className="text-[#EBFF38] text-[18px] sm:text-[20px] md:text-[22px] lg:text-[24px] font-mono tracking-[1px] sm:tracking-[1.1px] md:tracking-[1.2px]">
                    ${displayPrice.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-[#a7a9ac] text-[18px] sm:text-[20px] md:text-[22px] lg:text-[24px] font-mono tracking-[1px] sm:tracking-[1.1px] md:tracking-[1.2px]">
                  {apiReleaseEnabled ? ".$Price)" : `$${product.price.toFixed(2)}`}
                </span>
              )}
            </div>
            {apiReleaseEnabled ? (
              <button
                disabled
                className="border border-[#FF35A2] rounded-[60px] px-4 sm:px-5 md:px-6 py-[15px] text-[#FF35A2] text-[13px] sm:text-[14px] md:text-[15px] lg:text-[16px] cursor-not-allowed opacity-100"
              >
                Unavailable
              </button>
            ) : (
              <Button
                variant="outline"
                className="rounded-[60px] border-[#405bff] text-[#7084ff] hover:bg-[#7084ff]/10 gap-2 sm:gap-2.5 text-[13px] sm:text-[14px] md:text-[15px] lg:text-[16px] px-4 sm:px-5 md:px-6"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddToCart?.(product)
                }}
                data-dev-highlight="add-button"
              >
                Add
                <ShoppingCart size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

