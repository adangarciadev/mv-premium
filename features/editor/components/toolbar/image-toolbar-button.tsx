import ImagePlus from 'lucide-react/dist/esm/icons/image-plus'

interface ImageToolbarButtonProps {
	isUploading: boolean
	onTriggerUpload: () => void
}

export function ImageToolbarButton({ isUploading, onTriggerUpload }: ImageToolbarButtonProps) {
	return (
		<button
			type="button"
			className="mvp-toolbar-btn"
			onClick={e => {
				e.preventDefault()
				e.stopPropagation()
				onTriggerUpload()
			}}
			disabled={isUploading}
			title="Subir imagen desde PC"
		>
			<ImagePlus className="h-4 w-4" />
		</button>
	)
}
