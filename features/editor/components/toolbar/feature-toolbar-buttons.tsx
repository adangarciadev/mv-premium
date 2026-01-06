import { Button } from '@/components/ui/button'
import Clapperboard from 'lucide-react/dist/esm/icons/clapperboard'
import Eye from 'lucide-react/dist/esm/icons/eye'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Table from 'lucide-react/dist/esm/icons/table'
import ChartBar from 'lucide-react/dist/esm/icons/chart-bar'

interface FeatureToolbarButtonsProps {
	isNewCineThread: boolean
	isNewThread: boolean
	livePreviewVisible: boolean
	isTableAtCursor?: boolean
	cinemaButtonEnabled?: boolean
	onOpenTableDialog: () => void
	onOpenMovieDialog: () => void
	onOpenPollDialog: () => void
	onToggleLivePreview: () => void
	onOpenDrafts: () => void
}

/**
 * FeatureToolbarButtons component - Grouping for non-standard editor features.
 * Includes drafts, table editor, polls, movie templates, and live preview toggles.
 */
export function FeatureToolbarButtons({
	isNewCineThread,
	isNewThread,
	livePreviewVisible,
	isTableAtCursor = false,
	cinemaButtonEnabled = true,
	onOpenTableDialog,
	onOpenMovieDialog,
	onOpenPollDialog,
	onToggleLivePreview,
	onOpenDrafts,
}: FeatureToolbarButtonsProps) {
	return (
		<>
			{/* Drafts Button */}
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					onOpenDrafts()
				}}
				className="text-muted-foreground hover:text-foreground"
				title="Mis Borradores"
			>
				<i className="fa fa-folder-open-o text-base"></i>
			</Button>

			{/* Table Editor Button */}
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					onOpenTableDialog()
				}}
				className="text-muted-foreground hover:text-foreground"
				style={
					isTableAtCursor
						? {
								backgroundColor: 'rgba(99, 102, 241, 0.2)',
								color: '#818cf8',
						  }
						: undefined
				}
				title={isTableAtCursor ? 'Editar tabla' : 'Insertar tabla'}
			>
				<Table className="w-4 h-4" />
			</Button>

			{/* Poll Creator Button - only on new threads */}
			{isNewThread && (
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={e => {
						e.preventDefault()
						e.stopPropagation()
						onOpenPollDialog()
					}}
					className="text-muted-foreground hover:text-foreground"
					title="Crear encuesta"
				>
					<ChartBar className="w-4 h-4" />
				</Button>
			)}

			{/* Movie Template Button - only on new cine threads AND if enabled */}
			{isNewCineThread && cinemaButtonEnabled && (
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={e => {
						e.preventDefault()
						e.stopPropagation()
						onOpenMovieDialog()
					}}
					className="text-muted-foreground hover:text-foreground"
					title="Plantilla de película"
				>
					<Clapperboard className="w-4 h-4" />
				</Button>
			)}

			{/* Preview Toggle Button */}
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={e => {
					e.preventDefault()
					e.stopPropagation()
					onToggleLivePreview()
				}}
				className={`text-muted-foreground hover:text-foreground ${
					livePreviewVisible ? 'bg-indigo-500/20 text-indigo-400' : ''
				}`}
				title="Live preview"
			>
				{livePreviewVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
			</Button>
		</>
	)
}
