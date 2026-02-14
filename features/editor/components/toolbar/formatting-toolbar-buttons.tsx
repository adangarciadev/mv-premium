interface FormattingToolbarButtonsProps {
	onInsertUnderline: () => void
	onInsertStrikethrough: () => void
	onInsertCenter: () => void
	onInsertSpoiler: () => void
	onInsertNsfw?: () => void
	activeFormats?: string[]
	showNsfw?: boolean
	showSpoiler?: boolean
}

/**
 * FormattingToolbarButtons component - Basic text decoration controls.
 * Includes Underline, Strikethrough, Center, and optionally NSFW.
 */
export function FormattingToolbarButtons({
	onInsertUnderline,
	onInsertStrikethrough,
	onInsertCenter,
	onInsertSpoiler,
	onInsertNsfw,
	activeFormats = [],
	showNsfw = true,
	showSpoiler = false,
}: FormattingToolbarButtonsProps) {
	return (
		<>
			{/* Underline Button */}
			<button
				type="button"
				className={`mvp-toolbar-btn${activeFormats.includes('underline') ? ' active' : ''}`}
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					onInsertUnderline()
				}}
				title="Subrayado"
			>
				<i className="fa fa-underline" />
			</button>

			{/* Strikethrough Button */}
			<button
				type="button"
				className={`mvp-toolbar-btn${activeFormats.includes('strikethrough') ? ' active' : ''}`}
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					onInsertStrikethrough()
				}}
				title="Tachado"
			>
				<i className="fa fa-strikethrough" />
			</button>

			{/* Center Button */}
			<button
				type="button"
				className={`mvp-toolbar-btn${activeFormats.includes('center') ? ' active' : ''}`}
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					onInsertCenter()
				}}
				title="Centrar"
			>
				<i className="fa fa-align-center" />
			</button>

			{/* Spoiler Button */}
			{showSpoiler && (
				<button
					type="button"
					className={`mvp-toolbar-btn${activeFormats.includes('spoiler') ? ' active' : ''}`}
					onClick={e => {
						e.preventDefault()
						e.stopPropagation()
						onInsertSpoiler()
					}}
					title="Spoiler"
				>
					<i className="fa fa-eye-slash" />
				</button>
			)}

			{/* NSFW Button - Only shown if showNsfw is true */}
			{showNsfw && onInsertNsfw && (
				<button
					type="button"
					className={`mvp-toolbar-btn${activeFormats.includes('nsfw') ? ' active' : ''}`}
					onClick={e => {
						e.preventDefault()
						e.stopPropagation()
						onInsertNsfw()
					}}
					title="Contenido sensible (NSFW)"
				>
					<i className="fa fa-warning" />
				</button>
			)}
		</>
	)
}
