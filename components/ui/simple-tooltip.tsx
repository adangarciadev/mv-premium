import * as React from 'react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

// Tooltip personalizado SIN Portal - renderiza dentro del Shadow DOM
interface SimpleTooltipProps {
	children: React.ReactNode
	content: React.ReactNode
	side?: 'top' | 'right' | 'bottom' | 'left'
	delayDuration?: number
	disabled?: boolean
}

function SimpleTooltip({ children, content, side = 'top', delayDuration = 300, disabled = false }: SimpleTooltipProps) {
	const [isVisible, setIsVisible] = useState(false)
	const [position, setPosition] = useState({ top: 0, left: 0 })
	const triggerRef = useRef<HTMLDivElement>(null)
	const tooltipRef = useRef<HTMLDivElement>(null)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const showTooltip = () => {
		if (disabled || !content) return
		timeoutRef.current = setTimeout(() => {
			setIsVisible(true)
		}, delayDuration)
	}

	const hideTooltip = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current)
			timeoutRef.current = null
		}
		setIsVisible(false)
	}

	/**
	 * Only keyboard focus opens the tooltip.
	 *
	 * A dialog returns focus to whatever opened it when it closes, and that fired `focus` on a
	 * trigger the pointer was nowhere near — the tooltip appeared over the page and stayed there,
	 * because the matching `blur` only arrives once something else is clicked. `:focus-visible` is
	 * exactly the distinction the browser already makes between "tabbed here" and "was clicked".
	 */
	const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
		const target = event.target as HTMLElement
		try {
			if (!target.matches(':focus-visible')) return
		} catch {
			// A browser without :focus-visible in matches() keeps the old behaviour.
		}
		showTooltip()
	}

	// Calculate position when shown
	useEffect(() => {
		if (isVisible && triggerRef.current && tooltipRef.current) {
			const triggerRect = triggerRef.current.getBoundingClientRect()
			const tooltipRect = tooltipRef.current.getBoundingClientRect()

			let top = 0
			let left = 0
			const offset = 6

			switch (side) {
				case 'top':
					top = -tooltipRect.height - offset
					left = (triggerRect.width - tooltipRect.width) / 2
					break
				case 'bottom':
					top = triggerRect.height + offset
					left = (triggerRect.width - tooltipRect.width) / 2
					break
				case 'left':
					top = (triggerRect.height - tooltipRect.height) / 2
					left = -tooltipRect.width - offset
					break
				case 'right':
					top = (triggerRect.height - tooltipRect.height) / 2
					left = triggerRect.width + offset
					break
			}

			setPosition({ top, left })
		}
	}, [isVisible, side])

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [])

	if (disabled || !content) {
		return <>{children}</>
	}

	return (
		<div
			ref={triggerRef}
			className="relative inline-flex"
			onMouseEnter={showTooltip}
			onMouseLeave={hideTooltip}
			onFocus={handleFocus}
			onBlur={hideTooltip}
			// Acting on the trigger is the end of the tooltip's job: without this it survived the
			// click and sat over whatever the click opened.
			onPointerDown={hideTooltip}
		>
			{children}
			{isVisible && (
				<div
					ref={tooltipRef}
					role="tooltip"
					className={cn(
						'absolute z-99999 whitespace-nowrap rounded-md px-3 py-1.5 text-xs shadow-lg',
						'bg-black text-white border border-gray-700',
						'animate-in fade-in-0 zoom-in-95 duration-150',
						'pointer-events-none'
					)}
					style={{
						top: position.top,
						left: position.left,
					}}
				>
					{content}
				</div>
			)}
		</div>
	)
}

export { SimpleTooltip }
