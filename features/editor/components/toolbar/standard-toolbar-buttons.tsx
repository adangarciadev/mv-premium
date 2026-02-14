interface StandardToolbarButtonsProps {
	onInsertBold: () => void
	onInsertItalic: () => void
	onInsertLink: () => void
	onInsertQuote: () => void
	activeFormats?: string[]
}

/**
 * StandardToolbarButtons component - Basic text decoration controls.
 * Includes Bold, Italic, Link, and Quote.
 * Used primarily for the Private Message editor where these native buttons are missing.
 */
export function StandardToolbarButtons({
	onInsertBold,
	onInsertItalic,
	onInsertLink,
	onInsertQuote,
	activeFormats = [],
}: StandardToolbarButtonsProps) {
	return (
		<>
			{/* Bold Button */}
			<button
				type="button"
				className={`mvp-toolbar-btn${activeFormats.includes('bold') ? ' active' : ''}`}
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					onInsertBold()
				}}
				title="Negrita"
			>
				<i className="fa fa-bold" />
			</button>

			{/* Italic Button */}
			<button
				type="button"
				className={`mvp-toolbar-btn${activeFormats.includes('italic') ? ' active' : ''}`}
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					onInsertItalic()
				}}
				title="Cursiva"
			>
				<i className="fa fa-italic" />
			</button>

			{/* Link Button */}
			<button
				type="button"
				className="mvp-toolbar-btn"
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					onInsertLink()
				}}
				title="Insertar enlace"
			>
				<i className="fa fa-link" />
			</button>

			{/* Quote Button */}
			<button
				type="button"
				className="mvp-toolbar-btn"
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					onInsertQuote()
				}}
				title="Citar"
			>
				<i className="fa fa-quote-right" />
			</button>
		</>
	)
}
