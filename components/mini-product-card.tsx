"use client"

import { useState } from "react"
import { Product } from "@/types/product"
import { Button } from "@/components/ui/button"
import { ShoppingCart } from "lucide-react"
import Image from "next/image"
import { useFlags } from "launchdarkly-react-client-sdk"
import { useFlashSale } from "@/lib/flash-sale"

interface MiniProductCardProps {
  product: Product
  selectedSize?: string
  onAddToCart: (product: Product, quantity?: number, selectedSize?: string) => void
}

export function MiniProductCard({ product, selectedSize: initialSelectedSize, onAddToCart }: MiniProductCardProps) {
  const [selectedSize, setSelectedSize] = useState<string>(initialSelectedSize || (product.sizes && product.sizes.length > 0 ? product.sizes[0] : ""))
  const [quantity, setQuantity] = useState<number>(1)
  const flags = useFlags()
  const { isFlashSaleActive, getDiscountedPrice: getFlashSalePrice } = useFlashSale()
  
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
  const showDiscount = isFlashSaleActive || (promo20OffActive && isApparel)

  return (
    <div
      className="relative w-full rounded-[15px] border border-[#58595b] overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(179.99999981826284deg, rgba(0, 0, 0, 0) 23.03%, rgba(0, 0, 0, 1) 129.6%), linear-gradient(90deg, rgba(25, 25, 25, 1) 0%, rgba(25, 25, 25, 1) 100%)",
      }}
    >
      <div className="p-3 sm:p-4 flex flex-col gap-3">
        {/* Product Image and Info Row */}
        <div className="flex gap-3 items-start">
          {/* Product Image */}
          <div className="shrink-0 w-[60px] h-[60px] sm:w-[70px] sm:h-[70px] rounded-lg overflow-hidden bg-[#2a2a2a] flex items-center justify-center">
            <Image
              src={product.images.main}
              alt={product.name}
              width={70}
              height={70}
              className="w-full h-full object-contain"
            />
          </div>
          
          {/* Product Details */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <h3
              className="text-[14px] sm:text-[16px] font-bold text-white bg-clip-text leading-tight line-clamp-2"
              style={{
                WebkitTextFillColor: "transparent",
                backgroundImage:
                  "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)",
              }}
            >
              {product.name}
            </h3>
            <div className="flex items-center gap-2">
              {showDiscount ? (
                <>
                  <span className="text-[#a7a9ac] text-[13px] sm:text-[14px] font-mono tracking-[1px] line-through opacity-50">
                    ${originalPrice.toFixed(2)}
                  </span>
                  <span className="text-[#EBFF38] text-[13px] sm:text-[14px] font-mono tracking-[1px]">
                    ${displayPrice.toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-[#a7a9ac] text-[13px] sm:text-[14px] font-mono tracking-[1px]">
                  ${product.price.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Size Selector */}
        {product.sizes && product.sizes.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-[#A7A9AC] text-[12px] sm:text-[13px]">Size:</label>
            <div className="flex gap-2 flex-wrap">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-3 py-1.5 rounded-[5px] text-[12px] sm:text-[13px] border transition-colors ${
                    selectedSize === size
                      ? "border-[#7084FF] bg-[#7084FF]/10 text-[#7084FF]"
                      : "border-[#58595B] text-[#A7A9AC] hover:border-[#7084FF]/50"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-[#A7A9AC] text-[12px] sm:text-[13px]">Quantity:</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-[5px] border border-[#58595B] text-[#A7A9AC] hover:border-[#7084FF] hover:text-[#7084FF] flex items-center justify-center text-[16px] font-bold"
            >
              −
            </button>
            <span className="text-white text-[14px] sm:text-[16px] font-mono min-w-[30px] text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-[5px] border border-[#58595B] text-[#A7A9AC] hover:border-[#7084FF] hover:text-[#7084FF] flex items-center justify-center text-[16px] font-bold"
            >
              +
            </button>
          </div>
        </div>

        {/* Add to Cart Button */}
        <Button
          variant="outline"
          className="w-full rounded-[60px] border-[#405bff] text-[#7084ff] hover:bg-[#7084ff]/10 text-[12px] sm:text-[13px] px-3 py-2 h-auto"
          onClick={() => onAddToCart(product, quantity, selectedSize)}
        >
          Add to Cart
          <ShoppingCart size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  )
}

