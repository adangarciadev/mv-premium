/**
 * Mobile Sheet — shared bottom-sheet shell for Mobile Lite result sheets
 * (thread & post AI summaries). Owns the drag-to-dismiss gesture, header,
 * backdrop, Firefox-Android bleed strip and footer slot, all built with the
 * design-system tokens (DESIGN.md §2–§7). Callers provide the icon, title and
 * body; loading/error/copy/footer building blocks are exported alongside so
 * every summary sheet looks and behaves identically.
 */

import { useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Check from 'lucide-react/dist/esm/icons/check'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Loader from 'lucide-react/dist/esm/icons/loader'
import Settings from 'lucide-react/dist/esm/icons/settings'
import X from 'lucide-react/dist/esm/icons/x'
import { logger } from '@/lib/logger'
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './panel-tokens'

// =============================================================================
// LOADING STATE
// =============================================================================

export function LoadingState({ subtitle }: { subtitle?: string }) {
	return (
		<div role="status" className="flex flex-col items-center justify-center py-16 text-center">
			<Loader className="mb-4 h-8 w-8 animate-spin text-[#f0a020]" aria-hidden="true" />
			<p className="text-sm font-semibold text-[#eef1f6]">Generando resumen…</p>
			{subtitle && <p className="mt-1 text-xs text-[#8b95a3]">{subtitle}</p>}
		</div>
	)
}

// =============================================================================
// ERROR STATE
// =============================================================================

export function ErrorState({ message, onConfigure }: { message: string; onConfigure?: () => void }) {
	return (
		<div role="alert" className="flex flex-col items-center justify-center py-16 text-center">
			<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#242a36]">
				<AlertCircle className="h-5 w-5 text-[#e08a8a]" aria-hidden="true" />
			</div>
			<p className="text-sm font-semibold text-[#eef1f6]">No se pudo generar el resumen</p>
			<p className="mx-auto mt-1.5 max-w-[20rem] text-xs leading-relaxed text-[#8b95a3]">{message}</p>
			{onConfigure && (
				<button type="button" className={`${PRIMARY_BUTTON_CLASS} mt-5`} onClick={onConfigure}>
					<Settings className="h-4 w-4" aria-hidden="true" />
					Configurar IA
				</button>
			)}
		</div>
	)
}

// =============================================================================
// COPY BUTTON
// =============================================================================

/**
 * Copies the given text (Mediavida BBCode) to the clipboard, flashing a
 * confirmed state for ~2s. Clipboard writes need a user gesture (the click
 * provides it) and a secure context — both hold on Firefox Android.
 */
export function CopyButton({ bbcode }: { bbcode: string }) {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(bbcode)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 2000)
		} catch (error) {
			logger.error('[MobileLite] Summary: clipboard copy failed', error)
		}
	}

	return (
		<button
			type="button"
			aria-label="Copiar resumen en formato BBCode para Mediavida"
			className={PRIMARY_BUTTON_CLASS}
			onClick={handleCopy}
		>
			{copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
			{copied ? '¡Copiado!' : 'Copiar'}
		</button>
	)
}

// =============================================================================
// FOOTER
// =============================================================================

/** Copy (when BBCode is available) + Close, or just Close. */
export function SheetFooter({ bbcode, onClose }: { bbcode: string | null; onClose: () => void }) {
	return (
		<div className="shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
			{bbcode ? (
				<div className="grid grid-cols-2 gap-2">
					<CopyButton bbcode={bbcode} />
					<button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
						Cerrar
					</button>
				</div>
			) : (
				<button type="button" className={`w-full ${SECONDARY_BUTTON_CLASS}`} onClick={onClose}>
					Cerrar
				</button>
			)}
		</div>
	)
}

// =============================================================================
// SHEET SHELL
// =============================================================================

export interface MobileSheetProps {
	icon: ReactNode
	title: string
	ariaLabel: string
	onClose: () => void
	children: ReactNode
	footer?: ReactNode
}

export function MobileSheet({ icon, title, ariaLabel, onClose, children, footer }: MobileSheetProps) {
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
		const dismissThreshold = Math.max(140, sheetHeight * 0.25)
		const shouldClose = dragOffset > dismissThreshold
		dragStartYRef.current = null
		setIsDragging(false)

		if (shouldClose && sheetHeight > 0) {
			setDragOffset(sheetHeight)
			window.setTimeout(() => {
				setDragOffset(0)
				onClose()
			}, 220)
			return
		}

		setDragOffset(0)
	}

	return (
		<div className="fixed inset-0 z-[99999] flex items-end justify-center overscroll-none bg-black/60 animate-in fade-in-0 duration-200">
			{/* Backdrop tap to close */}
			<button
				type="button"
				className="absolute inset-0 h-full w-full cursor-default"
				aria-label="Cerrar resumen"
				onClick={onClose}
			/>

			{/* Firefox Android dynamic-toolbar gap fill */}
			<div aria-hidden="true" className="absolute inset-x-0 top-full mx-auto h-28 w-full max-w-[34rem] bg-[#14171d]" />

			<section
				ref={sheetRef}
				role="dialog"
				aria-modal="true"
				aria-label={ariaLabel}
				className="relative flex max-h-[80%] w-full max-w-[34rem] flex-col overflow-hidden rounded-t-[24px] bg-[#1c1f27] text-[#eef1f6] shadow-[0_-12px_48px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-8 duration-300 ease-out"
				style={{
					transform: `translateY(${dragOffset}px)`,
					transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)',
				}}
			>
				{/* Header with drag handle */}
				<header
					className="shrink-0 touch-none select-none pt-[max(4px,env(safe-area-inset-top))]"
					onTouchStart={handleSheetTouchStart}
					onTouchMove={handleSheetTouchMove}
					onTouchEnd={handleSheetTouchEnd}
				>
					<div className="flex justify-center pb-1 pt-2">
						<span className="h-1 w-10 rounded-full bg-[#3a4254]" aria-hidden="true" />
					</div>
					<div className="flex items-center justify-between gap-3 px-4 pb-2.5 pt-1">
						<div className="flex min-w-0 items-center gap-2.5">
							{icon}
							<h2 className="truncate text-base font-bold text-[#eef1f6]">{title}</h2>
						</div>
						<button
							type="button"
							className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2e3543] text-[#aab4c0] transition-colors active:bg-[#3a4254]"
							aria-label="Cerrar"
							onClick={onClose}
						>
							<X className="h-5 w-5" aria-hidden="true" />
						</button>
					</div>
				</header>

				{/* Body */}
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">{children}</div>

				{footer}
			</section>
		</div>
	)
}
