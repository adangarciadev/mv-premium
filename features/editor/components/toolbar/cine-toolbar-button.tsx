/**
 * CineToolbarButton - Opens the movie and TV template dialog.
 */

import Clapperboard from 'lucide-react/dist/esm/icons/clapperboard'

interface CineToolbarButtonProps {
	onFullSheet: () => void
}

export function CineToolbarButton({ onFullSheet }: CineToolbarButtonProps) {
	return (
		<button type="button" className="mvp-toolbar-btn" title="Plantillas multimedia (TMDB/AniList)" aria-label="Plantillas multimedia" onClick={event => { event.preventDefault(); event.stopPropagation(); onFullSheet() }}>
			<Clapperboard className="h-4 w-4" />
		</button>
	)
}
