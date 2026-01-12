/**
 * CineToolbarButton - Simple button to open movie and TV series template dialog
 *
 * Opens the movie and TV series template dialog to search and insert movie and TV series BBCode.
 */

import Clapperboard from 'lucide-react/dist/esm/icons/clapperboard'

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
			<Clapperboard className="h-4 w-4" />
		</button>
	)
}
