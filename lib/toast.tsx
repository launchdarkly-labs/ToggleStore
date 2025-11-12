"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { AnimatePresence } from "framer-motion"
import { Toast } from "@/components/toast"

export type ToastVariant = "error" | "success"

export interface ToastMessage {
	id: string
	variant: ToastVariant
	message: string
}

interface ToastContextType {
	toasts: ToastMessage[]
	showToast: (variant: ToastVariant, message: string) => void
	removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<ToastMessage[]>([])

	const showToast = useCallback((variant: ToastVariant, message: string) => {
		const id = Math.random().toString(36).substring(2, 9)
		const newToast: ToastMessage = { id, variant, message }
		
		setToasts((prev) => [...prev, newToast])

		// Auto remove after 5 seconds
		setTimeout(() => {
			setToasts((prev) => prev.filter((toast) => toast.id !== id))
		}, 5000)
	}, [])

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id))
	}, [])

	return (
		<ToastContext.Provider value={{ toasts, showToast, removeToast }}>
			{children}
			<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-100 flex flex-col-reverse gap-2 sm:gap-3 items-center pointer-events-none w-full max-w-[calc(100vw-32px)] sm:max-w-md px-4">
				<AnimatePresence mode="sync">
					{toasts.map((toast) => (
						<Toast
							key={toast.id}
							variant={toast.variant}
							message={toast.message}
							onClose={() => removeToast(toast.id)}
						/>
					))}
				</AnimatePresence>
			</div>
		</ToastContext.Provider>
	)
}

export function useToast() {
	const context = useContext(ToastContext)
	if (!context) {
		throw new Error("useToast must be used within ToastProvider")
	}
	return context
}

