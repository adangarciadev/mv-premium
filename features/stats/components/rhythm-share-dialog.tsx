import { useEffect, useMemo, useState } from 'react'
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Download from 'lucide-react/dist/esm/icons/download'
import ImageIcon from 'lucide-react/dist/esm/icons/image'
import LoaderCircle from 'lucide-react/dist/esm/icons/loader-circle'
import Share2 from 'lucide-react/dist/esm/icons/share-2'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { type RhythmStats } from '../logic/rhythm-model'
import {
	getRhythmShareAvailability,
	MIN_SHARE_RHYTHM_MS,
	type RhythmShareAvailability,
} from '../logic/rhythm-share-availability'
import { getRhythmCalendarWeeks } from '../logic/rhythm-insights'
import {
	buildShareSummary,
	fmtTime,
	formatWeekRange,
	getBestWeekday,
	getDefaultWeekKey,
	WEEKDAY_LABELS_ES,
	type ShareScope,
} from '../logic/rhythm-share-summary'
import { createShareImageBlob } from '../logic/rhythm-share-image'

interface RhythmShareDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	stats: RhythmStats
	username?: string
	selectedWeekKey?: string | null
	selectedWeekday?: number | null
}

interface ClipboardImageItem {
	readonly types?: readonly string[]
	getType?: (type: string) => Promise<Blob>
}

type ClipboardItemConstructor = new (items: Record<string, Blob>) => ClipboardImageItem
type NavigatorWithImageClipboard = Navigator & {
	clipboard?: {
		write?: (items: ClipboardImageItem[]) => Promise<void>
	}
}

const SHARE_SCOPE_OPTIONS: Array<{ value: ShareScope; label: string; description: string }> = [
	{ value: 'year', label: 'Año actual', description: 'Total del año y ritmo medio.' },
	{ value: 'last30', label: 'Últimos 30 días', description: 'Total reciente por día real.' },
	{ value: 'week', label: 'Semana', description: 'Total de una semana concreta.' },
	{ value: 'weekday', label: 'Día', description: 'Media de lunes, martes, etc.' },
]

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

function readyShareAvailability(currentMs: number): RhythmShareAvailability {
	return { canShare: true, currentMs, minMs: MIN_SHARE_RHYTHM_MS, reason: '' }
}

function isShareScope(value: string): value is ShareScope {
	return value === 'year' || value === 'last30' || value === 'week' || value === 'weekday'
}

function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = fileName
	anchor.click()
	window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function RhythmShareDialog({
	open,
	onOpenChange,
	stats,
	username,
	selectedWeekKey,
	selectedWeekday,
}: RhythmShareDialogProps) {
	const defaultWeekKey = useMemo(() => getDefaultWeekKey(stats, selectedWeekKey), [stats, selectedWeekKey])
	const defaultWeekday = useMemo(
		() => selectedWeekday ?? getBestWeekday(stats),
		[stats, selectedWeekday]
	)
	const [scope, setScope] = useState<ShareScope>('year')
	const [weekKey, setWeekKey] = useState(defaultWeekKey)
	const [weekday, setWeekday] = useState(defaultWeekday)
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
	const [status, setStatus] = useState<string | null>(null)

	const availableWeeks = useMemo(
		() => getRhythmCalendarWeeks(stats.weeks).filter(week => week.ms > 0),
		[stats.weeks]
	)
	const shareableWeeks = useMemo(
		() => availableWeeks.filter(week => week.ms >= MIN_SHARE_RHYTHM_MS),
		[availableWeeks]
	)
	const shareableWeekdays = useMemo(
		() => WEEKDAY_ORDER.filter(day => (Number(stats.weekdays[day]) || 0) >= MIN_SHARE_RHYTHM_MS),
		[stats.weekdays]
	)
	const scopeAvailability = useMemo<Record<ShareScope, RhythmShareAvailability>>(
		() => ({
			year: getRhythmShareAvailability(stats, 'year', defaultWeekKey, defaultWeekday),
			last30: getRhythmShareAvailability(stats, 'last30', defaultWeekKey, defaultWeekday),
			week: shareableWeeks[0]
				? readyShareAvailability(shareableWeeks[0].ms)
				: getRhythmShareAvailability(stats, 'week', defaultWeekKey, defaultWeekday),
			weekday: shareableWeekdays[0] !== undefined
				? readyShareAvailability(Number(stats.weekdays[shareableWeekdays[0]]) || 0)
				: getRhythmShareAvailability(stats, 'weekday', defaultWeekKey, defaultWeekday),
		}),
		[defaultWeekKey, defaultWeekday, shareableWeekdays, shareableWeeks, stats]
	)

	useEffect(() => {
		if (!open) return
		const preferredScope: ShareScope = selectedWeekKey
			? 'week'
			: selectedWeekday !== null && selectedWeekday !== undefined
				? 'weekday'
				: 'year'
		const nextScope =
			scopeAvailability[preferredScope].canShare
				? preferredScope
				: SHARE_SCOPE_OPTIONS.find(option => scopeAvailability[option.value].canShare)?.value ?? preferredScope
		const nextWeekKey =
			shareableWeeks.find(week => week.key === defaultWeekKey)?.key ?? shareableWeeks[0]?.key ?? defaultWeekKey
		const nextWeekday =
			shareableWeekdays.includes(defaultWeekday as (typeof WEEKDAY_ORDER)[number])
				? defaultWeekday
				: shareableWeekdays[0] ?? defaultWeekday

		setScope(nextScope)
		setWeekKey(nextWeekKey)
		setWeekday(nextWeekday)
		setStatus(null)
	}, [
		defaultWeekKey,
		defaultWeekday,
		open,
		scopeAvailability,
		selectedWeekKey,
		selectedWeekday,
		shareableWeekdays,
		shareableWeeks,
	])

	const summary = useMemo(
		() => buildShareSummary(stats, scope, weekKey, weekday, username),
		[stats, scope, weekKey, weekday, username]
	)
	const selectedAvailability = useMemo(
		() => getRhythmShareAvailability(stats, scope, weekKey, weekday),
		[stats, scope, weekKey, weekday]
	)
	const canExportSelectedScope = selectedAvailability.canShare
	const canUsePreviewImage = canExportSelectedScope && Boolean(previewBlob)

	useEffect(() => {
		if (!open) return
		let cancelled = false
		let objectUrl: string | null = null
		setPreviewUrl(null)
		setPreviewBlob(null)
		if (!canExportSelectedScope) return

		void createShareImageBlob(summary)
			.then(blob => {
				if (cancelled) return
				objectUrl = URL.createObjectURL(blob)
				setPreviewBlob(blob)
				setPreviewUrl(objectUrl)
			})
			.catch(() => {
				if (!cancelled) setStatus('No se pudo generar la vista previa.')
			})

		return () => {
			cancelled = true
			if (objectUrl) URL.revokeObjectURL(objectUrl)
		}
	}, [canExportSelectedScope, open, summary])

	const handleScopeChange = (value: string) => {
		if (!isShareScope(value) || !scopeAvailability[value].canShare) return
		if (value === 'week') {
			const currentWeekCanShare = getRhythmShareAvailability(stats, 'week', weekKey, weekday).canShare
			if (!currentWeekCanShare && shareableWeeks[0]) setWeekKey(shareableWeeks[0].key)
		}
		if (value === 'weekday') {
			const currentWeekdayCanShare = getRhythmShareAvailability(stats, 'weekday', weekKey, weekday).canShare
			if (!currentWeekdayCanShare && shareableWeekdays[0] !== undefined) setWeekday(shareableWeekdays[0])
		}
		setScope(value)
		setStatus(null)
	}

	const handleCopy = async () => {
		if (!canExportSelectedScope) {
			setStatus(selectedAvailability.reason)
			return
		}
		if (!previewBlob) return
		try {
			const ClipboardItemCtor = (globalThis as { ClipboardItem?: ClipboardItemConstructor }).ClipboardItem
			const clipboard = (navigator as NavigatorWithImageClipboard).clipboard
			if (!clipboard?.write || !ClipboardItemCtor) {
				downloadBlob(previewBlob, summary.fileName)
				setStatus('Tu navegador no permite copiar imágenes aquí; he descargado el PNG.')
				return
			}
			await clipboard.write([new ClipboardItemCtor({ 'image/png': previewBlob })])
			setStatus('Imagen copiada. Ya puedes pegarla en Mediavida.')
		} catch {
			downloadBlob(previewBlob, summary.fileName)
			setStatus('No se pudo copiar la imagen; he descargado el PNG.')
		}
	}

	const handleDownload = () => {
		if (!canExportSelectedScope) {
			setStatus(selectedAvailability.reason)
			return
		}
		if (!previewBlob) return
		downloadBlob(previewBlob, summary.fileName)
		setStatus('PNG descargado.')
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-none max-w-5xl gap-0 overflow-hidden p-0"
				style={{ height: 'min(760px, calc(100vh - 6rem))', maxHeight: 'calc(100vh - 6rem)' }}
				showCloseButton
			>
				<div className="grid h-full min-h-0 lg:grid-cols-[330px_1fr]">
					<aside className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] border-b border-border bg-muted/20 p-5 pb-5 lg:border-b-0 lg:border-r">
						<DialogHeader>
							<div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<Share2 className="h-5 w-5" />
							</div>
							<DialogTitle>Compartir resumen</DialogTitle>
							<DialogDescription>
								Genera una imagen PNG lista para enseñar tu tiempo en Mediavida.
							</DialogDescription>
						</DialogHeader>

						<div className="mt-5 min-h-0 space-y-4 overflow-y-auto pb-4 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
							<div className="space-y-2">
								<p className="font-data text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
									Tipo de resumen
								</p>
								<div className="grid gap-2">
									{SHARE_SCOPE_OPTIONS.map(option => {
										const isActive = scope === option.value
										const availability = scopeAvailability[option.value]
										const isDisabled = !availability.canShare
										return (
											<button
												key={option.value}
												type="button"
												aria-pressed={isActive}
												disabled={isDisabled}
												title={isDisabled ? availability.reason : undefined}
												onClick={() => handleScopeChange(option.value)}
												className={cn(
													'group rounded-lg border px-3.5 py-2.5 text-left transition-[background-color,border-color,box-shadow,color,opacity]',
													'focus-visible:outline-none focus-visible:bg-primary/10',
													isDisabled
														? 'cursor-not-allowed border-border/50 bg-background/25 text-muted-foreground/55 opacity-70'
														: isActive
															? 'border-primary/45 bg-primary/15 text-foreground shadow-[0_0_24px_-20px_var(--primary)] hover:bg-primary/20'
															: 'border-border/70 bg-background/40 text-muted-foreground hover:border-primary/35 hover:bg-primary/10 hover:text-foreground'
												)}
											>
												<span className="flex items-start justify-between gap-3">
													<span className="min-w-0">
														<span
															className={cn(
																'block text-sm font-semibold',
																isActive && 'text-primary',
																isDisabled && 'text-muted-foreground/70'
															)}
														>
															{option.label}
														</span>
														<span
															className={cn(
																'mt-1 block text-xs leading-snug text-muted-foreground',
																isDisabled && 'text-muted-foreground/55'
															)}
														>
															{isDisabled ? availability.reason : option.description}
														</span>
													</span>
													<span
														className={cn(
															'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
															isDisabled
																? 'border-border/50 bg-background/30 text-transparent'
																: isActive
																? 'border-primary bg-primary text-primary-foreground'
																: 'border-border/80 bg-background/60 text-transparent group-hover:border-primary/45'
														)}
													>
														<CheckCircle2 className="h-3.5 w-3.5" />
													</span>
												</span>
											</button>
										)
									})}
								</div>
							</div>

							<div className="min-h-[64px]">
							{scope === 'week' && (
								<div className="space-y-2">
									<p className="font-data text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
										Semana
									</p>
									<Select value={weekKey} onValueChange={setWeekKey} disabled={shareableWeeks.length === 0}>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Elige una semana" />
										</SelectTrigger>
										<SelectContent>
											{availableWeeks.length > 0 ? (
												availableWeeks.map(week => {
													const canShareWeek = week.ms >= MIN_SHARE_RHYTHM_MS
													return (
														<SelectItem key={week.key} value={week.key} disabled={!canShareWeek}>
															<CalendarDays className="h-4 w-4 text-primary" />
															{formatWeekRange(week.weekStart)} · {fmtTime(week.ms)}
															{!canShareWeek && ' · insuficiente'}
														</SelectItem>
													)
												})
											) : (
												<SelectItem value={weekKey} disabled>
													Sin semanas registradas
												</SelectItem>
											)}
										</SelectContent>
									</Select>
								</div>
							)}

							{scope === 'weekday' && (
								<div className="space-y-2">
									<p className="font-data text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
										Día de la semana
									</p>
									<Select value={String(weekday)} onValueChange={value => setWeekday(Number(value))}>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{WEEKDAY_ORDER.map(day => {
												const canShareDay = (Number(stats.weekdays[day]) || 0) >= MIN_SHARE_RHYTHM_MS
												return (
													<SelectItem key={day} value={String(day)} disabled={!canShareDay}>
														{WEEKDAY_LABELS_ES[day]}
														{!canShareDay && ' · insuficiente'}
													</SelectItem>
												)
											})}
										</SelectContent>
									</Select>
								</div>
							)}

							</div>

							<div className="rounded-lg border border-border/70 bg-background/35 p-3 text-xs leading-relaxed text-muted-foreground">
								<p className="font-semibold text-foreground">Qué incluye</p>
								<p className="mt-1">
									El PNG se crea en tu navegador. No sube datos ni cambia el almacenamiento.
								</p>
							</div>
							{!canExportSelectedScope && (
								<div className="rounded-lg border border-primary/25 bg-primary/10 p-3 text-xs leading-relaxed text-muted-foreground">
									<p className="font-semibold text-foreground">Aún no se puede compartir</p>
									<p className="mt-1">{selectedAvailability.reason}</p>
								</div>
							)}
						</div>

						<DialogFooter className="shrink-0 flex-col gap-2 border-t border-border/60 pt-4 sm:flex-col">
							<Button
								onClick={handleCopy}
								disabled={!canUsePreviewImage}
								className={cn('w-full', !canUsePreviewImage && 'cursor-not-allowed')}
								title={!canExportSelectedScope ? selectedAvailability.reason : undefined}
							>
								<Copy className="h-4 w-4" />
								Copiar imagen
							</Button>
							<Button
								variant="outline"
								onClick={handleDownload}
								disabled={!canUsePreviewImage}
								className={cn('w-full', !canUsePreviewImage && 'cursor-not-allowed')}
								title={!canExportSelectedScope ? selectedAvailability.reason : undefined}
							>
								<Download className="h-4 w-4" />
								Descargar PNG
							</Button>
						</DialogFooter>
					</aside>

					<section className="relative grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background/60 p-5 pb-8">
						<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
							<ImageIcon className="h-4 w-4 text-primary" />
							Vista previa
						</div>
						<div className="flex min-h-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-black/35 p-4">
							<div className="relative h-full w-full min-w-0 overflow-hidden rounded-lg bg-background/30">
								{!canExportSelectedScope ? (
									<div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
										<span className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary shadow-[0_0_34px_-18px_var(--primary)]">
											<Share2 className="h-8 w-8" />
										</span>
										<div className="max-w-sm">
											<p className="text-lg font-semibold text-foreground">Datos insuficientes</p>
											<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{selectedAvailability.reason}</p>
										</div>
									</div>
								) : previewUrl ? (
									<img
										src={previewUrl}
										alt="Vista previa del resumen para compartir"
										className="h-full w-full object-contain shadow-2xl"
									/>
								) : (
									<div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
										<span className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary shadow-[0_0_34px_-18px_var(--primary)]">
											<LoaderCircle className="h-9 w-9 animate-spin" />
										</span>
										<div>
											<p className="text-lg font-semibold text-foreground">Preparando imagen</p>
											<p className="mt-1 text-xs text-muted-foreground">Actualizando el PNG con este resumen.</p>
										</div>
									</div>
								)}
							</div>
						</div>
						{/* Floating toast: out of layout flow, so a status message never shifts
						    the footer buttons or introduces a scroll in the sidebar. */}
						{status && (
							<div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-6">
								<p
									aria-live="polite"
									className="pointer-events-auto max-w-sm rounded-lg border border-border/60 bg-card/95 px-3.5 py-2 text-center text-xs text-muted-foreground shadow-lg backdrop-blur"
								>
									{status}
								</p>
							</div>
						)}
					</section>
				</div>
			</DialogContent>
		</Dialog>
	)
}
