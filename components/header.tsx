"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { X, ShoppingCart, QrCode, Sparkles, MoreVertical } from "lucide-react"
import { Product } from "@/types/product"
import productsData from "@/data/products.json"
import { LoginDialog } from "@/components/login-dialog"
import { RewardsDialog } from "@/components/rewards-dialog"
import { useLoginContext } from "@/lib/login-context"
import { useFlags } from "launchdarkly-react-client-sdk"
import { useFlag } from "@/lib/launchdarkly/client"
import { Banner } from "@/components/banner"
import { QRCodeSVG } from "qrcode.react"
import { useFlashSale } from "@/lib/flash-sale"

const products = productsData as Product[]

interface HeaderProps {
  onCartOpen?: () => void
  cartItemCount?: number
  onAddToCart?: (product: Product, quantity?: number, selectedSize?: string, fromSearch?: boolean) => void
  onViewProduct?: (product: Product) => void
  onSidebarOpen?: () => void
}

export function Header({ onCartOpen, cartItemCount = 0, onAddToCart, onViewProduct, onSidebarOpen }: HeaderProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [desktopSearchQuery, setDesktopSearchQuery] = useState("")
  const [mobileSearchQuery, setMobileSearchQuery] = useState("")
  const [desktopSearchFocused, setDesktopSearchFocused] = useState(false)
  const [mobileSearchFocused, setMobileSearchFocused] = useState(false)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [rewardsDialogOpen, setRewardsDialogOpen] = useState(false)
  const { isFlashSaleActive, getDiscountedPrice } = useFlashSale()
  const [showQRCode, setShowQRCode] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [currentUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.location.origin + window.location.pathname
    }
    return ""
  })
  const { isLoggedIn, userObject } = useLoginContext()
  
  // Ref for mobile menu dropdown
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  
  // Get feature flags from LaunchDarkly
  const flags = useFlags()
  const searchAlgorithm = flags.searchAlgorithm as string | undefined
  const rewardsProgramEnabled = useFlag("rewardsProgram", false)

  // Refs for click outside detection
  const desktopSearchRef = useRef<HTMLDivElement>(null)
  const desktopSearchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Handle click outside desktop search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        desktopSearchQuery &&
        desktopSearchRef.current &&
        desktopSearchInputRef.current &&
        !desktopSearchRef.current.contains(event.target as Node) &&
        !desktopSearchInputRef.current.contains(event.target as Node)
      ) {
        setDesktopSearchQuery("")
      }
    }

    if (desktopSearchQuery) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [desktopSearchQuery])

  // Handle click outside mobile menu dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false)
      }
    }

    if (mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [mobileMenuOpen])

  // Prevent body scroll when mobile search is open
  useEffect(() => {
    if (mobileSearchOpen) {
      // Prevent body scroll
      document.body.style.overflow = "hidden"
    } else {
      // Restore body scroll
      document.body.style.overflow = ""
    }

    return () => {
      // Cleanup: restore body scroll when component unmounts
      document.body.style.overflow = ""
    }
  }, [mobileSearchOpen])

  /**
   * Algorithm: Simple Search
   * Returns all products where query appears in the product name only
   */
  const searchProductsSimpleSearch = (query: string): Product[] => {
    if (!query.trim()) return []
    
    const lowercaseQuery = query.toLowerCase().trim()
    return products.filter((product) => {
      return product.name.toLowerCase().includes(lowercaseQuery)
    })
  }

  /**
   * Algorithm: Featured List
   * Searches products based on user query (name, description, category, tags)
   * Returns products grouped into featured and other sections
   * Featured items are shown first, followed by other matching items
   */
  const searchProductsFeaturedList = (query: string): { featured: Product[]; other: Product[] } => {
    if (!query.trim()) return { featured: [], other: [] }
    
    const lowercaseQuery = query.toLowerCase().trim()
    
    // Filter products that match the user's search query
    const allResults = products.filter((product) => {
      const nameMatch = product.name.toLowerCase().includes(lowercaseQuery)
      const descMatch = product.description.toLowerCase().includes(lowercaseQuery)
      const categoryMatch = product.category.toLowerCase().includes(lowercaseQuery)
      const tagMatch = product.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery))
      
      return nameMatch || descMatch || categoryMatch || tagMatch
    })
    
    // Separate into featured items (shown first) and other items (shown after)
    const featured = allResults.filter((product) => product.featured)
    const other = allResults.filter((product) => !product.featured)
    
    // Sort both groups by price (low to high) for consistent ordering
    featured.sort((a, b) => a.price - b.price)
    other.sort((a, b) => a.price - b.price)
    
    // Return featured items first, then other items
    return { featured, other }
  }

  // Select search algorithm based on feature flag
  const searchProducts = useCallback((query: string): Product[] | { featured: Product[]; other: Product[] } => {
    // Default to "simple-search" if flag is not set or invalid
    const algorithmValue = searchAlgorithm?.toLowerCase().trim()
    const algorithm = algorithmValue === "featured-list"
      ? "featured-list"
      : "simple-search"
    
    // Debug logging (remove in production)
    if (query.trim()) {
      console.log(`[Search] Algorithm: ${algorithm}, Flag value: "${searchAlgorithm}"`)
    }
    
    if (algorithm === "featured-list") {
      const results = searchProductsFeaturedList(query)
      if (query.trim()) {
        console.log(`[Search] Featured List found ${results.featured.length} featured, ${results.other.length} other`)
      }
      return results
    } else {
      const results = searchProductsSimpleSearch(query)
      if (query.trim()) {
        console.log(`[Search] Simple Search found ${results.length} results`)
      }
      return results
    }
  }, [searchAlgorithm])

  const desktopSearchResults = useMemo(() => searchProducts(desktopSearchQuery), [desktopSearchQuery, searchProducts])
  const mobileSearchResults = useMemo(() => searchProducts(mobileSearchQuery), [mobileSearchQuery, searchProducts])

  // Get banner flag to determine if banner is visible
  const storePromoBanner = flags.storePromoBanner as string | undefined
  const normalizedBanner = storePromoBanner?.toLowerCase().trim() || ""
  const showBanner = storePromoBanner && (
    normalizedBanner === "flash sale" ||
    (normalizedBanner.includes("flash") && normalizedBanner.includes("sale")) ||
    normalizedBanner === "free shipping" ||
    (normalizedBanner.includes("free") && normalizedBanner.includes("shipping")) ||
    normalizedBanner === "20 percent off" ||
    normalizedBanner.includes("20 percent") ||
    normalizedBanner.includes("20%")
  )

  return (
    <>
      {/* Banner - At the top of the header */}
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-50" data-dev-highlight="banner">
          <Banner 
            onShopNow={() => {
              // Scroll to product grid or handle shop now action
              window.scrollTo({ top: 800, behavior: 'smooth' })
            }}
          />
        </div>
      )}
      
      <header 
        className={`fixed ${showBanner ? 'top-[74px]' : 'top-10'} left-10 right-10 z-50 px-4 md:left-30 transition-all duration-300 rounded-[20px] ${
          isScrolled ? "backdrop-blur-2xl" : ""
        }`}
        style={{
          background: isScrolled 
            ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 100%)" 
            : "transparent"
        }}
      >
      <nav className="flex items-center justify-between">
        {/* Left section: QR Code (md+) + Menu + Logo */}
        <div className="flex items-center gap-4 md:gap-7">
          {/* QR Code Button - Only visible on medium and large screens */}
          {(
            <button 
              onClick={() => setShowQRCode(true)}
              className="hidden md:flex items-center justify-center hover:opacity-80 transition-opacity"
              aria-label="Show QR Code"
            >
                <QrCode size={20} className="w-4 h-4 md:w-6 md:h-6 text-[#7084FF]" />
            </button>
          )}
          <button 
            onClick={onSidebarOpen}
            className="hover:opacity-70 transition-opacity"
          >
            <Image
              src="/storefront/menu.svg"
              alt="Menu"
              width={24}
              height={24}
              className="w-8 h-8"
            />
          </button>
          <Link href="/" className="flex items-center">
            <h1 className="text-white text-[16px] sm:text-[20px] md:text-[25.326px] font-sans tracking-[1.2px] sm:tracking-[1.5196px]">
              <span className="font-normal tracking-[0.25px] sm:tracking-[0.32px]">Toggle</span>
              <span className="font-bold tracking-[0.38px] sm:tracking-[0.48px]">Store</span>
            </h1>
          </Link>
        </div>

        {/* Center: Search bar (desktop only) */}
        <div className="hidden xl:block relative w-[534px] xl:w-[600px]" ref={desktopSearchRef} data-dev-highlight="search">
          {!desktopSearchQuery && !desktopSearchFocused && (
            <div className="absolute left-[26px] top-1/2 -translate-y-1/2 flex items-center gap-5 pointer-events-none z-10 transition-opacity">
              <Image
                src="/storefront/search.svg"
                alt="Search"
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-white/80 text-[16px] font-semibold tracking-[0.8px]">
                Search for a product
              </span>
            </div>
          )}
          <div
            className="h-[60px] rounded-[45px] bg-transparent relative overflow-hidden"
            style={{
              background: "transparent",
              border: "2px solid transparent",
              backgroundImage: "linear-gradient(#191919, #191919), linear-gradient(179deg, #405BFF 1.06%, #7084FF 123.42%)",
              backgroundOrigin: "border-box",
              backgroundClip: "padding-box, border-box",
            }}
          >
            <Input
              ref={desktopSearchInputRef}
              type="search"
              placeholder=""
              value={desktopSearchQuery}
              onChange={(e) => setDesktopSearchQuery(e.target.value)}
              onFocus={() => setDesktopSearchFocused(true)}
              onBlur={() => setDesktopSearchFocused(false)}
              className="h-full rounded-[45px] border-0 bg-transparent text-white text-[16px] pl-[90px] focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          
          {/* Desktop Search Results */}
          {desktopSearchQuery && (Array.isArray(desktopSearchResults) ? desktopSearchResults.length > 0 : desktopSearchResults.featured.length > 0 || desktopSearchResults.other.length > 0) && (
            <div className="absolute top-full mt-2 left-0 right-0 max-h-[600px] overflow-y-auto hide-scrollbar rounded-[20px] border border-[#58595b] bg-[#191919] p-4 space-y-4 z-50 shadow-2xl">
              {/* Check if results are grouped (featured-list algorithm) */}
              {!Array.isArray(desktopSearchResults) ? (
                <>
                  {/* Featured Section */}
                  {desktopSearchResults.featured.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-white text-lg font-bold px-2">Featured</h2>
                      {desktopSearchResults.featured.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => {
                            onViewProduct?.(product)
                            setDesktopSearchQuery("")
                          }}
                          className="flex items-center gap-4 p-4 rounded-[15px] border-2 border-[#7084FF] hover:border-[#B3BDFF] cursor-pointer transition-colors bg-linear-to-b from-[#7084FF]/10 to-transparent"
                        >
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-[#2a2a2a] border border-[#7084FF]">
                            <Image
                              src={product.images.main}
                              alt={product.name}
                              width={80}
                              height={80}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white text-base sm:text-lg font-bold truncate mb-1">{product.name}</h3>
                            <p className="text-[#A7A9AC] text-xs sm:text-sm truncate">{product.description}</p>
                            <div className="flex items-center justify-between mt-2">
                              {isFlashSaleActive ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[#7084FF] text-xs font-mono line-through opacity-50">${product.price.toFixed(2)}</span>
                                  <span className="text-[#EBFF38] text-sm sm:text-base font-mono">${getDiscountedPrice(product.price).toFixed(2)}</span>
                                </div>
                              ) : (
                                <span className="text-[#7084FF] text-sm sm:text-base font-mono">${product.price.toFixed(2)}</span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onAddToCart?.(product, 1, undefined, true)
                                }}
                                className="flex items-center gap-1 text-[#7084FF] hover:text-[#B3BDFF] transition-colors text-xs sm:text-sm"
                              >
                                <ShoppingCart size={14} />
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Other Products Section */}
                  {desktopSearchResults.other.length > 0 && (
                    <div className="space-y-3">
                      {desktopSearchResults.featured.length > 0 && (
                        <h2 className="text-[#A7A9AC] text-lg font-bold px-2 mt-4">Other Results</h2>
                      )}
                      {desktopSearchResults.other.map((product) => (
                        <div
                          key={product.id}
                          onClick={() => {
                            onViewProduct?.(product)
                            setDesktopSearchQuery("")
                          }}
                          className="flex items-center gap-4 p-4 rounded-[15px] border border-[rgba(178,141,255,0.55)] hover:border-[#7084FF] cursor-pointer transition-colors bg-linear-to-b from-transparent to-black/20"
                        >
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-[#2a2a2a]">
                            <Image
                              src={product.images.main}
                              alt={product.name}
                              width={80}
                              height={80}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white text-base sm:text-lg font-bold truncate mb-1">{product.name}</h3>
                            <p className="text-[#A7A9AC] text-xs sm:text-sm truncate">{product.description}</p>
                            <div className="flex items-center justify-between mt-2">
                              {isFlashSaleActive ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[#7084FF] text-xs font-mono line-through opacity-50">${product.price.toFixed(2)}</span>
                                  <span className="text-[#EBFF38] text-sm sm:text-base font-mono">${getDiscountedPrice(product.price).toFixed(2)}</span>
                                </div>
                              ) : (
                                <span className="text-[#7084FF] text-sm sm:text-base font-mono">${product.price.toFixed(2)}</span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onAddToCart?.(product, 1, undefined, true)
                                }}
                                className="flex items-center gap-1 text-[#7084FF] hover:text-[#B3BDFF] transition-colors text-xs sm:text-sm"
                              >
                                <ShoppingCart size={14} />
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Regular list (price-based algorithms) */
                desktopSearchResults.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      onViewProduct?.(product)
                      setDesktopSearchQuery("")
                    }}
                    className="flex items-center gap-4 p-4 rounded-[15px] border border-[rgba(178,141,255,0.55)] hover:border-[#7084FF] cursor-pointer transition-colors bg-linear-to-b from-transparent to-black/20"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-[#2a2a2a]">
                      <Image
                        src={product.images.main}
                        alt={product.name}
                        width={80}
                        height={80}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white text-base sm:text-lg font-bold truncate mb-1">{product.name}</h3>
                      <p className="text-[#A7A9AC] text-xs sm:text-sm truncate">{product.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        {isFlashSaleActive ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[#7084FF] text-xs font-mono line-through opacity-50">${product.price.toFixed(2)}</span>
                            <span className="text-[#EBFF38] text-sm sm:text-base font-mono">${getDiscountedPrice(product.price).toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-[#7084FF] text-sm sm:text-base font-mono">${product.price.toFixed(2)}</span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onAddToCart?.(product, 1, undefined, true)
                          }}
                          className="flex items-center gap-1 text-[#7084FF] hover:text-[#B3BDFF] transition-colors text-xs sm:text-sm"
                        >
                          <ShoppingCart size={14} />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {desktopSearchQuery && (Array.isArray(desktopSearchResults) ? desktopSearchResults.length === 0 : desktopSearchResults.featured.length === 0 && desktopSearchResults.other.length === 0) && (
            <div className="absolute top-full mt-2 left-0 right-0 rounded-[20px] border border-[#58595b] bg-[#191919] p-6 text-center z-50">
              <p className="text-[#A7A9AC] text-sm">No products found</p>
            </div>
          )}
        </div>

        {/* Right section: Rewards + User + Cart */}
        <div className="flex items-center gap-3 md:gap-[34px]">
          {/* Desktop: Rewards, User icons (visible on xl+) */}
          {/* Rewards Icon - Desktop only, only show if feature flag is enabled */}
          {rewardsProgramEnabled && (
            <button
              onClick={() => setRewardsDialogOpen(true)}
              className="hidden xl:flex relative items-center justify-center hover:opacity-80 transition-opacity"
              aria-label="Rewards Program"
            >
              <div className="w-9 h-9 md:w-[54px] md:h-[54px] rounded-full border-[1.125px] border-[#7084FF] flex items-center justify-center bg-[#7084FF]/10">
                <Sparkles size={16} className="w-4 h-4 md:w-6 md:h-6 text-[#7084FF]" />
              </div>
            </button>
          )}

          {/* User/Persona Icon - Desktop only */}
          <button
            onClick={() => setLoginDialogOpen(true)}
            className="hidden xl:flex relative items-center justify-center hover:opacity-80 transition-opacity"
            data-dev-highlight="persona"
          >
            {isLoggedIn && userObject.personaimage ? (
              <div className="w-9 h-9 md:w-[54px] md:h-[54px] rounded-full overflow-hidden border-[1.125px] border-[#7084FF]">
                <Image
                  src={userObject.personaimage}
                  alt={userObject.personaname}
                  width={54}
                  height={54}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <Image
                src="/storefront/Icon-Person.svg"
                alt="User Account"
                width={40}
                height={40}
                className="w-9 h-9 md:w-[54px] md:h-[54px]"
              />
            )}
          </button>

          {/* Cart - Always visible */}
          <button
            onClick={onCartOpen}
            className="relative flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <Image
              src="/storefront/Icon-Cart.svg"
              alt="Shopping Cart"
              width={40}
              height={40}
              className="w-9 h-9 md:w-[54px] md:h-[54px]"
            />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#7084FF] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cartItemCount}
              </span>
            )}
          </button>

          {/* Mobile Menu Button - Only visible on mobile/tablet */}
          <div className="xl:hidden relative" ref={mobileMenuRef}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center justify-center hover:opacity-80 transition-opacity"
              aria-label="Menu"
            >
              <div className="w-9 h-9 md:w-[54px] md:h-[54px] rounded-full border-[1.125px] border-[#7084FF] flex items-center justify-center bg-[#7084FF]/10">
                <MoreVertical size={16} className="w-4 h-4 md:w-6 md:h-6 text-[#7084FF]" />
              </div>
            </button>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 rounded-[15px] border border-[#58595b] bg-[#191919] shadow-2xl z-50 overflow-hidden">
                <div className="py-2">
                  {/* Search Option */}
                  <button
                    onClick={() => {
                      setMobileSearchOpen(true)
                      setMobileMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#7084FF]/10 transition-colors text-left"
                  >
                    <Image
                      src="/storefront/search.svg"
                      alt="Search"
                      width={20}
                      height={20}
                      className="w-5 h-5"
                    />
                    <span className="text-white text-sm font-medium">Search</span>
                  </button>

                  {/* Rewards Option - Only show if feature flag is enabled */}
                  {rewardsProgramEnabled && (
                    <button
                      onClick={() => {
                        setRewardsDialogOpen(true)
                        setMobileMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#7084FF]/10 transition-colors text-left"
                    >
                      <Sparkles size={20} className="w-5 h-5 text-[#7084FF]" />
                      <span className="text-white text-sm font-medium">Rewards</span>
                    </button>
                  )}

                  {/* Persona/User Option */}
                  <button
                    onClick={() => {
                      setLoginDialogOpen(true)
                      setMobileMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#7084FF]/10 transition-colors text-left"
                  >
                    {isLoggedIn && userObject.personaimage ? (
                      <div className="w-5 h-5 rounded-full overflow-hidden border border-[#7084FF]">
                        <Image
                          src={userObject.personaimage}
                          alt={userObject.personaname}
                          width={20}
                          height={20}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <Image
                        src="/storefront/Icon-Person.svg"
                        alt="User Account"
                        width={20}
                        height={20}
                        className="w-5 h-5"
                      />
                    )}
                    <span className="text-white text-sm font-medium">
                      {isLoggedIn ? userObject.personaname || "Account" : "Account"}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile/Tablet Search Overlay */}
      {mobileSearchOpen && (
        <div 
          className="xl:hidden fixed inset-0 bg-black/95 z-100 flex flex-col"
          onClick={(e) => {
            // Close if clicking on the overlay background (not on content)
            if (e.target === e.currentTarget) {
              setMobileSearchOpen(false)
              setMobileSearchQuery("")
              setMobileSearchFocused(false)
            }
          }}
        >
          {/* Close button - top right */}
          <button
            onClick={() => {
              setMobileSearchOpen(false)
              setMobileSearchQuery("")
              setMobileSearchFocused(false)
            }}
            className="absolute top-4 right-4 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-[1.125px] border-[#7084FF] bg-[#7084FF]/10 flex items-center justify-center hover:bg-[#7084FF]/20 transition-colors z-10"
          >
            <X size={20} className="text-[#7084FF]" />
          </button>
          
          <div className="w-full max-w-2xl mx-auto pt-20 px-4 flex-1 flex flex-col min-h-0">
            <div className="relative mb-4 shrink-0">
              {!mobileSearchQuery && !mobileSearchFocused && (
                <div className="absolute left-[26px] top-1/2 -translate-y-1/2 flex items-center gap-5 pointer-events-none z-10 transition-opacity">
                  <Image
                    src="/storefront/search.svg"
                    alt="Search"
                    width={24}
                    height={24}
                    className="w-6 h-6"
                  />
                  <span className="text-white/80 text-[16px] font-semibold tracking-[0.8px]">
                    Search for a product
                  </span>
                </div>
              )}
              <div
                className="h-[60px] rounded-[45px] bg-transparent relative overflow-hidden"
                style={{
                  background: "transparent",
                  border: "2px solid transparent",
                  backgroundImage: "linear-gradient(#191919, #191919), linear-gradient(179deg, #405BFF 1.06%, #7084FF 123.42%)",
                  backgroundOrigin: "border-box",
                  backgroundClip: "padding-box, border-box",
                }}
              >
                <Input
                  type="search"
                  placeholder=""
                  value={mobileSearchQuery}
                  onChange={(e) => setMobileSearchQuery(e.target.value)}
                  onFocus={() => setMobileSearchFocused(true)}
                  onBlur={() => setMobileSearchFocused(false)}
                  autoFocus
                  className="h-full rounded-[45px] border-0 bg-transparent text-white text-[16px] pl-[90px] focus-visible:ring-0 focus-visible:ring-offset-0"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setMobileSearchOpen(false)
                      setMobileSearchQuery("")
                      setMobileSearchFocused(false)
                    }
                  }}
                />
              </div>
            </div>
            
            {/* Mobile Search Results */}
            <div className="flex-1 overflow-y-auto hide-scrollbar pb-4 min-h-0">
              {mobileSearchQuery && (Array.isArray(mobileSearchResults) ? mobileSearchResults.length > 0 : mobileSearchResults.featured.length > 0 || mobileSearchResults.other.length > 0) ? (
                <div className="space-y-4">
                  {/* Check if results are grouped (featured-list algorithm) */}
                  {!Array.isArray(mobileSearchResults) ? (
                    <>
                      {/* Featured Section */}
                      {mobileSearchResults.featured.length > 0 && (
                        <div className="space-y-3">
                          <h2 className="text-white text-lg font-bold px-2">Featured</h2>
                          {mobileSearchResults.featured.map((product) => (
                            <div
                              key={product.id}
                              onClick={() => {
                                onViewProduct?.(product)
                                setMobileSearchOpen(false)
                                setMobileSearchQuery("")
                                setMobileSearchFocused(false)
                              }}
                              className="flex items-center gap-4 p-4 rounded-[15px] border-2 border-[#7084FF] hover:border-[#B3BDFF] cursor-pointer transition-colors bg-linear-to-b from-[#7084FF]/10 to-transparent"
                            >
                              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-[#2a2a2a] border border-[#7084FF]">
                                <Image
                                  src={product.images.main}
                                  alt={product.name}
                                  width={80}
                                  height={80}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white text-base sm:text-lg font-bold truncate mb-1">{product.name}</h3>
                                <p className="text-[#A7A9AC] text-xs sm:text-sm truncate">{product.description}</p>
                                <div className="flex items-center justify-between mt-2">
                                  {isFlashSaleActive ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[#7084FF] text-xs font-mono line-through opacity-50">${product.price.toFixed(2)}</span>
                                      <span className="text-[#EBFF38] text-sm sm:text-base font-mono">${getDiscountedPrice(product.price).toFixed(2)}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[#7084FF] text-sm sm:text-base font-mono">${product.price.toFixed(2)}</span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onAddToCart?.(product, 1)
                                    }}
                                    className="flex items-center gap-1 text-[#7084FF] hover:text-[#B3BDFF] transition-colors text-xs sm:text-sm"
                                  >
                                    <ShoppingCart size={14} />
                                    Add
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Other Products Section */}
                      {mobileSearchResults.other.length > 0 && (
                        <div className="space-y-3">
                          {mobileSearchResults.featured.length > 0 && (
                            <h2 className="text-[#A7A9AC] text-lg font-bold px-2 mt-4">Other Results</h2>
                          )}
                          {mobileSearchResults.other.map((product) => (
                            <div
                              key={product.id}
                              onClick={() => {
                                onViewProduct?.(product)
                                setMobileSearchOpen(false)
                                setMobileSearchQuery("")
                                setMobileSearchFocused(false)
                              }}
                              className="flex items-center gap-4 p-4 rounded-[15px] border border-[rgba(178,141,255,0.55)] hover:border-[#7084FF] cursor-pointer transition-colors bg-linear-to-b from-transparent to-black/20"
                            >
                              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-[#2a2a2a]">
                                <Image
                                  src={product.images.main}
                                  alt={product.name}
                                  width={80}
                                  height={80}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white text-base sm:text-lg font-bold truncate mb-1">{product.name}</h3>
                                <p className="text-[#A7A9AC] text-xs sm:text-sm truncate">{product.description}</p>
                                <div className="flex items-center justify-between mt-2">
                                  {isFlashSaleActive ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[#7084FF] text-xs font-mono line-through opacity-50">${product.price.toFixed(2)}</span>
                                      <span className="text-[#EBFF38] text-sm sm:text-base font-mono">${getDiscountedPrice(product.price).toFixed(2)}</span>
                                    </div>
                                  ) : (
                                    <span className="text-[#7084FF] text-sm sm:text-base font-mono">${product.price.toFixed(2)}</span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onAddToCart?.(product, 1)
                                    }}
                                    className="flex items-center gap-1 text-[#7084FF] hover:text-[#B3BDFF] transition-colors text-xs sm:text-sm"
                                  >
                                    <ShoppingCart size={14} />
                                    Add
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Regular list (price-based algorithms) */
                    mobileSearchResults.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => {
                          onViewProduct?.(product)
                          setMobileSearchOpen(false)
                          setMobileSearchQuery("")
                        }}
                        className="flex items-center gap-4 p-4 rounded-[15px] border border-[rgba(178,141,255,0.55)] hover:border-[#7084FF] cursor-pointer transition-colors bg-linear-to-b from-transparent to-black/20"
                      >
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-[#2a2a2a]">
                          <Image
                            src={product.images.main}
                            alt={product.name}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white text-base sm:text-lg font-bold truncate mb-1">{product.name}</h3>
                          <p className="text-[#A7A9AC] text-xs sm:text-sm truncate">{product.description}</p>
                          <div className="flex items-center justify-between mt-2">
                            {isFlashSaleActive ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[#7084FF] text-xs font-mono line-through opacity-50">${product.price.toFixed(2)}</span>
                                <span className="text-[#EBFF38] text-sm sm:text-base font-mono">${getDiscountedPrice(product.price).toFixed(2)}</span>
                              </div>
                            ) : (
                              <span className="text-[#7084FF] text-sm sm:text-base font-mono">${product.price.toFixed(2)}</span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onAddToCart?.(product, 1, undefined, true)
                              }}
                              className="flex items-center gap-1 text-[#7084FF] hover:text-[#B3BDFF] transition-colors text-xs sm:text-sm"
                            >
                              <ShoppingCart size={14} />
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : mobileSearchQuery && (Array.isArray(mobileSearchResults) ? mobileSearchResults.length === 0 : mobileSearchResults.featured.length === 0 && mobileSearchResults.other.length === 0) ? (
                <div className="text-center py-12">
                  <p className="text-[#A7A9AC] text-sm">No products found</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Login Dialog */}
      <LoginDialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen} />

      {/* Rewards Dialog - Only render if feature flag is enabled */}
      {rewardsProgramEnabled && (
        <RewardsDialog open={rewardsDialogOpen} onOpenChange={setRewardsDialogOpen} />
      )}

      {/* QR Code Overlay - Full Screen */}
      {showQRCode && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Close if clicking on the overlay background (not on content)
            if (e.target === e.currentTarget) {
              setShowQRCode(false)
            }
          }}
        >
          {/* Close button - top right */}
          <button
            onClick={() => setShowQRCode(false)}
            className="absolute top-4 right-4 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-[1.125px] border-[#7084FF] bg-[#7084FF]/10 flex items-center justify-center hover:bg-[#7084FF]/20 transition-colors z-10"
            aria-label="Close QR Code"
          >
            <X size={20} className="text-[#7084FF]" />
          </button>
          
          {/* QR Code Content */}
          <div className="flex flex-col items-center gap-8 sm:gap-10 w-full max-w-4xl px-4">
            <p className="text-white text-xl sm:text-2xl md:text-3xl font-bold text-center">
              Scan to open on your mobile device
            </p>
            <div className="bg-white p-8 sm:p-12 md:p-16 rounded-[30px] flex items-center justify-center shadow-2xl">
              <QRCodeSVG
                value={currentUrl}
                size={500}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-[#A7A9AC] text-base sm:text-lg md:text-xl text-center break-all max-w-full px-4">
              {currentUrl}
            </p>
          </div>
        </div>
      )}
    </header>
    </>
  )
}

