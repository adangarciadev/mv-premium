import { useRef, useState, useCallback, useEffect } from 'react'
import Upload from 'lucide-react/dist/esm/icons/upload'
import X from 'lucide-react/dist/esm/icons/x'
import Image from 'lucide-react/dist/esm/icons/image'
import FileImage from 'lucide-react/dist/esm/icons/file-image'
import Check from 'lucide-react/dist/esm/icons/check'
import { validateImageFile, formatBytes, getApiKey } from '@/services/api/imgbb'

interface ImageDropzoneProps {
	isOpen: boolean
	onClose: () => void
	onFilesSelect: (files: File[]) => void
	isUploading: boolean
	uploadProgress: number
}

interface SelectedFile {
	file: File
	name: string
	size: string
}

/**
 * ImageDropzone component - An interactive container for drag-and-drop or file-picker image selection.
 * Orchestrates file validation and multi-file selection state before initiation of the upload process.
 */
export function ImageDropzone({ isOpen, onClose, onFilesSelect, isUploading, uploadProgress }: ImageDropzoneProps) {
	const [isDragging, setIsDragging] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
	const [hasImgbbKey, setHasImgbbKey] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const dropzoneRef = useRef<HTMLDivElement>(null)

	// Reset state when closed
	useEffect(() => {
		if (!isOpen) {
			setSelectedFiles([])
			setError(null)
			setIsDragging(false)
		}
	}, [isOpen])

	// Check if ImgBB key is configured
	useEffect(() => {
		if (isOpen) {
			getApiKey().then(key => setHasImgbbKey(!!key))
		}
	}, [isOpen])

	// Handle click outside to close
	useEffect(() => {
		// Do not close if uploading
		if (!isOpen || isUploading) return

		const handleClickOutside = (e: MouseEvent) => {
			if (dropzoneRef.current && !dropzoneRef.current.contains(e.target as Node)) {
				onClose()
			}
		}

		// Delay adding listener to avoid immediate close
		const timer = setTimeout(() => {
			document.addEventListener('mousedown', handleClickOutside)
		}, 100)

		return () => {
			clearTimeout(timer)
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isOpen, onClose, isUploading])

	// Handle escape key
	useEffect(() => {
		if (!isOpen || isUploading) return

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose()
			}
		}

		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [isOpen, onClose, isUploading])

	const handleDragEnter = useCallback(
		(e: React.DragEvent) => {
			if (isUploading) return
			e.preventDefault()
			e.stopPropagation()
			setIsDragging(true)
		},
		[isUploading]
	)

	const handleDragLeave = useCallback(
		(e: React.DragEvent) => {
			if (isUploading) return
			e.preventDefault()
			e.stopPropagation()
			const rect = dropzoneRef.current?.getBoundingClientRect()
			if (rect) {
				const { clientX, clientY } = e
				if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
					setIsDragging(false)
				}
			}
		},
		[isUploading]
	)

	const handleDragOver = useCallback(
		(e: React.DragEvent) => {
			if (isUploading) return
			e.preventDefault()
			e.stopPropagation()
		},
		[isUploading]
	)

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			if (isUploading) return
			e.preventDefault()
			e.stopPropagation()
			setIsDragging(false)
			setError(null)

			const files = e.dataTransfer?.files
			if (files && files.length > 0) {
				processFiles(Array.from(files))
			}
		},
		[isUploading]
	)

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files
		if (files && files.length > 0) {
			processFiles(Array.from(files))
		}
		// Reset input
		e.target.value = ''
	}

	/**
	 * Filters and validates a batch of files, accumulating valid ones and recording errors.
	 * @param files - Raw File list from event
	 */
	const processFiles = (files: File[]) => {
		const validFiles: SelectedFile[] = []
		const errors: string[] = []

		for (const file of files) {
			const validation = validateImageFile(file)
			if (validation.valid) {
				validFiles.push({
					file,
					name: file.name,
					size: formatBytes(file.size),
				})
			} else {
				errors.push(`${file.name}: ${validation.error}`)
			}
		}

		if (errors.length > 0) {
			setError(errors.join('\n'))
		} else {
			setError(null)
		}

		if (validFiles.length > 0) {
			setSelectedFiles(prev => [...prev, ...validFiles])
		}
	}

	const handleUpload = () => {
		if (selectedFiles.length > 0) {
			onFilesSelect(selectedFiles.map(f => f.file))
		}
	}

	const handleClick = () => {
		if (selectedFiles.length === 0 && !isUploading) {
			fileInputRef.current?.click()
		}
	}

	const handleRemoveFile = (index: number) => {
		if (isUploading) return
		setSelectedFiles(prev => prev.filter((_, i) => i !== index))
		setError(null)
	}

	const handleAddMore = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (isUploading) return
		fileInputRef.current?.click()
	}

	if (!isOpen) return null

	return (
		<div
			ref={dropzoneRef}
			onClick={handleClick}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
			style={{
				position: 'relative',
				padding: selectedFiles.length > 0 ? '16px' : '24px 20px',
				border: `2px dashed ${isDragging ? '#8b5cf6' : selectedFiles.length > 0 ? '#22c55e' : '#4b5563'}`,
				borderRadius: 'var(--radius, 12px)',
				backgroundColor: isDragging
					? 'rgba(139, 92, 246, 0.1)'
					: selectedFiles.length > 0
					? 'rgba(34, 197, 94, 0.05)'
					: '#1f2937',
				cursor: isUploading ? 'not-allowed' : selectedFiles.length > 0 ? 'default' : 'pointer',
				transition: 'all 0.2s ease',
				textAlign: 'center',
				opacity: 1, // Always fully visible
			}}
		>
			{/* Hidden file input - multiple */}
			<input
				ref={fileInputRef}
				type="file"
				accept="image/jpeg,image/png,image/gif"
				multiple
				style={{ display: 'none' }}
				onChange={handleFileInputChange}
				disabled={isUploading}
			/>

			{/* Close button - only show when no files selected */}
			{selectedFiles.length === 0 && !isUploading && (
				<button
					type="button"
					onClick={e => {
						e.stopPropagation()
						onClose()
					}}
					style={{
						position: 'absolute',
						top: '8px',
						right: '8px',
						padding: '4px',
						background: 'transparent',
						border: 'none',
						borderRadius: 'var(--radius, 4px)',
						cursor: 'pointer',
						color: '#9ca3af',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
					onMouseEnter={e => {
						e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
						e.currentTarget.style.color = '#fff'
					}}
					onMouseLeave={e => {
						e.currentTarget.style.backgroundColor = 'transparent'
						e.currentTarget.style.color = '#9ca3af'
					}}
				>
					<X size={16} />
				</button>
			)}

			{/* Content */}
			{isUploading ? (
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						padding: '20px 0',
						gap: '8px',
					}}
				>
					<div
						style={{
							fontSize: '48px',
							fontWeight: 700,
							color: '#8b5cf6',
							fontFamily: 'monospace',
							marginBottom: '4px',
						}}
					>
						{uploadProgress}%
					</div>
					<div style={{ color: '#d1d5db', fontSize: '14px', fontWeight: 500 }}>Subiendo imágenes...</div>
					<div style={{ color: '#9ca3af', fontSize: '12px' }}>Por favor espera un momento</div>
				</div>
			) : selectedFiles.length > 0 ? (
				// Files selected view
				<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
					{/* File list */}
					<div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
						{selectedFiles.map((file, index) => (
							<div
								key={index}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '10px',
									padding: '8px 10px',
									backgroundColor: 'rgba(34, 197, 94, 0.1)',
									borderRadius: 'var(--radius, 6px)',
									border: '1px solid rgba(34, 197, 94, 0.2)',
								}}
							>
								<FileImage size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
								<div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
									<div
										style={{
											color: '#e5e7eb',
											fontSize: '12px',
											fontWeight: 500,
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
										}}
									>
										{file.name}
									</div>
									<div style={{ color: '#9ca3af', fontSize: '10px' }}>{file.size}</div>
								</div>
								<button
									type="button"
									onClick={e => {
										e.stopPropagation()
										handleRemoveFile(index)
									}}
									style={{
										padding: '2px',
										background: 'transparent',
										border: 'none',
										borderRadius: 'var(--radius, 4px)',
										cursor: 'pointer',
										color: '#9ca3af',
										display: 'flex',
										flexShrink: 0,
									}}
									onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
									onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
								>
									<X size={14} />
								</button>
							</div>
						))}
					</div>

					{/* Actions */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						<div style={{ display: 'flex', gap: '8px' }}>
							<button
								type="button"
								onClick={handleAddMore}
								style={{
									flex: 1,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: '6px',
									padding: '8px 12px',
									backgroundColor: 'transparent',
									border: '1px solid #4b5563',
									borderRadius: 'var(--radius, 6px)',
									color: '#9ca3af',
									fontSize: '12px',
									cursor: 'pointer',
									transition: 'all 0.2s',
								}}
								onMouseEnter={e => {
									e.currentTarget.style.borderColor = '#6b7280'
									e.currentTarget.style.color = '#d1d5db'
								}}
								onMouseLeave={e => {
									e.currentTarget.style.borderColor = '#4b5563'
									e.currentTarget.style.color = '#9ca3af'
								}}
							>
								+ Añadir más
							</button>
							<button
								type="button"
								onClick={() => setSelectedFiles([])}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: '4px',
									padding: '8px 12px',
									backgroundColor: 'transparent',
									border: '1px solid rgba(239, 68, 68, 0.4)',
									borderRadius: 'var(--radius, 6px)',
									color: '#f87171',
									fontSize: '12px',
									cursor: 'pointer',
									transition: 'all 0.2s',
								}}
								onMouseEnter={e => {
									e.currentTarget.style.borderColor = '#ef4444'
									e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
								}}
								onMouseLeave={e => {
									e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'
									e.currentTarget.style.backgroundColor = 'transparent'
								}}
							>
								<X size={14} />
								Limpiar
							</button>
						</div>
						<button
							type="button"
							onClick={handleUpload}
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: '6px',
								padding: '10px 12px',
								backgroundColor: '#22c55e',
								border: 'none',
								borderRadius: '6px',
								color: '#fff',
								fontSize: '13px',
								fontWeight: 500,
								cursor: 'pointer',
								transition: 'background-color 0.2s',
							}}
							onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#16a34a')}
							onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#22c55e')}
						>
							<Check size={14} />
							Subir {selectedFiles.length} imagen{selectedFiles.length > 1 ? 'es' : ''}
						</button>
					</div>
				</div>
			) : (
				// Initial dropzone view
				<>
					{/* Icon */}
					<div
						style={{
							width: '48px',
							height: '48px',
							margin: '0 auto 12px',
							borderRadius: '50%',
							backgroundColor: isDragging ? 'rgba(139, 92, 246, 0.2)' : 'rgba(75, 85, 99, 0.3)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							transition: 'all 0.2s ease',
						}}
					>
						{isDragging ? (
							<Image size={24} style={{ color: '#8b5cf6' }} />
						) : (
							<Upload size={24} style={{ color: '#9ca3af' }} />
						)}
					</div>

					{/* Text */}
					<div style={{ color: '#e5e7eb', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
						{isDragging ? 'Suelta las imágenes aquí' : 'Arrastra y suelta'}
					</div>
					<div style={{ color: '#9ca3af', fontSize: '12px' }}>
						o <span style={{ color: '#60a5fa', textDecoration: 'underline' }}>elige uno o varios archivos</span>
					</div>

					{/* Supported formats */}
					<div style={{ marginTop: '12px', display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
						{['JPG', 'PNG', 'GIF'].map(format => (
							<span
								key={format}
								style={{
									padding: '2px 8px',
									fontSize: '10px',
									fontWeight: 500,
									color: '#9ca3af',
									backgroundColor: 'rgba(75, 85, 99, 0.4)',
									borderRadius: 'var(--radius, 4px)',
								}}
							>
								{format}
							</span>
						))}
					</div>

					{/* Limit info */}
					<div
						style={{
							marginTop: '10px',
							padding: '6px 10px',
							backgroundColor: 'rgba(75, 85, 99, 0.2)',
							borderRadius: '6px',
							fontSize: '10px',
							color: '#9ca3af',
							lineHeight: 1.4,
						}}
					>
						<span style={{ color: '#6b7280' }}>Máx. {hasImgbbKey ? '32MB' : '200MB'}</span> · Evita imágenes muy pesadas
						para no saturar la web
					</div>

					{/* Error */}
					{error && (
						<div
							style={{
								marginTop: '12px',
								padding: '8px 12px',
								backgroundColor: 'rgba(239, 68, 68, 0.15)',
								borderRadius: '6px',
								color: '#f87171',
								fontSize: '12px',
								whiteSpace: 'pre-line',
							}}
						>
							{error}
						</div>
					)}
				</>
			)}
		</div>
	)
}
