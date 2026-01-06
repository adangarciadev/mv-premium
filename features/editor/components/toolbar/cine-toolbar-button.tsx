/**
 * CineToolbarButton - Simple button to open movie and TV series template dialog
 *
 * Opens the movie and TV series template dialog to search and insert movie and TV series BBCode.
 */

interface CineToolbarButtonProps {
	onFullSheet: () => void
}

export function CineToolbarButton({ onFullSheet }: CineToolbarButtonProps) {
	return (
		<button
			type="button"
			className="mvp-toolbar-btn"
			title="Películas y series (TMDB)"
			onClick={e => {
				e.preventDefault()
				e.stopPropagation()
				onFullSheet()
			}}
		>
			<i className="fa fa-film" />
		</button>
	)
}
