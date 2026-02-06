/**
 * GameToolbarButton - Button to open game template dialog
 *
 * Opens the IGDB game template dialog to search and insert game BBCode.
 */

import Gamepad2 from 'lucide-react/dist/esm/icons/gamepad-2'

interface GameToolbarButtonProps {
	onClick: () => void
}

export function GameToolbarButton({ onClick }: GameToolbarButtonProps) {
	return (
		<button
			type="button"
			className="mvp-toolbar-btn"
			title="Videojuegos (IGDB)"
			onClick={e => {
				e.preventDefault()
				e.stopPropagation()
				onClick()
			}}
		>
			<Gamepad2 className="h-4 w-4" />
		</button>
	)
}
