"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Header } from "@/components/header"
import { ProductCard } from "@/components/product-card"
import { Cart } from "@/components/cart"
import { Sidebar } from "@/components/sidebar"
import { ProductDetailDialog } from "@/components/product-detail-dialog"
import { ChatBot } from "@/components/chatbot"
import { DeveloperModeOverlay } from "@/components/developer-mode-overlay"
import { Button } from "@/components/ui/button"
import { CartItem, Product } from "@/types/product"
import productsData from "@/data/products.json"
import Image from "next/image"
import { useToast } from "@/lib/toast"
import { useFlags } from "launchdarkly-react-client-sdk"
import { logger } from "@/lib/logger"
import { recordErrorToLD } from "@/lib/launchdarkly/observability"
import { useTrackMetric } from "@/lib/launchdarkly/metrics"

const products = productsData as Product[]

export default function Home() {
	// Get banner flag to determine padding calculation
	const flags = useFlags()
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
	const { showToast } = useToast()
	const trackMetric = useTrackMetric()
	const [cartOpen, setCartOpen] = useState(false)
	const [sidebarOpen, setSidebarOpen] = useState(false)
	const [cartItems, setCartItems] = useState<CartItem[]>([])
	const [selectedCategory, setSelectedCategory] = useState("All")
	const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
	const [productDetailOpen, setProductDetailOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [apiErrors, setApiErrors] = useState<string[]>([])
	const hasTrackedStoreAccessRef = useRef(false)
	const hasTrackedSearchRef = useRef(false)
	
	// Check the apiRelease feature flag
	const apiReleaseEnabled = flags["apiRelease"] === true
	
	// Carousel swipe/drag state
	const [isDragging, setIsDragging] = useState(false)
	const carouselRef = useRef<HTMLDivElement>(null)
	const dragOffsetRef = useRef(0)
	const lastTimeRef = useRef(0)
	const isDraggingRef = useRef(false)
	const startXRef = useRef(0)
	const currentXRef = useRef(0)
	const scrollOffsetRef = useRef(0)
	const animationFrameRef = useRef<number | null>(null)
	const manualAnimationRef = useRef(false)

	const categories = ["All", "Apparel", "Drinkware", "Accessories"]
	const featuredProducts = products.filter((p) => p.featured)
	
	// Filter products by category and search (broken when apiRelease is enabled)
	const getFilteredProducts = () => {
		let filtered = selectedCategory === "All" ? products : products.filter((p) => p.category === selectedCategory)
		
		// Break search when apiRelease flag is enabled
		if (apiReleaseEnabled) {
			// Return broken/malformed results
			return []
		}
		
		if (searchQuery.trim()) {
			filtered = filtered.filter((p) =>
				p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
				p.category.toLowerCase().includes(searchQuery.toLowerCase())
			)
		}
		
		return filtered
	}
	
	const regularProducts = getFilteredProducts()
	
	// Track store access on initial page load
	useEffect(() => {
		if (!hasTrackedStoreAccessRef.current) {
			trackMetric("store-accessed")
			hasTrackedStoreAccessRef.current = true
		}
	}, [trackMetric])
	
	// Track search started (only once per search session)
	useEffect(() => {
		if (searchQuery.trim() && !hasTrackedSearchRef.current) {
			trackMetric("search-started")
			hasTrackedSearchRef.current = true
		} else if (!searchQuery.trim()) {
			hasTrackedSearchRef.current = false
		}
	}, [searchQuery, trackMetric])
	
	// Handle drag start (mouse or touch)
	const handleDragStart = useCallback((clientX: number) => {
		if (!carouselRef.current) return
		
		// Stop manual animation if running
		manualAnimationRef.current = false
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current)
			animationFrameRef.current = null
		}
		
		isDraggingRef.current = true
		startXRef.current = clientX
		currentXRef.current = clientX
		setIsDragging(true)
		
		// Get current transform from computed style (from animation or previous drag)
		const computedStyle = window.getComputedStyle(carouselRef.current)
		const matrix = computedStyle.transform || computedStyle.webkitTransform
		
		let currentOffset = 0
		if (matrix && matrix !== 'none') {
			// Parse matrix to get translateX value
			const matrixValues = matrix.match(/matrix.*\((.+)\)/)
			if (matrixValues) {
				const values = matrixValues[1].split(', ')
				currentOffset = parseFloat(values[4] || '0')
			} else {
				// Fallback: try to parse translateX directly
				const match = computedStyle.transform.match(/translateX\(([^)]+)\)/)
				if (match) {
					currentOffset = parseFloat(match[1])
				}
			}
		}
		dragOffsetRef.current = currentOffset
		scrollOffsetRef.current = currentOffset
		
		// Completely stop animation and take manual control - instant response
		carouselRef.current.style.animation = 'none'
		carouselRef.current.style.animationPlayState = 'paused'
		carouselRef.current.style.transition = 'none' // No transition during drag for instant response
		carouselRef.current.classList.add('dragging')
		carouselRef.current.style.transform = `translateX(${currentOffset}px)`
	}, [])
	
	// Handle drag move
	const handleDragMove = useCallback((clientX: number) => {
		if (!isDraggingRef.current || !carouselRef.current) return
		
		const diff = clientX - startXRef.current
		const carouselWidth = carouselRef.current.scrollWidth / 2
		
		// Calculate new offset - swiping right (positive diff) moves content right (less negative)
		// Swiping left (negative diff) moves content left (more negative)
		let newOffset = dragOffsetRef.current + diff
		
		// Normalize to stay within loop bounds (-carouselWidth to 0)
		while (newOffset <= -carouselWidth) {
			newOffset += carouselWidth
		}
		while (newOffset > 0) {
			newOffset -= carouselWidth
		}
		
		scrollOffsetRef.current = newOffset
		currentXRef.current = clientX
		
		// Apply manual transform - disable transition during drag for instant response
		carouselRef.current.style.transition = 'none'
		carouselRef.current.style.transform = `translateX(${newOffset}px)`
	}, [])
	
	// Calculate product width (including gap)
	const getProductWidth = useCallback(() => {
		if (!carouselRef.current) return 0
		const carouselWidth = carouselRef.current.scrollWidth / 2
		return carouselWidth / featuredProducts.length
	}, [featuredProducts.length])
	
	// Calculate which product is currently centered
	const getCurrentProductIndex = useCallback((offset: number) => {
		const carouselWidth = carouselRef.current ? carouselRef.current.scrollWidth / 2 : 0
		const productWidth = getProductWidth()
		
		// Normalize offset to positive value for easier calculation
		let normalizedOffset = offset
		while (normalizedOffset < 0) normalizedOffset += carouselWidth
		while (normalizedOffset >= carouselWidth) normalizedOffset -= carouselWidth
		
		// Calculate which product is currently most visible (centered)
		// Offset is negative, so we need to invert the calculation
		const absOffset = Math.abs(offset)
		const productIndex = Math.floor((absOffset % carouselWidth) / productWidth)
		
		return Math.min(productIndex, featuredProducts.length - 1)
	}, [featuredProducts.length, getProductWidth])
	
	// Snap to a specific product
	const snapToProduct = useCallback((productIndex: number, direction: 'next' | 'prev') => {
		if (!carouselRef.current) return
		
		const carouselWidth = carouselRef.current.scrollWidth / 2
		const productWidth = getProductWidth()
		
		// Calculate target offset for the product
		// Direction determines which edge we snap to
		let targetOffset: number
		
		if (direction === 'next') {
			// Snap to the next product (move left, more negative)
			const nextIndex = (productIndex + 1) % featuredProducts.length
			targetOffset = -(nextIndex * productWidth)
		} else {
			// Snap to the previous product (move right, less negative)
			const prevIndex = productIndex - 1 < 0 ? featuredProducts.length - 1 : productIndex - 1
			targetOffset = -(prevIndex * productWidth)
		}
		
		// Normalize target offset
		while (targetOffset <= -carouselWidth) targetOffset += carouselWidth
		while (targetOffset > 0) targetOffset -= carouselWidth
		
		// Smoothly animate to target product
		carouselRef.current.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
		carouselRef.current.style.transform = `translateX(${targetOffset}px)`
		
		dragOffsetRef.current = targetOffset
		scrollOffsetRef.current = targetOffset
		
		// After snap animation completes, resume CSS animation from new position
		setTimeout(() => {
			if (carouselRef.current && !isDraggingRef.current) {
				carouselRef.current.style.transition = ''
				// Resume manual animation from new position
				const normalized = targetOffset
				const startTime = Date.now()
				const animationDuration = 90000
				const startOffset = normalized
				const endOffset = normalized - carouselWidth
				const totalDistance = Math.abs(endOffset - startOffset)
				const speed = totalDistance / animationDuration
				
				if (animationFrameRef.current) {
					cancelAnimationFrame(animationFrameRef.current)
				}
				
				manualAnimationRef.current = true
				
				const animate = () => {
					if (!carouselRef.current || !manualAnimationRef.current) {
						if (animationFrameRef.current) {
							cancelAnimationFrame(animationFrameRef.current)
							animationFrameRef.current = null
						}
						return
					}
					
					const elapsed = Date.now() - startTime
					let currentOffset = startOffset - (speed * elapsed)
					
					while (currentOffset <= -carouselWidth) {
						currentOffset += carouselWidth
					}
					
					if (elapsed >= animationDuration) {
						manualAnimationRef.current = false
						carouselRef.current.style.transition = ''
						carouselRef.current.style.transform = ''
						carouselRef.current.style.animation = 'scroll-infinite 90s linear infinite'
						carouselRef.current.style.animationPlayState = 'running'
						animationFrameRef.current = null
					} else {
						carouselRef.current.style.transition = ''
						carouselRef.current.style.transform = `translateX(${currentOffset}px)`
						animationFrameRef.current = requestAnimationFrame(animate)
					}
				}
				
				animationFrameRef.current = requestAnimationFrame(animate)
			}
		}, 400)
	}, [featuredProducts.length, getProductWidth])
	
	// Handle drag end
	const handleDragEnd = useCallback(() => {
		if (!isDraggingRef.current || !carouselRef.current) return
		
		isDraggingRef.current = false
		setIsDragging(false)
		
		// Calculate velocity and time for flick detection
		const velocity = currentXRef.current - startXRef.current
		const distance = Math.abs(velocity)
		const timeElapsed = Date.now() - lastTimeRef.current
		const speed = timeElapsed > 0 ? distance / timeElapsed : 0
		
		// Flick detection: fast swipe (high speed) with minimum distance
		const FLICK_THRESHOLD = 0.5 // pixels per millisecond
		const MIN_FLICK_DISTANCE = 50 // minimum pixels moved
		
		const isFlick = timeElapsed < 300 && speed > FLICK_THRESHOLD && distance > MIN_FLICK_DISTANCE
		
		if (isFlick) {
			// Flick gesture detected - snap to next/previous product
			const currentIndex = getCurrentProductIndex(scrollOffsetRef.current)
			const direction = velocity > 0 ? 'prev' : 'next' // positive velocity = swipe right = prev product
			
			snapToProduct(currentIndex, direction)
			return
		}
		
		// Regular drag with momentum (slow swipe)
		const momentum = timeElapsed > 0 && timeElapsed < 500 
			? (velocity / Math.max(timeElapsed, 10)) * 200 
			: 0
		
		// Apply momentum (positive momentum = less negative offset = scroll right)
		const carouselWidth = carouselRef.current.scrollWidth / 2
		let finalOffset = scrollOffsetRef.current + momentum
		
		// Normalize final position
		while (finalOffset <= -carouselWidth) finalOffset += carouselWidth
		while (finalOffset > 0) finalOffset -= carouselWidth
		
		dragOffsetRef.current = finalOffset
		scrollOffsetRef.current = finalOffset
		
		// Remove dragging class
		carouselRef.current.classList.remove('dragging')
		
		// Smoothly animate to final position with momentum, then resume CSS animation
		// Add smooth transition for momentum effect
		carouselRef.current.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
		carouselRef.current.style.transform = `translateX(${finalOffset}px)`
		
		// After momentum animation completes, manually continue scrolling at CSS animation speed
		// This keeps the position smooth and transitions seamlessly
		setTimeout(() => {
			if (carouselRef.current && !isDraggingRef.current) {
				const carouselWidth = carouselRef.current.scrollWidth / 2
				// Ensure position is normalized
				let normalized = finalOffset
				while (normalized <= -carouselWidth) normalized += carouselWidth
				while (normalized > 0) normalized -= carouselWidth
				
				let currentOffset = normalized
				const startTime = Date.now()
				const animationDuration = 90000 // 90 seconds to match CSS animation
				const startOffset = normalized
				const endOffset = normalized - carouselWidth
				const totalDistance = Math.abs(endOffset - startOffset)
				const speed = totalDistance / animationDuration // pixels per ms
				
				// Cancel any existing animation
				if (animationFrameRef.current) {
					cancelAnimationFrame(animationFrameRef.current)
				}
				
				manualAnimationRef.current = true
				
				// Manual animation loop - continues from current position
				const animate = () => {
					if (!carouselRef.current || !manualAnimationRef.current) {
						if (animationFrameRef.current) {
							cancelAnimationFrame(animationFrameRef.current)
							animationFrameRef.current = null
						}
						return
					}
					
					const elapsed = Date.now() - startTime
					currentOffset = startOffset - (speed * elapsed)
					
					// Normalize when we complete a cycle
					while (currentOffset <= -carouselWidth) {
						currentOffset += carouselWidth
					}
					
					// If we've completed one full cycle or animation duration, switch to CSS animation
					if (elapsed >= animationDuration) {
						manualAnimationRef.current = false
						// Reset to start position for CSS animation (seamless loop)
						carouselRef.current.style.transition = ''
						carouselRef.current.style.transform = '' // Let CSS animation take over
						carouselRef.current.style.animation = 'scroll-infinite 90s linear infinite'
						carouselRef.current.style.animationPlayState = 'running'
						animationFrameRef.current = null
					} else {
						carouselRef.current.style.transition = ''
						carouselRef.current.style.transform = `translateX(${currentOffset}px)`
						animationFrameRef.current = requestAnimationFrame(animate)
					}
				}
				
				animationFrameRef.current = requestAnimationFrame(animate)
			}
		}, 300)
	}, [getCurrentProductIndex, snapToProduct])
	
	// Mouse event handlers
	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault()
		lastTimeRef.current = Date.now()
		handleDragStart(e.clientX)
	}
	
	const handleMouseMoveGlobal = useCallback((e: MouseEvent) => {
		handleDragMove(e.clientX)
		lastTimeRef.current = Date.now()
	}, [handleDragMove])
	
	const handleMouseUpGlobal = useCallback(() => {
		handleDragEnd()
	}, [handleDragEnd])
	
	// Touch event handlers
	const handleTouchStart = useCallback((e: React.TouchEvent) => {
		e.preventDefault()
		lastTimeRef.current = Date.now()
		if (e.touches.length > 0) {
			handleDragStart(e.touches[0].clientX)
		}
	}, [handleDragStart])
	
	const handleTouchMove = useCallback((e: React.TouchEvent) => {
		if (!isDraggingRef.current) return
		e.preventDefault()
		if (e.touches.length > 0) {
			handleDragMove(e.touches[0].clientX)
			lastTimeRef.current = Date.now()
		}
	}, [handleDragMove])
	
	const handleTouchEnd = useCallback(() => {
		if (isDraggingRef.current) {
			handleDragEnd()
		}
	}, [handleDragEnd])
	
	// Global touch move handler for better mobile support
	const handleTouchMoveGlobal = useCallback((e: TouchEvent) => {
		if (isDraggingRef.current && e.touches.length > 0) {
			e.preventDefault()
			handleDragMove(e.touches[0].clientX)
			lastTimeRef.current = Date.now()
		}
	}, [handleDragMove])
	
	const handleTouchEndGlobal = useCallback(() => {
		if (isDraggingRef.current) {
			handleDragEnd()
		}
	}, [handleDragEnd])
	
	// Handle global mouse and touch events during drag
	useEffect(() => {
		if (isDragging) {
			// Mouse events
			window.addEventListener('mousemove', handleMouseMoveGlobal, { passive: false })
			window.addEventListener('mouseup', handleMouseUpGlobal)
			window.addEventListener('mouseleave', handleMouseUpGlobal)
			
			// Touch events (for better mobile support)
			window.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false })
			window.addEventListener('touchend', handleTouchEndGlobal)
			window.addEventListener('touchcancel', handleTouchEndGlobal)
			
			return () => {
				window.removeEventListener('mousemove', handleMouseMoveGlobal)
				window.removeEventListener('mouseup', handleMouseUpGlobal)
				window.removeEventListener('mouseleave', handleMouseUpGlobal)
				window.removeEventListener('touchmove', handleTouchMoveGlobal)
				window.removeEventListener('touchend', handleTouchEndGlobal)
				window.removeEventListener('touchcancel', handleTouchEndGlobal)
			}
		}
	}, [isDragging, handleMouseMoveGlobal, handleMouseUpGlobal, handleTouchMoveGlobal, handleTouchEndGlobal])

	// Poll product API health endpoint when apiRelease flag is enabled
	useEffect(() => {
		if (!apiReleaseEnabled) {
			// Clear errors when flag is disabled (in cleanup)
			return () => {
				setApiErrors([])
			}
		}

		let timeoutId: NodeJS.Timeout

		const pollHealth = async () => {
			try {
				const response = await fetch("/api/products/health")
				const data = await response.json()

				if (data.status === "error") {
					// Add error to the list (keep last 5 errors)
					setApiErrors((prev) => {
						const newErrors = [data.error, ...prev].slice(0, 5)
						return newErrors
					})

					// Show toast notification for new errors
					showToast("error", data.error)
				}
			} catch (error) {
				const errorObj = error instanceof Error ? error : new Error(String(error))
				
				// Show toast notification for the error
				showToast("error", `Failed to poll health endpoint: ${errorObj.message}`)
				
				// Log error for structured logging
				logger.error(
					"Failed to poll product API health endpoint",
					errorObj,
					{
						endpoint: "/api/products/health",
						component: "HomePage",
						flagEnabled: apiReleaseEnabled,
					}
				)
				
				// Record error to LaunchDarkly observability
				recordErrorToLD(
					errorObj,
					"Failed to poll product API health endpoint",
					{
						component: "HomePage",
						endpoint: "/api/products/health",
						flagEnabled: apiReleaseEnabled,
					}
				)
				
				// Throw error asynchronously for LaunchDarkly observability to track
				// Using setTimeout ensures toast notification is shown first
				setTimeout(() => {
					throw errorObj
				}, 0)
			}
		}

		// Wrapper to handle errors from pollHealth
		const pollHealthWithErrorHandling = async () => {
			try {
				await pollHealth()
			} catch {
				// Error is already logged and toast shown in pollHealth
				// This catch prevents unhandled promise rejections
				// The error is thrown asynchronously for LaunchDarkly observability
			}
		}

		// Initial poll
		pollHealthWithErrorHandling()

		// Poll every 5-10 seconds (randomized for demo effect)
		const scheduleNextPoll = () => {
			const delay = Math.random() * 5000 + 5000 // 5-10 seconds
			timeoutId = setTimeout(() => {
				pollHealthWithErrorHandling()
				scheduleNextPoll()
			}, delay)
		}

		scheduleNextPoll()

		return () => {
			if (timeoutId) clearTimeout(timeoutId)
			setApiErrors([])
		}
	}, [apiReleaseEnabled, showToast])

	const handleAddToCart = (product: Product, quantity: number = 1, selectedSize?: string, fromSearch: boolean = false) => {
		setCartItems((items) => {
			const existingItem = items.find((item) => item.product.id === product.id && item.selectedSize === selectedSize)
			if (existingItem) {
				return items.map((item) =>
					item.product.id === product.id && item.selectedSize === selectedSize
						? { ...item, quantity: item.quantity + quantity }
						: item
				)
			}
			return [...items, { product, quantity, selectedSize }]
		})
		
		// Track add-to-cart metric
		if (fromSearch) {
			trackMetric("add-to-cart-from-search")
		} else {
			trackMetric("add-to-cart")
		}
		
		// Show success toast notification
		showToast("success", `${product.name} added to cart`)
	}

	const handleViewProduct = (product: Product) => {
		setSelectedProduct(product)
		setProductDetailOpen(true)
		// Track product viewed
		trackMetric("product-viewed")
	}

	const handleUpdateQuantity = (productId: string, quantity: number) => {
		if (quantity <= 0) {
			setCartItems((items) => items.filter((item) => item.product.id !== productId))
		} else {
			setCartItems((items) =>
				items.map((item) =>
					item.product.id === productId ? { ...item, quantity } : item
				)
			)
		}
	}

	const handleCheckout = () => {
		// Clear cart items after successful checkout
		setCartItems([])
		// Cart will close automatically via onClose after processing
	}

	const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0)

	return (
		<div className="min-h-screen bg-[#191919] relative overflow-x-hidden no-scrollbar">
			{/* Background Effects */}
			<div className="fixed inset-0 z-0 pointer-events-none overflow-hidden w-full h-full">
				<Image
					src="/storefront/background glows.svg"
					alt=""
					fill
					sizes="100vw"
					className="object-cover w-full h-full opacity-50 pointer-events-none"
					priority
				/>
			</div>

			{/* Header */}
			<Header 
				onCartOpen={() => {
					setCartOpen(true)
					trackMetric("cart-accessed")
				}} 
				cartItemCount={totalItems}
				onAddToCart={(product, quantity, selectedSize, fromSearch) => handleAddToCart(product, quantity, selectedSize, fromSearch)}
				onViewProduct={handleViewProduct}
				onSidebarOpen={() => setSidebarOpen(true)}
			/>

			{/* Content wrapper with top padding to account for header and banner */}
			<div className={`${showBanner ? 'pt-[154px] md:pt-[160px]' : 'pt-[100px] md:pt-[106px]'}`}>

			{/* Hero Section */}
			<div className="w-full flex justify-center mt-20 md:mt-25 lg:mt-30">
				<div
					className="
            flex flex-row items-center justify-center
            w-full
            relative
            px-4
            md:px-12
            lg:px-0
            max-w-[1550px]
          "
				>
					{/* "Toggle" text */}
					<h1
						className="
              text-[clamp(20px,12vw,64px)]
              md:text-[clamp(48px,18vw,100px)]
              lg:text-[clamp(48px,18vw,156px)]
              xl:text-[clamp(48px,18vw,200px)]
              font-bold
              mr-5
              md:mr-10
              lg:mr-[80px]
              xl:mr-[120px]
              text-[rgba(255,255,255,0.1)]
              leading-[1.2]
              select-none
              whitespace-nowrap
              z-30
              relative
              px-2
              md:px-8
              xl:px-0
              max-w-full
              overflow-visible
              shrink-0
            "
						style={{
							WebkitTextFillColor: "transparent",
							backgroundImage:
								"linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.1) 100%), linear-gradient(215.4deg, #fff 32.1%, #f7f8ff 34.4%, #7084ff 118.1%)",
							backgroundClip: "text",
						}}
					>
						Toggle
					</h1>

				{/* Toggle SVG - positioned absolutely in the middle */}
				<div className="absolute ml-10 md:ml-20 lg:ml-35 top-1/2  -translate-y-1/2 z-20" data-dev-highlight="sdk-init">
					<Image
						src="/storefront/ToggleHomePage.png"
						alt="Toggle Mascot"
						width={414}
						height={414}
						className="
              w-[clamp(100px,30vw,414px)] 
              h-[clamp(100px,30vw,414px)]
              md:w-[clamp(200px,30vw,414px)]
              md:h-[clamp(200px,30vw,414px)]
              lg:w-[clamp(300px,30vw,414px)]
              lg:h-[clamp(300px,30vw,414px)]
              xl:w-[clamp(400px,30vw,414px)]
              xl:h-[clamp(400px,30vw,414px)]
              "
					/>
				</div>

					<h1
						className="
              text-[clamp(20px,12vw,64px)]
              md:text-[clamp(48px,18vw,100px)]
              lg:text-[clamp(48px,18vw,156px)]
              xl:text-[clamp(48px,18vw,200px)]
              font-bold
              text-[rgba(255,255,255,0.1)]
              leading-[1.2]
              select-none
              whitespace-nowrap
              bg-clip-text
              z-10
              relative
            "
						style={{
							WebkitTextFillColor: "transparent",
							backgroundImage:
								"linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.1) 100%), linear-gradient(-28.2deg, #7084ff 18.3%, #f7f8ff 76.9%, #fff 152.47%)",
							backgroundClip: "text",
						}}
					>
						Store
					</h1>
				</div>
			</div>

		{/* Featured Carousel Section with Purple Glow */}
		<div className="w-full relative mt-20 md:mt-32 lg:mt-40">
			{/* Purple Glow Background - Not clipped */}
			<div className="absolute left-1/2 bottom-60  -translate-x-1/2 translate-y-1/2 w-[150vw] h-auto aspect-1504/1137 pointer-events-none z-0 scale-100 md:scale-110 lg:scale-125 xl:scale-150 2xl:scale-175 opacity-100 md:opacity-90 lg:opacity- xl:opacity-76 2xl:opacity-80">
				<Image
					src="/storefront/purple glow.svg"
					alt=""
					width={1504}
					height={1137}
					className="w-full h-full object-contain"
				/>
			</div>
			
			{/* Featured Carousel - Infinite Scroll */}
			<div className="w-full overflow-hidden relative z-10 py-8">
				<div 
					ref={carouselRef}
					className="featured-carousel-infinite flex gap-6 md:gap-[29px] items-center cursor-grab select-none touch-pan-x" 
					style={{ width: 'max-content', userSelect: 'none', WebkitUserSelect: 'none' }}
					onMouseDown={handleMouseDown}
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
				>
					{/* First set of products */}
					{featuredProducts.map((product) => (
						<div key={`featured-1-${product.id}`} className="product-card-wrapper shrink-0">
							<ProductCard
								product={product}
								featured
								onAddToCart={handleAddToCart}
								onViewDetails={handleViewProduct}
							/>
						</div>
					))}
					{/* Duplicate set for seamless loop */}
					{featuredProducts.map((product) => (
						<div key={`featured-2-${product.id}`} className="product-card-wrapper shrink-0">
							<ProductCard
								product={product}
								featured
								onAddToCart={handleAddToCart}
								onViewDetails={handleViewProduct}
							/>
						</div>
					))}
				</div>
			</div>
		</div>

			{/* API Errors Display (when apiRelease is enabled) */}
			{apiReleaseEnabled && apiErrors.length > 0 && (
				<div className="w-full px-4 md:px-8 lg:px-[182px] mt-8">
					<div className="bg-[#212121] border border-[#FF35A2] rounded-[10px] p-4 space-y-2">
						<div className="text-[#FF35A2] text-[12px] tracking-[1.8px] uppercase font-bold mb-2">
							Backend Errors Detected
						</div>
						{apiErrors.slice(0, 3).map((error, index) => (
							<div key={index} className="text-[#a7a9ac] text-[11px] leading-relaxed">
								{error}
							</div>
						))}
					</div>
				</div>
			)}

			{/* Filters */}
			<div className="w-full px-4 md:px-8 lg:px-[182px] mt-16 md:mt-24 lg:mt-32 flex flex-col md:flex-row items-center justify-between gap-6">
				<div className="flex items-center gap-[37.8px]">
					<button 
						className="w-[54px] h-[54px] z-10 rounded-full border-[1.125px] border-[#7084FF] flex items-center justify-center hover:bg-[#7084FF]/10 transition-colors"
						onClick={() => {
							if (apiReleaseEnabled) {
								showToast("error", "Search functionality unavailable: Backend service error")
							}
						}}
					>
						<Image
							src="/storefront/search.svg"
							alt="Search"
							width={31.5}
							height={31.5}
							className="w-[31.5px] h-[31.5px] z-10"
						/>
					</button>
					{apiReleaseEnabled ? (
						<input
							type="text"
							placeholder="Search unavailable..."
							disabled
							className="bg-[#212121] border border-[#FF35A2] rounded-[60px] px-6 py-3 text-white placeholder:text-[#FF35A2] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#FF35A2] disabled:opacity-50 disabled:cursor-not-allowed"
							style={{ minWidth: "200px" }}
						/>
					) : (
						<input
							type="text"
							placeholder="Search products..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="bg-[#212121] border border-[#58595b] rounded-[60px] px-6 py-3 text-white placeholder:text-[#a7a9ac] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#7084FF] focus:border-[#7084FF]"
							style={{ minWidth: "200px" }}
						/>
					)}
				</div>

				<p className="text-white text-2xl md:text-2xl text-center md:text-left z-10">
					{apiReleaseEnabled ? (
						<span>
							Showing <span className="text-[#FF35A2]">0</span> items -{" "}
							<span className="text-[#FF35A2]">Search unavailable</span>
						</span>
					) : (
						<>
							Showing {regularProducts.length} {regularProducts.length === 1 ? 'item' : 'items'} in{" "}
							<span className="text-[#7084ff]">&ldquo;{selectedCategory}&rdquo;</span>
						</>
					)}
				</p>

				<div className="flex flex-wrap items-center gap-3 md:gap-4 pb-2 w-full md:w-auto z-10 justify-center md:justify-start">
					{categories.map((category) => (
						<Button
							key={category}
							variant={selectedCategory === category ? "default" : "outline"}
							className={`rounded-[60px] px-6 md:px-[37.8px] py-[29px] whitespace-nowrap text-xl md:text-xl z-10 ${
								selectedCategory === category
									? "text-white category-button-selected"
									: "border-[#7084ff] text-[#7084FF] bg-[#191919] hover:border-[#7084FF] hover:bg-transparent hover:text-[#B3BDFF]"
							}`}
							onClick={() => setSelectedCategory(category)}
						>
							{category}
						</Button>
					))}
				</div>
			</div>

			{/* Product Grid */}
			<div className="w-full mt-12">
				<div className="max-w-[1400px] mx-auto px-4 md:px-8 lg:px-[182px]">
					<div className="grid justify-items-center gap-6 md:gap-8 xl:gap-10 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
						{regularProducts.map((product) => (
							<ProductCard
								key={product.id}
								product={product}
								onAddToCart={handleAddToCart}
								onViewDetails={handleViewProduct}
							/>
						))}
					</div>
				</div>
			</div>

			{/* Learn More Section */}
			<div className="w-full flex justify-center px-4 md:px-8 mt-32 md:mt-40 lg:mt-48 mb-20">
				<div className="max-w-[556px] w-full flex flex-col items-center gap-8 md:gap-[42px] z-10">
					<div className="flex flex-col items-center gap-2 text-center">
						<p
							className="text-[12px] tracking-[1.8px] uppercase font-bold bg-clip-text"
							style={{ WebkitTextFillColor: "white" }}
						>
							Learn More about LaunchDarkly
						</p>
					</div>

					<div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 w-full justify-center">
						<Button
							variant="default"
							className="rounded-[60px] px-6 md:px-[37.8px] py-[29px] whitespace-nowrap text-xl md:text-xl z-10 text-white category-button-selected w-full sm:w-auto"
							onClick={() => window.open("https://launchdarkly.com/request-a-demo/", "_blank")}
						>
							Book Meeting
						</Button>
						<Button
							variant="outline"
							className="rounded-[60px] px-6 md:px-[37.8px] py-[29px] text-xl md:text-xl whitespace-nowrap border-[#7084ff] text-[#7084FF] bg-[#191919] hover:border-[#7084FF] hover:bg-transparent hover:text-[#B3BDFF] w-full sm:w-auto"
							onClick={() => window.open("https://launchdarkly.com/", "_blank")}
						>
							Learn More
						</Button>
					</div>
				</div>
			</div>

			{/* Cart */}
			<Cart
				open={cartOpen}
				onClose={() => setCartOpen(false)}
				items={cartItems}
				onUpdateQuantity={handleUpdateQuantity}
				onCheckout={handleCheckout}
				onOpen={() => {
					setCartOpen(true)
					trackMetric("cart-accessed")
				}}
			/>

			{/* Sidebar */}
			<Sidebar
				open={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
			/>

			{/* Product Detail Dialog */}
			<ProductDetailDialog
				product={selectedProduct}
				open={productDetailOpen}
				onClose={() => {
					setProductDetailOpen(false)
					setSelectedProduct(null)
				}}
				onAddToCart={handleAddToCart}
			/>

			{/* ChatBot */}
			<ChatBot />

			{/* Developer Mode Overlay */}
			<DeveloperModeOverlay />
			</div>
		</div>
	)
}
