/**
 * MovieReviewToolbarButton - Opens the visual movie review composer.
 *
 * Writing a review is a different authorial act from inserting a template, so it gets its own
 * entry point instead of living as a text link two levels inside the template dialog.
 */

import Star from 'lucide-react/dist/esm/icons/star'

interface MovieReviewToolbarButtonProps {
	onClick: () => void
}

export function MovieReviewToolbarButton({ onClick }: MovieReviewToolbarButtonProps) {
	return (
		<button
			type="button"
			className="mvp-toolbar-btn"
			title="Crear crítica visual de una película"
			aria-label="Crear crítica visual"
			onClick={event => {
				event.preventDefault()
				event.stopPropagation()
				onClick()
			}}
		>
			<Star className="h-4 w-4" />
		</button>
	)
}
