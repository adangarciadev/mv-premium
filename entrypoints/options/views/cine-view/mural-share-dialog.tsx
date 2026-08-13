import { useEffect, useMemo, useRef, useState } from 'react'
import Check from 'lucide-react/dist/esm/icons/check'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Download from 'lucide-react/dist/esm/icons/download'
import Images from 'lucide-react/dist/esm/icons/images'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Upload from 'lucide-react/dist/esm/icons/upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MediaDialogShell } from '@/components/media-search-dialog/media-dialog-shell'
import { getCurrentUser } from '@/entrypoints/options/lib/current-user'
import { getApiKey, uploadImage } from '@/services/api/imgbb'
import { getAvailableYears } from '@/features/cine/logic/movie-review-list'
import { MURAL_MAX_POSTERS, selectMuralReviews } from '@/features/cine/logic/movie-mural-layout'
import { createMovieMuralImage, renderMovieMural, type MuralData } from '@/features/cine/logic/movie-mural-image'
import type { MovieReviewRecord } from '@/features/cine/logic/movie-review-store'

interface MuralShareDialogProps {
	isOpen: boolean
	onClose: () => void
	/** Published reviews only; the wall is a record of what you said in public. */
	records: MovieReviewRecord[]
}

const LIMIT_OPTIONS = [
	{ value: 'all', label: 'Todas' },
	{ value: '5', label: 'Las 5 mejores' },
	{ value: '10', label: 'Las 10 mejores' },
	{ value: '20', label: 'Las 20 mejores' },
]

function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = fileName
	anchor.click()
	URL.revokeObjectURL(url)
}

export function MuralShareDialog({ isOpen, onClose, records }: MuralShareDialogProps) {
	const [year, setYear] = useState('all')
	const [limit, setLimit] = useState('all')
	const [title, setTitle] = useState('')
	const [username, setUsername] = useState('')
	const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)
	const [uploadHost, setUploadHost] = useState('freeimage.host')
	const [isUploading, setIsUploading] = useState(false)
	const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isPreviewEmpty, setIsPreviewEmpty] = useState(true)

	/** A live canvas, so changing the selection never encodes a PNG. */
	const canvasRef = useRef<HTMLCanvasElement | null>(null)

	const years = useMemo(() => getAvailableYears(records), [records])

	const selected = useMemo(
		() => selectMuralReviews(records, { year, limit: limit === 'all' ? null : Number(limit) }),
		[records, year, limit]
	)

	/** What the year filter alone would have shown, so the footer can name what did not fit. */
	const availableForYear = useMemo(
		() => (year === 'all' ? records.length : records.filter(record => record.year === year).length),
		[records, year]
	)
	const omittedCount = Math.max(0, availableForYear - selected.length)

	const defaultTitle = year === 'all' ? 'Mis películas' : `Mis películas de ${year}`

	useEffect(() => {
		if (!isOpen) return

		void getCurrentUser().then(user => {
			setUsername(user?.username || 'Usuario')
			setAvatarUrl(user?.avatarUrl)
		})
		void getApiKey().then(key => setUploadHost(key ? 'ImgBB' : 'freeimage.host'))
	}, [isOpen])

	useEffect(() => {
		if (!isOpen) {
			setUploadedUrl(null)
			setCopied(false)
			setError(null)
			setIsPreviewEmpty(true)
			setTitle('')
		}
	}, [isOpen])

	const muralData: MuralData = useMemo(
		() => ({
			records: selected,
			title: title.trim() || defaultTitle,
			username,
			avatarUrl,
			omittedCount,
		}),
		[selected, title, defaultTitle, username, avatarUrl, omittedCount]
	)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!isOpen || !canvas || selected.length === 0) return

		let cancelled = false
		setError(null)

		void renderMovieMural(canvas, muralData)
			.then(() => {
				if (!cancelled) setIsPreviewEmpty(false)
			})
			.catch(cause => {
				if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo dibujar el mural')
			})

		return () => {
			cancelled = true
		}
	}, [isOpen, muralData, selected.length])

	const handleUpload = async () => {
		setIsUploading(true)
		setError(null)

		try {
			const blob = await createMovieMuralImage(muralData)
			const result = await uploadImage(blob)
			if (!result.success || !result.url) throw new Error(result.error || 'No se pudo subir el mural')

			setUploadedUrl(result.url)
			await navigator.clipboard.writeText(`[img]${result.url}[/img]`)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 2500)
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'No se pudo subir el mural')
		} finally {
			setIsUploading(false)
		}
	}

	const handleDownload = async () => {
		try {
			const blob = await createMovieMuralImage(muralData)
			downloadBlob(blob, `mural-cine-${year === 'all' ? 'todas' : year}.png`)
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'No se pudo descargar el mural')
		}
	}

	return (
		<MediaDialogShell
			isOpen={isOpen}
			onClose={onClose}
			icon={<Images className="h-4 w-4" />}
			title="Compartir mural"
			description="Una imagen con tus pósters y sus notas, lista para pegar en un hilo."
			width={860}
			height="auto"
			closeDisabled={isUploading}
			footer={
				<div className="flex shrink-0 flex-col gap-2 border-t border-border bg-background px-5 py-4">
					<div className="flex items-center justify-between gap-3">
						<p className="m-0 text-xs text-muted-foreground">
							Se subirá a {uploadHost} y se copiará el BBCode listo para pegar.
						</p>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={() => void handleDownload()} disabled={isUploading}>
								<Download className="mr-1 h-3.5 w-3.5" />
								Descargar
							</Button>
							<Button onClick={() => void handleUpload()} disabled={isUploading || selected.length === 0}>
								{isUploading ? (
									<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
								) : (
									<Upload className="mr-1 h-3.5 w-3.5" />
								)}
								{isUploading ? 'Subiendo…' : 'Subir y copiar BBCode'}
							</Button>
						</div>
					</div>

					{uploadedUrl && (
						<div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
							{copied ? (
								<Check className="h-4 w-4 shrink-0 text-primary" />
							) : (
								<Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
							)}
							<code className="min-w-0 flex-1 truncate text-xs">{`[img]${uploadedUrl}[/img]`}</code>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									void navigator.clipboard.writeText(`[img]${uploadedUrl}[/img]`)
									setCopied(true)
									window.setTimeout(() => setCopied(false), 2500)
								}}
							>
								{copied ? 'Copiado' : 'Copiar'}
							</Button>
						</div>
					)}
				</div>
			}
		>
			<div className="flex flex-col gap-4">
				<div className="flex flex-wrap items-end gap-2">
					<div className="flex-1 basis-52">
						<label htmlFor="mural-title" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
							Título
						</label>
						<Input
							id="mural-title"
							value={title}
							onChange={event => setTitle(event.target.value)}
							placeholder={defaultTitle}
							maxLength={48}
						/>
					</div>

					<Select value={year} onValueChange={setYear}>
						<SelectTrigger className="w-36">
							<SelectValue placeholder="Año" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Todos los años</SelectItem>
							{years.map(option => (
								<SelectItem key={option} value={option}>
									{option}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select value={limit} onValueChange={setLimit}>
						<SelectTrigger className="w-44">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{LIMIT_OPTIONS.map(option => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{error && (
					<div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
						<p className="m-0 font-semibold text-destructive">{error}</p>
					</div>
				)}

				{selected.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">
						No hay críticas publicadas para esa selección.
					</p>
				) : (
					<div className="relative overflow-hidden rounded-xl border border-border bg-black/40">
						{isPreviewEmpty && (
							<div className="absolute inset-0 flex items-center justify-center">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						)}
						<canvas ref={canvasRef} className="block h-auto w-full" />
					</div>
				)}

				{omittedCount > 0 && (
					<p className="m-0 text-xs text-muted-foreground">
						{selected.length === MURAL_MAX_POSTERS
							? `El mural admite ${MURAL_MAX_POSTERS} pósters como máximo; quedan ${omittedCount} fuera.`
							: `Quedan ${omittedCount} fuera de la selección.`}
					</p>
				)}
			</div>
		</MediaDialogShell>
	)
}
