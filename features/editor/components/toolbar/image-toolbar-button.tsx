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
			<i className="fa fa-upload" />
		</button>
	)
}
