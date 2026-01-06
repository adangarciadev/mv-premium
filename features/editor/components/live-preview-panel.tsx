import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MVPreview } from '@/components/preview-system'
import { useUIStore } from '@/store'
import { DEBOUNCE } from '@/constants'
import X from 'lucide-react/dist/esm/icons/x'
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical'

interface LivePreviewPanelProps {
	textarea: HTMLTextAreaElement
	onClose?: () => void
}

/**
 * LivePreviewPanel component - A draggable floating window that renders a real-time
 * preview of the current textarea content using the MVPreview parser.
 * Designed to mirror Mediavida's native post styling accurately.
 */
export function LivePreviewPanel({ textarea, onClose }: LivePreviewPanelProps) {
	const { livePreview, setLivePreviewPosition, setLivePreviewDragging } = useUIStore()

	// Store raw content, MVPreview handles parsing
	const [content, setContent] = useState('')
	const panelRef = useRef<HTMLDivElement>(null)
	const lastValueRef = useRef<string>('')
	const debounceRef = useRef<NodeJS.Timeout | null>(null)
	const dragOffset = useRef({ x: 0, y: 0 })

	// Smart debounced update to minimize parsing overhead
	useEffect(() => {
		const updatePreview = () => {
			const newValue = textarea.value
			if (newValue !== lastValueRef.current) {
				lastValueRef.current = newValue
				setContent(newValue)
			}
		}

		const handleInput = () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
			}
			debounceRef.current = setTimeout(updatePreview, DEBOUNCE.PREVIEW)
		}

		const handleBlur = () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
			}
			updatePreview()
		}

		lastValueRef.current = textarea.value
		setContent(textarea.value)

		textarea.addEventListener('input', handleInput)
		textarea.addEventListener('blur', handleBlur)

		return () => {
			textarea.removeEventListener('input', handleInput)
			textarea.removeEventListener('blur', handleBlur)
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
			}
		}
	}, [textarea])

	// Drag handler - only on header
	const handleMouseDown = (e: React.MouseEvent) => {
		if ((e.target as HTMLElement).closest('.mv-live-preview__close')) return

		setLivePreviewDragging(true)
		const rect = panelRef.current?.getBoundingClientRect()
		if (rect) {
			dragOffset.current = {
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
			}
		}
		e.preventDefault()
	}

	useEffect(() => {
		if (!livePreview.isDragging) return

		const handleMouseMove = (e: MouseEvent) => {
			// Use fallback dimensions if ref not available
			const panelWidth = panelRef.current?.offsetWidth || 940
			const panelHeight = panelRef.current?.offsetHeight || 400

			// Calculate new position (no bounds yet)
			let newX = e.clientX - dragOffset.current.x
			let newY = e.clientY - dragOffset.current.y

			// Relaxed constraints: Allow moving partially offscreen
			// Keep at least 100px of width visible horizontally
			// Keep header visible vertically (min 0, max window height - 40)

			const windowWidth = window.innerWidth
			const windowHeight = window.innerHeight

			// Constrain X: Allow sticking out left/right, but keep 100px visible
			newX = Math.max(100 - panelWidth, Math.min(newX, windowWidth - 100))

			// Constrain Y: Header must be visible (assuming header ~40px)
			// Can't go below 0 (top of screen)
			// Can go down until only header is visible
			newY = Math.max(0, Math.min(newY, windowHeight - 40))

			setLivePreviewPosition({ x: newX, y: newY })
		}

		const handleMouseUp = () => {
			setLivePreviewDragging(false)
		}

		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseup', handleMouseUp)

		return () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
		}
	}, [livePreview.isDragging, setLivePreviewPosition, setLivePreviewDragging])

	// Render as portal directly to body (no Shadow DOM)
	// Width matches Mediavida's native preview modal exactly
	// Native MV content area: 652px, padding 20px each side = 692px total
	return createPortal(
		<>
			<div
				ref={panelRef}
				className={`mv-live-preview ${livePreview.isDragging ? 'mv-live-preview--dragging' : ''}`}
				style={{
					position: 'fixed',
					left: `${livePreview.position.x}px`,
					top: `${livePreview.position.y}px`,
					width: '720px',
					maxWidth: 'calc(100vw - 40px)',
					maxHeight: '85vh',
					background: '#1a1a1b',
					border: '1px solid #343536',
					borderRadius: 'var(--radius, 8px)',
					boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
					zIndex: 2147483647,
					overflow: 'hidden',
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				{/* Draggable Header Bar */}
				<div
					className="mv-live-preview__header"
					onMouseDown={handleMouseDown}
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '8px 12px',
						background: '#252526',
						borderBottom: '1px solid #343536',
						cursor: livePreview.isDragging ? 'grabbing' : 'grab',
						userSelect: 'none',
						flexShrink: 0,
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<GripVertical size={14} style={{ color: '#666' }} />
						<span style={{ fontSize: '12px', color: '#aaa', fontWeight: 500 }}>Vista previa</span>
					</div>
					{onClose && (
						<button
							className="mv-live-preview__close"
							onClick={onClose}
							title="Cerrar"
							style={{
								background: 'transparent',
								border: 'none',
								padding: '4px',
								cursor: 'pointer',
								color: '#888',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								borderRadius: 'var(--radius, 4px)',
							}}
						>
							<X size={14} />
						</button>
					)}
				</div>

				{/* Content Area - Medidas exactas del modal MV:
                    - div.popup.post: 720px, padding 12px 24px
                    - div.post-contents: padding 10px 10px 60px
                    - p final: 652px */}
				<div
					style={{
						flex: 1,
						minHeight: 0,
						overflowY: 'auto',
						scrollbarWidth: 'thin',
						scrollbarColor: '#444 transparent',
						padding: '10px 17px',
					}}
					className="mv-live-preview__scroll"
				>
					<MVPreview content={content} className="mv-live-preview__content" fontSize={15} />
				</div>
			</div>
		</>,
		document.body
	)
}
