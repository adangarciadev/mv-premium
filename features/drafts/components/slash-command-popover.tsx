/**
 * Slash Command Popover
 *
 * Floating autocomplete dropdown for template shortcuts.
 * Shows when user types /shortcut in the editor.
 */
import { useEffect, useRef, useCallback } from 'react'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Wand2 from 'lucide-react/dist/esm/icons/wand-2'
import { cn } from '@/lib/utils'
import type { SlashCommandState, TemplateMatch } from '../logic/slash-command-handler'
import { getTemplatePreview } from '../logic/slash-command-handler'

interface SlashCommandPopoverProps {
	/** Current slash command state */
	state: SlashCommandState
	/** Called when user selects a template */
	onSelect: (template: TemplateMatch) => void
	/** Called when popover should close */
	onClose: () => void
	/** Called when selected index changes */
	onSelectedIndexChange: (index: number) => void
	/** Reference to the textarea for positioning */
	textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

export function SlashCommandPopover({
	state,
	onSelect,
	onClose,
	onSelectedIndexChange,
	textareaRef,
}: SlashCommandPopoverProps) {
	const popoverRef = useRef<HTMLDivElement>(null)

	// Keep refs to latest values to avoid stale closures
	const stateRef = useRef(state)
	const onSelectRef = useRef(onSelect)
	const onCloseRef = useRef(onClose)
	const onSelectedIndexChangeRef = useRef(onSelectedIndexChange)

	// Update refs on every render
	useEffect(() => {
		stateRef.current = state
		onSelectRef.current = onSelect
		onCloseRef.current = onClose
		onSelectedIndexChangeRef.current = onSelectedIndexChange
	})

	// Handle keyboard navigation
	const handleKeyDown = useCallback((e: KeyboardEvent) => {
		const currentState = stateRef.current
		if (!currentState.isActive) return

		// Escape should always work, even with no matches
		if (e.key === 'Escape') {
			e.preventDefault()
			e.stopPropagation()
			onCloseRef.current()
			return
		}

		// Other keys require matches to be present
		if (currentState.matches.length === 0) return

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault()
				e.stopPropagation()
				onSelectedIndexChangeRef.current(
					currentState.selectedIndex < currentState.matches.length - 1 ? currentState.selectedIndex + 1 : 0
				)
				break

			case 'ArrowUp':
				e.preventDefault()
				e.stopPropagation()
				onSelectedIndexChangeRef.current(
					currentState.selectedIndex > 0 ? currentState.selectedIndex - 1 : currentState.matches.length - 1
				)
				break

			case 'Enter':
			case 'Tab':
				e.preventDefault()
				e.stopPropagation()
				onSelectRef.current(currentState.matches[currentState.selectedIndex])
				break
		}
	}, []) // No dependencies - uses refs

	// Attach keyboard listener to textarea
	useEffect(() => {
		const textarea = textareaRef.current
		if (!textarea) return

		textarea.addEventListener('keydown', handleKeyDown, { capture: true })
		return () => textarea.removeEventListener('keydown', handleKeyDown, { capture: true })
	}, [textareaRef, handleKeyDown])

	// Position popover near cursor in textarea using fixed positioning
	const getPopoverStyle = (): React.CSSProperties => {
		const textarea = textareaRef.current
		if (!textarea) return { display: 'none' }

		// Get textarea position on screen
		const rect = textarea.getBoundingClientRect()
		const scrollTop = textarea.scrollTop

		// Calculate cursor line position
		const textBeforeCursor = textarea.value.substring(0, state.startIndex)
		const lines = textBeforeCursor.split('\n')
		const currentLine = lines.length - 1
		const computedStyle = getComputedStyle(textarea)
		const lineHeight = parseInt(computedStyle.lineHeight) || 20
		const paddingTop = parseInt(computedStyle.paddingTop) || 0
		const paddingLeft = parseInt(computedStyle.paddingLeft) || 0

		// Calculate position relative to viewport (fixed positioning)
		const cursorTop = currentLine * lineHeight - scrollTop + lineHeight
		let top = rect.top + paddingTop + cursorTop + 4
		const left = rect.left + paddingLeft

		// Ensure popover doesn't go off-screen
		const popoverHeight = 250 // Approximate max height
		const viewportHeight = window.innerHeight

		// If popover would go below viewport, show it above the cursor
		if (top + popoverHeight > viewportHeight) {
			top = rect.top + paddingTop + (currentLine * lineHeight - scrollTop) - popoverHeight - 4
		}

		return {
			position: 'fixed',
			top: Math.max(8, top),
			left: Math.max(8, left),
			zIndex: 99999,
		}
	}

	// Don't render if no matches
	if (!state.isActive || state.matches.length === 0) {
		return null
	}

	// Global escape listener (works even when textarea is not focused)
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault()
				e.stopPropagation()
				onCloseRef.current()
			}
		}

		document.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
		return () => document.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
	}, [])

	return (
		<>
			{/* Backdrop - click to close */}
			<div className="fixed inset-0 z-[99998]" onClick={onClose} onMouseDown={e => e.preventDefault()} />

			{/* Popover */}
			<div
				ref={popoverRef}
				style={getPopoverStyle()}
				className="w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100"
			>
				{/* Header */}
				<div className="px-3 py-2 border-b border-border bg-muted/30">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Wand2 className="h-3 w-3" />
						<span>Plantillas</span>
						{state.query && <span className="text-foreground font-mono">/{state.query}</span>}
					</div>
				</div>

				{/* Results */}
				<div className="max-h-48 overflow-y-auto">
					{state.matches.map((match, index) => (
						<button
							key={match.id}
							type="button"
							onMouseDown={e => e.preventDefault()}
							onClick={() => onSelect(match)}
							onMouseEnter={() => onSelectedIndexChange(index)}
							className={cn(
								'w-full px-3 py-2 text-left transition-colors cursor-pointer',
								'flex items-start gap-3',
								index === state.selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
							)}
						>
							<FileText className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="font-medium truncate text-sm">{match.title}</span>
									<span className="text-[10px] font-mono text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded shrink-0">
										/{match.trigger}
									</span>
								</div>
								<p className="text-xs text-muted-foreground truncate mt-0.5">{getTemplatePreview(match.content)}</p>
							</div>
						</button>
					))}
				</div>

				{/* Footer hint */}
				<div className="px-3 py-1.5 border-t border-border bg-muted/30">
					<div className="flex items-center justify-between text-[10px] text-muted-foreground">
						<span>↑↓ navegar</span>
						<span>↵ Tab insertar</span>
						<span>Esc cerrar</span>
					</div>
				</div>
			</div>
		</>
	)
}
