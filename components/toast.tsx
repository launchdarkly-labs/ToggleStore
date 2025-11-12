"use client"

import Image from "next/image"
import { X } from "lucide-react"
import { motion } from "framer-motion"

export interface ToastProps {
	variant: "error" | "success"
	message: string
	onClose?: () => void
}

export function Toast({ variant, message, onClose }: ToastProps) {
	const iconSrc = variant === "error" ? "/assets/icons/error.svg" : "/assets/icons/success.svg"

	const gradientClass = variant === "error" ? "toast-gradient-error" : "toast-gradient-success"

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: 50, scale: 0.95 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: -20, scale: 0.95 }}
			transition={{
				type: "spring",
				stiffness: 300,
				damping: 30,
				mass: 0.8,
			}}
			className={`
				relative flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-4 rounded-[12px]
				min-h-[48px] sm:min-h-[54px] w-full max-w-full
				border border-white/10
				pointer-events-auto
				${gradientClass}
				shadow-lg
			`}
		>
			{/* Icon and Label */}
			<div className="flex items-center gap-2 shrink-0">
				<div className="w-4 h-4 relative shrink-0">
					<Image
						src={iconSrc}
						alt=""
						width={16}
						height={16}
						className="w-full h-full"
					/>
				</div>
				<p
					className="text-[14px] font-bold tracking-[2.1px] uppercase whitespace-nowrap text-white"
					style={{
						fontFamily: "Sohne Mono, monospace",
					}}
				>
					{variant === "error" ? "ERROR :" : "SUCCESS"}
				</p>
			</div>

			{/* Message */}
			<p
				className="flex-1 text-white text-[14px] sm:text-[16px] md:text-[19px] font-normal leading-normal text-left"
				style={{ fontFamily: "Sohne, sans-serif" }}
			>
				{message}
			</p>

			{/* Close Button */}
			{onClose && (
				<button
					onClick={onClose}
					className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"
					aria-label="Close toast"
				>
					<X size={12} className="sm:w-[14px] sm:h-[14px] text-white/70" />
				</button>
			)}
		</motion.div>
	)
}

