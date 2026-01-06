/**
 * History Toolbar Buttons - Undo/Redo functionality
 * Uses native buttons with FontAwesome icons for MV integration
 */

interface HistoryToolbarButtonsProps {
	onUndo: () => void
	onRedo: () => void
	canUndo: boolean
	canRedo: boolean
}

/**
 * HistoryToolbarButtons component - Provides undo/redo controls.
 * Integrates with the custom text history hook for reliable state recovery.
 */
export function HistoryToolbarButtons({ onUndo, onRedo, canUndo, canRedo }: HistoryToolbarButtonsProps) {
	return (
		<>
			<button
				type="button"
				className="mvp-toolbar-btn"
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					onUndo()
				}}
				disabled={!canUndo}
				title="Deshacer (Ctrl+Z)"
				style={{ opacity: canUndo ? 1 : 0.4 }}
			>
				<i className="fa fa-undo" />
			</button>
			<button
				type="button"
				className="mvp-toolbar-btn"
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					onRedo()
				}}
				disabled={!canRedo}
				title="Rehacer (Ctrl+Y)"
				style={{ opacity: canRedo ? 1 : 0.4 }}
			>
				<i className="fa fa-repeat" />
			</button>
		</>
	)
}
