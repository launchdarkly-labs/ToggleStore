"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useFlags } from "launchdarkly-react-client-sdk"

interface BannerProps {
	message?: string
	onShopNow?: () => void
}

export function Banner({ message, onShopNow }: BannerProps) {
	// Get feature flag from LaunchDarkly
	const flags = useFlags()
	const storePromoBanner = flags.storePromoBanner as string | undefined

	// Map flag variations to banner variants
	// Flag variations: "Flash Sale", "Free Shipping", "20 Percent Off"
	const getVariant = (flagValue: string | undefined): "flash-sale" | "free-shipping" | "promo-code" | null => {
		if (!flagValue) return null
		const normalized = flagValue.toLowerCase().trim()
		// Handle variations of the flag values
		if (normalized === "flash sale" || (normalized.includes("flash") && normalized.includes("sale"))) {
			return "flash-sale"
		}
		if (normalized === "free shipping" || (normalized.includes("free") && normalized.includes("shipping"))) {
			return "free-shipping"
		}
		if (normalized === "20 percent off" || normalized.includes("20 percent") || normalized.includes("20%")) {
			return "promo-code"
		}
		return null
	}

	const variant = getVariant(storePromoBanner)

	// Default messages for each variant
	const defaultMessages: Record<"flash-sale" | "free-shipping" | "promo-code", string | undefined> = {
		"flash-sale": "Get up to 50% off on selected items - Don't miss out!",
		"free-shipping": "On all orders over $50 - Shop your favorites today!",
		"promo-code": undefined
	}

	// If no variant is set, don't render the banner
	if (!variant) return null

	const displayMessage = message || defaultMessages[variant]

	if (variant === "flash-sale") {
		return (
			<div 
				className="w-full relative h-[54px] flex items-center justify-between px-4 md:px-8 lg:px-[182px] banner-gradient-flow"
			>
				<div className="flex items-center gap-2 md:gap-[19px] min-w-0 flex-1">
					{/* Flash Sale Label with Icon */}
					<div className="flex items-center gap-2 md:gap-3 shrink-0">
						<Image
							src="/assets/icons/bolt.svg"
							alt=""
							width={13}
							height={16}
							className="w-[13px] h-[16px]"
						/>
						<p 
							className="text-[14px] font-bold tracking-[2.1px] uppercase whitespace-nowrap"
							style={{
								fontFamily: "Sohne Mono, monospace",
								WebkitTextFillColor: "transparent",
								backgroundImage: "linear-gradient(180deg, #EBFF38 0%, #EBFF38 100%)",
								backgroundClip: "text",
							}}
						>
							FLASH SALE
						</p>
					</div>

					{/* Divider */}
					<div className="hidden md:block h-[24px] w-0 border-l border-white/30" />

					{/* Message */}
					<p className="hidden md:block text-white text-[16px] font-bold whitespace-nowrap" style={{ fontFamily: "Sohne, sans-serif" }}>
						{displayMessage}
					</p>

					{/* Divider */}
					<div className="hidden lg:block h-[24px] w-0 border-l border-white/30" />

					{/* Limited Time Label */}
					<p 
						className="hidden lg:block text-[14px] font-bold tracking-[2.1px] uppercase whitespace-nowrap"
						style={{
							fontFamily: "Sohne Mono, monospace",
							WebkitTextFillColor: "transparent",
							backgroundImage: "linear-gradient(180deg, #EBFF38 0%, #EBFF38 100%)",
							backgroundClip: "text",
						}}
					>
						LIMITED TIME ONLY
					</p>
				</div>

				{/* Shop Now Button */}
				<Button
					variant="outline"
					className="flex rounded-[60px] px-4 md:px-6 py-2 h-auto border-white text-white hover:bg-white/10 transition-colors text-[14px] md:text-[16px] font-normal shrink-0"
					style={{ fontFamily: "Sohne, sans-serif" }}
					onClick={onShopNow}
				>
					Shop Now
				</Button>
			</div>
		)
	}

	if (variant === "free-shipping") {
		return (
			<div className="w-full relative h-[54px] flex items-center justify-between px-4 md:px-8 lg:px-[182px] banner-gradient-flow-shipping">
				<div className="flex items-center gap-2 md:gap-[19px] min-w-0 flex-1">
					{/* Free Shipping Label with Icon */}
					<div className="flex items-center gap-2 md:gap-3 shrink-0">
						<Image
							src="/assets/icons/shipping.svg"
							alt=""
							width={22}
							height={16}
							className="w-[22px] h-[16px]"
						/>
						<p 
							className="text-[14px] font-bold tracking-[2.1px] uppercase whitespace-nowrap"
							style={{
								fontFamily: "Sohne Mono, monospace",
								WebkitTextFillColor: "transparent",
								backgroundImage: "linear-gradient(180deg, #EBFF38 0%, #EBFF38 100%)",
								backgroundClip: "text",
							}}
						>
							FREE SHIPPING
						</p>
					</div>

					{/* Divider */}
					<div className="hidden md:block h-[24px] w-0 border-l border-white/30" />

					{/* Message */}
					<p className="hidden md:block text-white text-[16px] font-bold whitespace-nowrap" style={{ fontFamily: "Sohne, sans-serif" }}>
						{displayMessage}
					</p>
				</div>

				{/* Shop Now Button */}
				<Button
					variant="outline"
					className="flex rounded-[60px] px-4 md:px-6 py-2 h-auto border-[#EBFF38] text-[#EBFF38] hover:bg-[#EBFF38]/10 transition-colors text-[14px] md:text-[16px] font-normal shrink-0"
					style={{ 
						fontFamily: "Sohne, sans-serif",
						WebkitTextFillColor: "transparent",
						backgroundImage: "linear-gradient(180deg, #EBFF38 0%, #EBFF38 100%)",
						backgroundClip: "text",
					}}
					onClick={onShopNow}
				>
					Shop Now
				</Button>
			</div>
		)
	}

	// Promo Code variant
	const promoCodeContent = (
		<>
			<div className="flex items-center gap-3 shrink-0">
				<p className="text-white text-[14px] font-bold tracking-[2.1px] uppercase whitespace-nowrap" style={{ fontFamily: "Sohne, sans-serif" }}>
					20% OFF APPAREL
				</p>
				<Image
					src="/assets/icons/price-tag.svg"
					alt=""
					width={16}
					height={16}
					className="w-4 h-4 shrink-0"
				/>
			</div>
			<div className="h-6 w-0 border-l border-white/30" />
			<div className="flex items-center gap-2 shrink-0">
				<p className="text-white text-[14px] font-bold tracking-[2.1px] whitespace-nowrap" style={{ fontFamily: "Sohne, sans-serif" }}>
					USE PROMO CODE:
				</p>
				<p 
					className="text-[14px] font-bold tracking-[2.1px] whitespace-nowrap"
					style={{
						fontFamily: "Sohne Mono, monospace",
						WebkitTextFillColor: "transparent",
						backgroundImage: "linear-gradient(180deg, #EBFF38 0%, #EBFF38 100%)",
						backgroundClip: "text",
					}}
				>
					DARKLY20
				</p>
			</div>
		</>
	)

	return (
		<div className="w-full bg-[#282828] relative h-[54px] banner-promo-scroll overflow-hidden">
			<div className="banner-promo-content items-center h-full whitespace-nowrap">
				{/* Duplicate content multiple times for seamless infinite scroll */}
				{promoCodeContent}
				<div className="h-6 w-0 border-l border-white/30 mx-0" />
				{promoCodeContent}
				<div className="h-6 w-0 border-l border-white/30 mx-0" />
				{promoCodeContent}
				<div className="h-6 w-0 border-l border-white/30 mx-0" />
				{promoCodeContent}
				<div className="h-6 w-0 border-l border-white/30 mx-0" />
				{promoCodeContent}
				<div className="h-6 w-0 border-l border-white/30 mx-0" />
				{promoCodeContent}
			</div>
		</div>
	)
}

