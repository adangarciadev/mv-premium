import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'
import Check from 'lucide-react/dist/esm/icons/check'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Download from 'lucide-react/dist/esm/icons/download'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Image from 'lucide-react/dist/esm/icons/image'
import Upload from 'lucide-react/dist/esm/icons/upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MediaDialogShell } from '@/components/media-search-dialog/media-dialog-shell'
import { getCurrentUser } from '@/entrypoints/options/lib/current-user'
import { getApiKey, uploadImage } from '@/services/api/imgbb'
import {
	filterByReviewDate,
	getPeriodLabel,
	getRecapFacts,
	getReviewYears,
} from '@/features/cine/logic/movie-recap-layout'
import {
	collectRecapEnrichment,
	EMPTY_ENRICHMENT,
	type RecapEnrichment,
} from '@/features/cine/logic/movie-recap-enrichment'
import { splitRuntimeForDisplay } from '@/features/cine/logic/movie-runtime-cache'
import { createMovieRecapImage, renderMovieRecap, type RecapData } from '@/features/cine/logic/movie-recap-image'
import type { MovieReviewRecord } from '@/features/cine/logic/movie-review-store'

interface RecapShareDialogProps {
	isOpen: boolean
	onClose: () => void
	/** Published reviews only; the recap summarises what you said in public. */
	records: MovieReviewRecord[]
}

export function RecapShareDialog({ isOpen, onClose, records }: RecapShareDialogProps) {
	const [period, setPeriod] = useState('all')
	const [customFrom, setCustomFrom] = useState('')
	const [customTo, setCustomTo] = useState('')
	const [title, setTitle] = useState('')
	/** Only the title is debounced; the period changes on a click and can redraw at once. */
	const [debouncedTitle] = useDebounce(title, 350)
	const [username, setUsername] = useState('')
	const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)
	const [uploadHost, setUploadHost] = useState('freeimage.host')
	const [enrichment, setEnrichment] = useState<RecapEnrichment>(EMPTY_ENRICHMENT)
	const [isEnriching, setIsEnriching] = useState(false)
	const [isUploading, setIsUploading] = useState(false)
	const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [isPreviewEmpty, setIsPreviewEmpty] = useState(true)

	/** A live canvas, so changing the period never encodes a PNG. */
	const canvasRef = useRef<HTMLCanvasElement | null>(null)

	const years = useMemo(() => getReviewYears(records), [records])

	const range = useMemo(() => {
		if (period === 'custom') return { from: customFrom, to: customTo }
		if (period === 'all') return { from: '', to: '' }
		return { from: `${period}-01-01`, to: `${period}-12-31` }
	}, [period, customFrom, customTo])

	const selected = useMemo(() => filterByReviewDate(records, range), [records, range])
	const periodLabel = useMemo(() => getPeriodLabel(selected), [selected])

	const defaultTitle = 'Mi cine'
	const facts = useMemo(() => getRecapFacts(selected, enrichment), [selected, enrichment])
	// The same function the Mediaffinity headline uses, so the two surfaces cannot disagree: the
	// image used to say "145 horas" where the dashboard said "145,8 horas".
	const runtime = useMemo(
		() => (facts.minutes === null ? null : splitRuntimeForDisplay(facts.minutes)),
		[facts.minutes]
	)

	useEffect(() => {
		if (!isOpen) {
			setUploadedUrl(null)
			setCopied(false)
			setError(null)
			setIsPreviewEmpty(true)
			setTitle('')
			return
		}

		void getCurrentUser().then(user => {
			setUsername(user?.username || 'Usuario')
			setAvatarUrl(user?.avatarUrl)
		})
		void getApiKey().then(key => setUploadHost(key ? 'ImgBB' : 'freeimage.host'))
	}, [isOpen])

	// Best effort: the recap renders without these, and they fill in when TMDB answers.
	useEffect(() => {
		if (!isOpen || selected.length === 0) return

		let cancelled = false
		setIsEnriching(true)
		// The previous figures are held until the new ones land. Blanking them first made the
		// rankings empty and refill on every period change, which is the flicker itself.

		void collectRecapEnrichment(selected)
			.then(result => {
				if (!cancelled) setEnrichment(result)
			})
			.finally(() => {
				if (!cancelled) setIsEnriching(false)
			})

		return () => {
			cancelled = true
		}
	}, [isOpen, selected])

	const recapData: RecapData = useMemo(
		() => ({
			records: selected,
			facts,
			title: debouncedTitle.trim() || defaultTitle,
			period: periodLabel,
			directorById: enrichment.directorById,
			username,
			avatarUrl,
		}),
		[selected, facts, debouncedTitle, defaultTitle, periodLabel, enrichment, username, avatarUrl]
	)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!isOpen || !canvas || selected.length === 0) return

		let cancelled = false
		setError(null)

		void renderMovieRecap(canvas, recapData, runtime)
			.then(() => {
				if (!cancelled) setIsPreviewEmpty(false)
			})
			.catch(cause => {
				if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo dibujar el resumen')
			})

		return () => {
			cancelled = true
		}
	}, [isOpen, recapData, runtime, selected.length])

	const copyBbcode = (url: string) => {
		void navigator.clipboard.writeText(`[img]${url}[/img]`)
		setCopied(true)
		window.setTimeout(() => setCopied(false), 2500)
	}

	const handleUpload = async () => {
		setIsUploading(true)
		setError(null)

		try {
			const blob = await createMovieRecapImage(recapData, runtime)
			const result = await uploadImage(blob)
			if (!result.success || !result.url) throw new Error(result.error || 'No se pudo subir el resumen')

			setUploadedUrl(result.url)
			copyBbcode(result.url)
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'No se pudo subir el resumen')
		} finally {
			setIsUploading(false)
		}
	}

	const handleDownload = async () => {
		try {
			const blob = await createMovieRecapImage(recapData, runtime)
			const url = URL.createObjectURL(blob)
			const anchor = document.createElement('a')
			anchor.href = url
			anchor.download = `mi-cine-${period === 'all' ? 'todo' : period}.png`
			anchor.click()
			URL.revokeObjectURL(url)
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'No se pudo descargar el resumen')
		}
	}

	return (
		<MediaDialogShell
			isOpen={isOpen}
			onClose={onClose}
			icon={<Image className="h-4 w-4" />}
			title="Compartir resumen"
			description="Cómo puntúas, tus extremos y tus cifras, en una imagen para pegar en un hilo."
			width={880}
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
							<Button variant="ghost" size="sm" onClick={() => copyBbcode(uploadedUrl)}>
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
						<label htmlFor="recap-title" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
							Título
						</label>
						<Input
							id="recap-title"
							value={title}
							onChange={event => setTitle(event.target.value)}
							placeholder={defaultTitle}
							maxLength={40}
						/>
					</div>

					<Select value={period} onValueChange={setPeriod}>
						<SelectTrigger className="w-52">
							<SelectValue placeholder="Periodo" />
						</SelectTrigger>
						<SelectContent className="max-h-72">
							<SelectItem value="all">Todas mis críticas</SelectItem>
							{years.map(option => (
								<SelectItem key={option} value={option}>
									Criticadas en {option}
								</SelectItem>
							))}
							<SelectItem value="custom">Entre dos fechas…</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{period === 'custom' && (
					<div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-3">
						<div>
							<label htmlFor="recap-from" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
								Desde
							</label>
							<Input
								id="recap-from"
								type="date"
								value={customFrom}
								onChange={event => setCustomFrom(event.target.value)}
								className="w-44"
							/>
						</div>
						<div>
							<label htmlFor="recap-to" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
								Hasta
							</label>
							<Input
								id="recap-to"
								type="date"
								value={customTo}
								onChange={event => setCustomTo(event.target.value)}
								className="w-44"
							/>
						</div>
						<p className="m-0 flex-1 basis-48 text-xs text-muted-foreground">
							Se filtra por cuándo publicaste la crítica, no por el año de estreno de la película.
						</p>
					</div>
				)}

				{error && (
					<div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
						<p className="m-0 font-semibold text-destructive">{error}</p>
					</div>
				)}

				{selected.length === 0 ? (
					<p className="py-8 text-center text-sm text-muted-foreground">No hay críticas publicadas en ese periodo.</p>
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

				<p className="m-0 text-xs text-muted-foreground">
					{isEnriching
						? 'Consultando duraciones y directores en TMDB…'
						: facts.minutes === null
							? 'Las horas y el director salen de TMDB; si no responde, el resumen se genera igual.'
							: 'Horas, director y género vienen de TMDB.'}
				</p>
			</div>
		</MediaDialogShell>
	)
}
