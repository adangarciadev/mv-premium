import { useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'

/**
 * Drag-down-to-dismiss gesture for the bottom sheet. Owns the transient drag
 * offset/flag and the sheet ref; calls `onClose` once a deliberate pull crosses
 * the dismiss threshold (after the exit animation completes).
 */
export function useSheetDrag(onClose: () => void) {
	const sheetRef = useRef<HTMLElement>(null)
	const dragStartYRef = useRef<number | null>(null)
	const [dragOffset, setDragOffset] = useState(0)
	const [isDragging, setIsDragging] = useState(false)

	const handleSheetTouchStart = (event: ReactTouchEvent) => {
		dragStartYRef.current = event.touches[0]?.clientY ?? null
		setIsDragging(true)
	}

	const handleSheetTouchMove = (event: ReactTouchEvent) => {
		if (dragStartYRef.current === null) return
		const currentY = event.touches[0]?.clientY ?? dragStartYRef.current
		setDragOffset(Math.max(0, currentY - dragStartYRef.current))
	}

	const handleSheetTouchEnd = () => {
		const sheetHeight = sheetRef.current?.offsetHeight ?? 0
		// Dismiss only after a deliberate pull: ~1/4 of the sheet height (140px minimum on any screen).
		const dismissThreshold = Math.max(140, sheetHeight * 0.25)
		const shouldClose = dragOffset > dismissThreshold
		dragStartYRef.current = null
		setIsDragging(false)

		if (shouldClose && sheetHeight > 0) {
			// Animated exit: slide the sheet fully down, then unmount.
			setDragOffset(sheetHeight)
			window.setTimeout(() => {
				onClose()
				setDragOffset(0)
			}, 220)
			return
		}

		// Below the threshold: snap back (animated by the transform transition).
		setDragOffset(0)
	}

	return {
		sheetRef,
		dragOffset,
		isDragging,
		handleSheetTouchStart,
		handleSheetTouchMove,
		handleSheetTouchEnd,
	}
}
