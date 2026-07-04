/**
 * RhythmClock - "Tiempo en Mediavida" 24h radial heatmap clock.
 *
 * Shows WHEN the user browses Mediavida (reliable navigation-time buckets, not
 * DOM-event capture) and, contextual to each hour, WHERE (top subforums at that
 * hour). The companion band switches between by-weekday and by-week (full year)
 * heatmap strips.
 */
import { memo, useMemo, useState, type ElementType, type ReactNode } from 'react'
import Clock from 'lucide-react/dist/esm/icons/clock'
import MapPin from 'lucide-react/dist/esm/icons/map-pin'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Dices from 'lucide-react/dist/esm/icons/dices'
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days'
import Info from 'lucide-react/dist/esm/icons/info'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import Share2 from 'lucide-react/dist/esm/icons/share-2'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { getSubforumName, getSubforumIconId } from '@/lib/subforums'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { getWeekKey, type RhythmStats } from '../logic/rhythm-model'
import { getRhythmShareReadiness } from '../logic/rhythm-share-availability'
import { RhythmShareDialog } from './rhythm-share-dialog'
import {
	getActiveBand,
	getArchetype,
	getPeakHour,
	getPeakHours,
	getRhythmCalendarWeeks,
	getRhythmWeekDays,
	getSubforumTotals,
	getTopSubforumsForHour,
	getWeekdaySubforums,
	getAverageRhythmHours,
	getAverageSubforumTimes,
	getActiveDayCount,
	getWeekdayCounts,
	hasEnoughRhythmData,
	hasWeeklyData,
	type DayBucket,
	type SubforumTime,
	type WeekBucket,
} from '../logic/rhythm-insights'

// --- Clock geometry. viewBox has margin so edge hour labels don't clip. ---
const SIZE = 340
const MARGIN = 30
const CX = 170
const CY = 170
const R_RING_INNER = 92
const R_RING_OUTER = 150
const R_CENTER = 84
const WEDGE_GAP_DEG = 2
const R_MIN_OUTER = R_RING_INNER + 8 // faint baseline length for empty hours

const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const WEEKDAYS = [
	{ label: 'Lun', index: 1 },
	{ label: 'Mar', index: 2 },
	{ label: 'Mié', index: 3 },
	{ label: 'Jue', index: 4 },
	{ label: 'Vie', index: 5 },
	{ label: 'Sáb', index: 6 },
	{ label: 'Dom', index: 0 },
]

const WEEKDAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21].map(hour => ({ hour, label: String(hour).padStart(2, '0') }))

const FAINT_FILL = 'color-mix(in srgb, var(--foreground) 8%, transparent)'
const STRIP_EMPTY_FILL = 'color-mix(in srgb, var(--foreground) 11%, transparent)'
const segmentedRadiusStyle = { borderRadius: 'var(--radius)' } as const
const segmentedItemRadiusStyle = { borderRadius: 'max(2px, calc(var(--radius) - 2px))' } as const

const CLOCK_BUCKET_MAX_MS = 60 * 60_000 // a clock bucket represents one capped hour.

const DAY_BAR_MAX_MS = 12 * 60 * 60_000
const WEEK_BAR_MAX_MS = 30 * 60 * 60_000

function clockIntensity(ms: number): number {
	return Math.min(1, Math.max(0, ms) / CLOCK_BUCKET_MAX_MS)
}

/** Heatmap fill for an intensity 0–1 (shared by clock wedges and strip cells). */
function heatFill(t: number): string {
	if (t <= 0) return FAINT_FILL
	return `color-mix(in srgb, var(--primary) ${Math.round(28 + t * 72)}%, transparent)`
}

function primaryMix(percent: number): string {
	return `color-mix(in srgb, var(--primary) ${percent}%, transparent)`
}

function dayStripHeightPct(ms: number): number {
	if (ms <= 0) return 8
	return Math.max(10, Math.min(100, Math.round((ms / DAY_BAR_MAX_MS) * 100)))
}

function dayStripIntensity(ms: number): number {
	return Math.min(1, Math.max(0, ms) / DAY_BAR_MAX_MS)
}

function weekStripHeightPct(ms: number): number {
	if (ms <= 0) return 10
	return Math.max(16, Math.min(100, Math.round((ms / WEEK_BAR_MAX_MS) * 100)))
}

function weekStripIntensity(ms: number): number {
	return Math.min(1, Math.max(0, ms) / WEEK_BAR_MAX_MS)
}

/** Time with seconds, dropping zero components ("2m 10s", "2m", "10s", "1h 5s"). */
function fmtTime(ms: number): string {
	if (ms > 0 && ms < 1000) return '<1s'
	const s = Math.floor(ms / 1000) % 60
	const m = Math.floor(ms / 60_000) % 60
	const h = Math.floor(ms / 3_600_000)
	const parts: string[] = []
	if (h) parts.push(`${h}h`)
	if (m) parts.push(`${m}m`)
	if (s || parts.length === 0) parts.push(`${s}s`)
	return parts.join(' ')
}

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`
// The bucket "the 14h hour" → 14:00–14:59 (clearer than 14:00–15:00, which would
// make 15:00 appear as both the end of one hour and the start of the next).
const hourRange = (h: number) => `${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59`

function parseLocalDateKey(key: string): Date | null {
	const [year, month, day] = key.split('-').map(Number)
	if (!year || !month || !day) return null
	return new Date(year, month - 1, day)
}

function formatShortMonth(date: Date): string {
	return date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
}

function formatWeekRange(start: Date): string {
	const end = new Date(start)
	end.setDate(start.getDate() + 6)
	const startMonth = formatShortMonth(start)
	const endMonth = formatShortMonth(end)
	if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
		return `del ${start.getDate()} al ${end.getDate()} de ${startMonth}`
	}
	return `del ${start.getDate()} ${startMonth} al ${end.getDate()} ${endMonth}`
}

/** Compact list of tied peak hours, e.g. "15:00, 16:00, 17:00 +1". */
function formatPeakHours(peaks: number[]): string {
	const shown = peaks.slice(0, 4).map(h => `${String(h).padStart(2, '0')}:00`)
	return shown.join(', ') + (peaks.length > 4 ? ` +${peaks.length - 4}` : '')
}

function polarDeg(deg: number, radius: number): [number, number] {
	const angle = (deg - 90) * (Math.PI / 180)
	return [CX + Math.cos(angle) * radius, CY + Math.sin(angle) * radius]
}

function polarHour(hour: number, radius: number): [number, number] {
	return polarDeg(hour * 15, radius)
}

function wedgePath(hour: number, outerR: number): string {
	const half = 7.5 - WEDGE_GAP_DEG / 2
	const a0 = hour * 15 - half
	const a1 = hour * 15 + half
	const [osx, osy] = polarDeg(a0, outerR)
	const [oex, oey] = polarDeg(a1, outerR)
	const [iex, iey] = polarDeg(a1, R_RING_INNER)
	const [isx, isy] = polarDeg(a0, R_RING_INNER)
	return `M ${osx} ${osy} A ${outerR} ${outerR} 0 0 1 ${oex} ${oey} L ${iex} ${iey} A ${R_RING_INNER} ${R_RING_INNER} 0 0 0 ${isx} ${isy} Z`
}

// =============================================================================
// "Dónde" panel — subforums for the active hour
// =============================================================================

function DondeEmpty({ scopeLabel, hasData, pinned }: { scopeLabel: string; hasData: boolean; pinned: boolean }) {
	const title = !hasData ? 'Aún sin datos' : pinned ? 'Sin subforos registrados en esta hora' : `Nada en ${scopeLabel}`
	const description = !hasData
		? 'Se irá registrando a medida que navegues por Mediavida.'
		: pinned
		? 'Haz clic de nuevo en la hora para volver al resumen diario.'
		: 'Pasa el ratón o haz clic en una hora del reloj para ver su desglose.'

	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 text-center">
			<span className="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-background/40 text-muted-foreground/60">
				<MapPin className="h-6 w-6" />
			</span>
			<div>
				<p className="text-sm font-semibold text-foreground/80">{title}</p>
				<p className="mx-auto mt-1 max-w-[260px] text-xs text-muted-foreground">{description}</p>
			</div>
		</div>
	)
}

function DondePanel({
	scopeLabel,
	subs,
	hasData,
	pinned,
}: {
	scopeLabel: string
	subs: SubforumTime[]
	hasData: boolean
	pinned: boolean
}) {
	const total = subs.reduce((acc, s) => acc + s.ms, 0)
	return (
		<div
			className={cn(
				'w-full rounded-lg border border-border/60 bg-background/30 p-3 transition-[border-color,box-shadow,background-color]',
				pinned && 'border-primary/45 bg-primary/5 shadow-[0_0_28px_-20px_var(--primary)]'
			)}
		>
			<div className="mb-2 flex items-center justify-between gap-2">
				<span className="flex items-center gap-1.5 font-data text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
					<MapPin className="h-3.5 w-3.5 text-primary" />
					Dónde · <span className="text-foreground">{scopeLabel}</span>
					{pinned && (
						<span className="rounded bg-primary/15 px-1.5 py-px text-[9px] font-bold tracking-wider text-primary">
							FIJADO
						</span>
					)}
				</span>
				{total > 0 && (
					<span className="font-data text-[11px] tabular-nums text-muted-foreground">{fmtTime(total)}</span>
				)}
			</div>

			{/* Fixed height + reserved scrollbar gutter → no layout jump (0 ↔ many). */}
			<div className="h-[184px] overflow-y-auto pr-1 scrollbar-thin" style={{ scrollbarGutter: 'stable' }}>
				{subs.length > 0 ? (
					<div className="space-y-0.5">
						{subs.map((s, i) => {
							const iconId = getSubforumIconId(s.slug)
							return (
								<div key={s.slug} className="flex items-center gap-2 rounded-md px-1.5 py-1">
									<span className="w-3.5 shrink-0 text-right font-data text-[11px] tabular-nums text-muted-foreground/50">
										{i + 1}
									</span>
									{iconId !== null ? (
										<NativeFidIcon iconId={iconId} className="h-4 w-4 shrink-0" />
									) : (
										<span className="h-4 w-4 shrink-0 rounded bg-muted/50" />
									)}
									<span className="min-w-0 flex-1 truncate text-[13px] text-foreground/90">
										{getSubforumName(s.slug) || s.slug}
									</span>
									<span className="shrink-0 font-data text-[11px] tabular-nums text-muted-foreground">
										{fmtTime(s.ms)}
									</span>
								</div>
							)
						})}
					</div>
				) : (
					<DondeEmpty scopeLabel={scopeLabel} hasData={hasData} pinned={pinned} />
				)}
			</div>
		</div>
	)
}

function RhythmHelpItem({
	icon: Icon,
	title,
	children,
}: {
	icon: ElementType<{ className?: string }>
	title: string
	children: ReactNode
}) {
	return (
		<div className="flex gap-2.5">
			<span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
				<Icon className="h-3.5 w-3.5" />
			</span>
			<p className="text-xs leading-relaxed text-muted-foreground">
				<b className="font-semibold text-foreground">{title}</b>: {children}
			</p>
		</div>
	)
}

function RhythmScopeHelp({
	subView,
	inSelectedWeek,
}: {
	subView: 'weekday' | 'weekly'
	inSelectedWeek: boolean
}) {
	const title =
		subView === 'weekday' ? 'Vista Día' : inSelectedWeek ? 'Semana abierta' : 'Vista Semana'
	const body =
		subView === 'weekday'
			? [
					'Cada barra es la media de todos tus lunes, martes, etc. registrados. No es una fecha concreta.',
					'Al seleccionar un día, el reloj y Dónde muestran esa media de ese día de la semana.',
				]
			: inSelectedWeek
				? [
						'Estas barras sí son días concretos de la semana abierta. Cada una muestra el tiempo total de esa fecha.',
						'Si seleccionas un día, el reloj vuelve a la media de ese día de la semana, porque no se guarda el detalle horario por fecha.',
					]
				: [
						'Cada barra es una semana del año. El valor es el tiempo total acumulado durante esa semana.',
						'Abre una semana para ver sus días concretos.',
					]

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
					aria-label="Qué muestra esta vista"
					title="Qué muestra esta vista"
				>
					<Info className="h-3.5 w-3.5" />
				</button>
			</PopoverTrigger>
			<PopoverContent side="top" align="start" sideOffset={8} className="w-[320px]">
				<div className="space-y-2">
					<p className="text-sm font-semibold text-foreground">{title}</p>
					{body.map(text => (
						<p key={text} className="text-xs leading-relaxed text-muted-foreground">
							{text}
						</p>
					))}
				</div>
			</PopoverContent>
		</Popover>
	)
}

// =============================================================================
// Heatmap strips (weekday / year-weeks)
// =============================================================================

function WeekdayStrip({
	stats,
	counts,
	selected,
	onSelect,
	todayWeekday,
	showPeak,
}: {
	stats: RhythmStats
	counts: number[]
	selected: number | null
	onSelect: (weekday: number | null) => void
	todayWeekday: number
	showPeak: boolean
}) {
	// Average time per occurrence of each weekday. Height = RELATIVE to the busiest day
	// (clear differences between days); color = absolute magnitude.
	const [hovered, setHovered] = useState<number | null>(null)
	const avgs = WEEKDAYS.map(({ index }) => (stats.weekdays[index] || 0) / Math.max(1, counts[index]))
	const max = Math.max(...avgs, 0)
	const peakPos = max > 0 ? avgs.indexOf(max) : -1
	const featuredWeekday = hovered ?? selected ?? todayWeekday
	const featuredPos = featuredWeekday === null ? -1 : WEEKDAYS.findIndex(({ index }) => index === featuredWeekday)
	const featuredLabel = featuredPos >= 0 ? WEEKDAYS[featuredPos].label : null
	const featuredFullLabel = featuredWeekday === null ? null : WEEKDAY_FULL[featuredWeekday]
	const featuredValue = featuredPos >= 0 ? avgs[featuredPos] : 0
	return (
		<div className="space-y-2">
			<div className="flex h-5 items-center justify-center">
				<span
					className={cn(
						'rounded-full border px-2.5 py-0.5 font-data text-[10px] tabular-nums transition-colors',
						featuredLabel
							? 'border-primary/25 bg-primary/10 text-primary'
							: 'border-transparent text-muted-foreground/60'
					)}
				>
					{featuredLabel
						? `${featuredFullLabel} · ${featuredValue > 0 ? `MEDIA ${fmtTime(featuredValue)}` : 'SIN DATOS'}`
						: 'Pasa por una barra'}
				</span>
			</div>
			<div className="flex items-end justify-center gap-2">
				{WEEKDAYS.map(({ label, index }, pos) => {
					const value = avgs[pos]
					const hasValue = value > 0
					const heightPct = hasValue ? dayStripHeightPct(value) : 8
					const isPeak = showPeak && pos === peakPos && value > 0
					const isSelected = selected === index
					const isTodayDefault = selected === null && index === todayWeekday
					return (
						<div
							key={label}
							className="group flex w-full max-w-[56px] flex-1 flex-col items-center gap-1.5"
							onMouseEnter={() => setHovered(index)}
							onMouseLeave={() => setHovered(null)}
						>
							<div className="flex h-[64px] w-full items-end justify-center">
								<button
									type="button"
									disabled={!hasValue}
									onClick={() => hasValue && onSelect(isSelected ? null : index)}
									onFocus={() => setHovered(index)}
									onBlur={() => setHovered(null)}
									title={
										hasValue
											? `${WEEKDAY_FULL[index]} · MEDIA ${fmtTime(value)} — clic para seleccionar este día`
											: `${label} · SIN DATOS`
									}
									aria-label={
										hasValue ? `Seleccionar ${WEEKDAY_FULL[index]}, MEDIA ${fmtTime(value)}` : `${label}, sin datos registrados`
									}
									className={cn(
										'w-full transition-[height,background-color,box-shadow,opacity] duration-300',
										hasValue ? 'cursor-pointer' : 'cursor-default'
									)}
									style={{
										height: `${heightPct}%`,
										background: hasValue ? heatFill(dayStripIntensity(value)) : STRIP_EMPTY_FILL,
										borderRadius: 'max(2px, calc(var(--radius) - 2px))',
										opacity: hasValue ? 1 : 0.72,
										...(isSelected || isTodayDefault
											? { outline: '1.5px solid var(--primary)', outlineOffset: '2px' }
											: {}),
										...(isPeak ? { boxShadow: '0 0 14px color-mix(in srgb, var(--primary) 45%, transparent)' } : {}),
									}}
								/>
							</div>
							<span
								className={cn(
									'text-[11px] transition-colors',
									isSelected || isTodayDefault
										? 'font-semibold text-primary'
										: isPeak
										? 'font-semibold text-primary/90'
										: hasValue
										? 'text-muted-foreground group-hover:text-foreground'
										: 'text-muted-foreground/45'
								)}
							>
								{label}
							</span>
						</div>
					)
				})}
			</div>
		</div>
	)
}

function dayBucketLabel(bucket: DayBucket): string {
	const weekday = WEEKDAYS.find(w => w.index === bucket.weekday)?.label ?? WEEKDAY_FULL[bucket.weekday]
	return `${weekday} ${bucket.date.getDate()}`
}

function WeekDaysStrip({
	days,
	weekStart,
	selectedWeekday,
	onSelectDay,
}: {
	days: Record<string, number>
	weekStart: Date
	selectedWeekday: number | null
	onSelectDay: (weekday: number | null) => void
}) {
	const [hoveredKey, setHoveredKey] = useState<string | null>(null)
	const buckets = useMemo(() => getRhythmWeekDays(days, weekStart), [days, weekStart])
	const max = Math.max(...buckets.map(day => day.ms), 0)
	const peak = max > 0 ? buckets.find(day => day.ms === max) ?? null : null
	const selected = selectedWeekday === null ? null : buckets.find(day => day.weekday === selectedWeekday) ?? null
	const hovered = hoveredKey ? buckets.find(day => day.key === hoveredKey) ?? null : null
	const featured = hovered ?? selected ?? peak

	return (
		<div className="space-y-2">
			<div className="flex h-5 items-center justify-center">
				<span
					className={cn(
						'rounded-full border px-2.5 py-0.5 font-data text-[10px] tabular-nums transition-colors',
						featured
							? 'border-primary/25 bg-primary/10 text-primary'
							: 'border-transparent text-muted-foreground/60'
					)}
				>
					{featured
						? `${dayBucketLabel(featured)} · ${featured.ms > 0 ? `TOTAL ${fmtTime(featured.ms)}` : 'SIN DATOS'}`
						: 'Pasa por un día'}
				</span>
			</div>
			<div className="flex items-end justify-center gap-2">
				{buckets.map(bucket => {
					const hasValue = bucket.ms > 0
					const heightPct = hasValue ? dayStripHeightPct(bucket.ms) : 8
					const isPeak = peak?.key === bucket.key && hasValue
					const isSelected = selectedWeekday === bucket.weekday
					return (
						<div
							key={bucket.key}
							className="group flex w-full max-w-[56px] flex-1 flex-col items-center gap-1.5"
							onMouseEnter={() => setHoveredKey(bucket.key)}
							onMouseLeave={() => setHoveredKey(null)}
						>
							<div className="flex h-[64px] w-full items-end justify-center">
								<button
									type="button"
									disabled={!hasValue}
									onClick={() => hasValue && onSelectDay(isSelected ? null : bucket.weekday)}
									onFocus={() => setHoveredKey(bucket.key)}
									onBlur={() => setHoveredKey(null)}
									title={
										hasValue
											? `${dayBucketLabel(bucket)} · TOTAL ${fmtTime(bucket.ms)} — seleccionar ${WEEKDAY_FULL[bucket.weekday]}`
											: `${dayBucketLabel(bucket)} · SIN DATOS`
									}
									aria-label={
										hasValue
											? `Seleccionar ${WEEKDAY_FULL[bucket.weekday]}, ${fmtTime(bucket.ms)} total esta fecha`
											: `${dayBucketLabel(bucket)}, sin datos registrados`
									}
									className={cn(
										'w-full transition-[height,background-color,box-shadow,opacity] duration-300',
										hasValue ? 'cursor-pointer' : 'cursor-default'
									)}
									style={{
										height: `${heightPct}%`,
										background: hasValue ? heatFill(dayStripIntensity(bucket.ms)) : STRIP_EMPTY_FILL,
										borderRadius: 'max(2px, calc(var(--radius) - 2px))',
										opacity: hasValue ? 1 : 0.72,
										...(isSelected ? { outline: '1.5px solid var(--primary)', outlineOffset: '2px' } : {}),
										...(isPeak ? { boxShadow: '0 0 14px color-mix(in srgb, var(--primary) 45%, transparent)' } : {}),
									}}
								/>
							</div>
							<div className="flex flex-col items-center leading-none">
								<span
									className={cn(
										'text-[11px] transition-colors',
										isSelected
											? 'font-semibold text-primary'
											: isPeak
												? 'font-semibold text-primary/90'
												: hasValue
													? 'text-muted-foreground group-hover:text-foreground'
													: 'text-muted-foreground/45'
									)}
								>
									{WEEKDAYS.find(w => w.index === bucket.weekday)?.label}
								</span>
								<span className="mt-1 text-[9px] text-muted-foreground/45">{bucket.date.getDate()}</span>
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

function YearWeeksStrip({
	weeks,
	selectedKey,
	onSelectWeek,
}: {
	weeks: Record<string, number>
	selectedKey: string | null
	onSelectWeek: (week: WeekBucket) => void
}) {
	const [hoveredKey, setHoveredKey] = useState<string | null>(null)
	const series = useMemo(() => getRhythmCalendarWeeks(weeks), [weeks])
	const currentKey = getWeekKey(new Date())
	const hoveredWeek = hoveredKey ? series.find(week => week.key === hoveredKey) ?? null : null
	const selectedWeek = selectedKey ? series.find(week => week.key === selectedKey) ?? null : null
	const currentWeek = series.find(week => week.key === currentKey) ?? null
	const featuredWeek = hoveredWeek ?? selectedWeek ?? currentWeek

	const monthMarks = useMemo(() => {
		const marks: { i: number; label: string }[] = []
		let last = -1
		series.forEach((w, i) => {
			const m = w.weekStart.getMonth()
			if (m !== last) {
				last = m
				marks.push({ i, label: MONTHS_SHORT[m] })
			}
		})
		return marks
	}, [series])

	return (
		<div className="space-y-2">
			<div className="flex h-5 items-center justify-center">
				<span
					className={cn(
						'rounded-full border px-2.5 py-0.5 font-data text-[10px] tabular-nums transition-colors',
						featuredWeek
							? 'border-primary/25 bg-primary/10 text-primary'
							: 'border-transparent text-muted-foreground/60'
					)}
				>
					{featuredWeek
						? `Semana ${formatWeekRange(featuredWeek.weekStart)} · ${
								featuredWeek.ms > 0 ? `TOTAL ${fmtTime(featuredWeek.ms)}` : 'SIN DATOS'
							}`
						: 'Pasa por una semana'}
				</span>
			</div>
			<div className="flex h-10 items-end gap-[2px]">
				{series.map(week => {
					const t = weekStripIntensity(week.ms)
					const isCurrent = week.key === currentKey
					const isSelected = selectedKey === week.key
					const hasValue = week.ms > 0
					// Every week keeps a small baseline bar so the year never has blank gaps.
					const heightPct = hasValue ? weekStripHeightPct(week.ms) : 10
					const rangeLabel = formatWeekRange(week.weekStart)
					return (
						<div
							key={week.key}
							className="flex h-full flex-1 items-end"
							onMouseEnter={() => setHoveredKey(week.key)}
							onMouseLeave={() => setHoveredKey(null)}
						>
							<button
								type="button"
								disabled={!hasValue}
								onClick={() => hasValue && onSelectWeek(week)}
								onFocus={() => setHoveredKey(week.key)}
								onBlur={() => setHoveredKey(null)}
								className={cn(
									'w-full transition-[height,background-color,box-shadow,opacity] duration-300',
									hasValue ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
								)}
								style={{
									height: `${heightPct}%`,
									background: hasValue ? heatFill(t) : STRIP_EMPTY_FILL,
									borderRadius: 'max(1px, calc(var(--radius) - 5px))',
									opacity: hasValue ? 1 : 0.72,
									...(isCurrent ? { outline: '1.5px solid var(--primary)', outlineOffset: '1px' } : {}),
									...(isSelected
										? {
												boxShadow:
													'0 0 0 1.5px var(--primary), 0 0 16px color-mix(in srgb, var(--primary) 35%, transparent)',
											}
										: {}),
								}}
								title={`Semana ${rangeLabel} · TOTAL ${fmtTime(week.ms)}${hasValue ? ' · clic para ver sus días' : ''}${isCurrent ? ' · esta semana' : ''}`}
								aria-label={
									hasValue
										? `Ver días de la semana ${rangeLabel}, TOTAL ${fmtTime(week.ms)}`
										: `Semana ${rangeLabel}, SIN DATOS`
								}
							/>
						</div>
					)
				})}
			</div>
			<div className="relative mt-1.5 h-3.5">
				{monthMarks.map(({ i, label }) => (
					<span
						key={`${label}-${i}`}
						className="absolute text-[9px] text-muted-foreground"
						style={{ left: `${(i / series.length) * 100}%` }}
					>
						{label}
					</span>
				))}
			</div>
		</div>
	)
}

// =============================================================================
// Main component
// =============================================================================

export const RhythmClock = memo(function RhythmClock({
	className,
	stats,
	username,
	headerSlot,
	onClearData,
	onSeedRandom,
}: {
	className?: string
	stats: RhythmStats
	/** Current user's name, stamped onto the shareable badge. */
	username?: string
	/** Slot rendered at the header's right edge (the view toggle). */
	headerSlot?: ReactNode
	onClearData?: () => void
	/** DEV ONLY: seeds random preview data (renders a dice button when provided). */
	onSeedRandom?: () => void
}) {
	const [subView, setSubView] = useState<'weekday' | 'weekly'>('weekday')
	const [hoverHour, setHoverHour] = useState<number | null>(null)
	const [pinnedHour, setPinnedHour] = useState<number | null>(null)
	const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null)
	const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null)
	const [shareOpen, setShareOpen] = useState(false)
	const todayWeekday = new Date().getDay()
	const selectedWeekStart = useMemo(
		() => (selectedWeekKey ? parseLocalDateKey(selectedWeekKey) : null),
		[selectedWeekKey]
	)
	const inDay = selectedWeekday !== null
	const isViewingToday = selectedWeekday === todayWeekday

	// Per-day averages: an hour-of-day can't exceed 1h and a day can't exceed 24h, so we
	// divide the cumulative buckets by the number of relevant days.
	const activeDayCount = useMemo(() => getActiveDayCount(stats.days), [stats.days])
	const weekdayCounts = useMemo(() => getWeekdayCounts(stats.days), [stats.days])
	const denom = inDay ? Math.max(1, weekdayCounts[selectedWeekday as number]) : activeDayCount
	const dailyAverageMs = useMemo(
		() => getAverageRhythmHours(stats.hours, activeDayCount).reduce((acc, ms) => acc + ms, 0),
		[stats.hours, activeDayCount]
	)

	// Clock data source: a specific weekday's hours (averaged per occurrence) or all
	// days aggregated (averaged per active day).
	const effectiveHours = useMemo(() => {
		const raw = inDay ? stats.weekdayHours[String(selectedWeekday)] ?? Array(24).fill(0) : stats.hours
		return getAverageRhythmHours(raw, denom)
	}, [stats, selectedWeekday, inDay, denom])

	const view = useMemo(() => {
		const contextMs = effectiveHours.reduce((a, b) => a + b, 0)
		const hasData = contextMs > 0
		const hasEnoughData = hasEnoughRhythmData(stats)
		const peakHour = getPeakHour(effectiveHours)
		const peakHours = getPeakHours(effectiveHours)
		const archetype = getArchetype(peakHour)
		const band = getActiveBand(effectiveHours)
		return { hasData, hasEnoughData, peakHour, peakHours, archetype, band, contextMs }
	}, [effectiveHours, stats])

	const { hasData, hasEnoughData, peakHour, peakHours, archetype, band, contextMs } = view
	const showInsights = hasData && hasEnoughData
	const shareReadiness = useMemo(() => getRhythmShareReadiness(stats), [stats])
	const weeklyAvailable = hasWeeklyData(stats.weeks)
	const selectedWeekTotalMs = selectedWeekKey ? Number(stats.weeks[selectedWeekKey]) || 0 : 0

	const selectWeekday = (wd: number | null) => {
		setSelectedWeekday(wd)
		setHoverHour(null)
		setPinnedHour(null)
	}

	const selectWeek = (week: WeekBucket) => {
		setSelectedWeekKey(week.key)
		selectWeekday(null)
	}

	const clearSelectedWeek = () => {
		setSelectedWeekKey(null)
		selectWeekday(null)
	}

	const returnToCurrentDay = () => {
		if (selectedWeekStart) {
			selectWeekday(null)
			return
		}
		selectWeekday(todayWeekday)
	}

	// The hour the center + clock highlight reflect: hovered, else pinned, else peak.
	const activeHour = hoverHour ?? pinnedHour ?? peakHour
	const isExplicit = hoverHour !== null || pinnedHour !== null

	// Dónde: a specific weekday's subforums, else this hour's (on hover/pin), else the
	// all-day breakdown — all shown as the average time per (relevant) day.
	const dondeSubs = useMemo(() => {
		const raw = inDay
			? getWeekdaySubforums(stats.weekdaySubforums, selectedWeekday as number, 50)
			: isExplicit
			? getTopSubforumsForHour(stats.hourSubforums, activeHour, 50)
			: getSubforumTotals(stats.hourSubforums, 50)
		return getAverageSubforumTimes(raw, denom, 50)
	}, [stats, selectedWeekday, inDay, isExplicit, activeHour, denom])
	const dondeScope = inDay
		? `${WEEKDAY_FULL[selectedWeekday as number]} · media`
		: isExplicit
		? hourRange(activeHour)
		: 'todo el día'

	return (
		<div className={className}>
			<Card className="border-border/50 bg-card/50 dark:bg-muted/20">
				<CardHeader className="pb-4">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Clock className="h-5 w-5 text-primary" />
							<div>
								<CardTitle className="text-lg font-semibold text-foreground">Tiempo en Mediavida</CardTitle>
								<p className="text-xs text-muted-foreground">Cuándo y dónde sueles estar en Mediavida</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Popover>
								<PopoverTrigger asChild>
									<button
										className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
										aria-label="Cómo funciona Tiempo en Mediavida"
										title="Cómo funciona"
									>
										<Info className="h-4 w-4" />
									</button>
								</PopoverTrigger>
								<PopoverContent side="top" align="end" sideOffset={10} className="w-[320px]">
									<div className="space-y-3">
										<div>
											<p className="text-sm font-semibold text-foreground">Cómo funciona “Tiempo en Mediavida”</p>
											<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
												Resume tu <b className="text-foreground">media diaria</b> en Mediavida a partir del tiempo que la
												pestaña está abierta y visible.
											</p>
										</div>
										<div className="grid gap-2.5">
											<RhythmHelpItem icon={Clock} title="Reloj">
												24 barras, una por hora del día; más larga y brillante = más tiempo medio en esa hora.
											</RhythmHelpItem>
											<RhythmHelpItem icon={MapPin} title="Dónde">
												muestra los subforos de la hora activa, o el reparto del día si no hay una hora fijada.
											</RhythmHelpItem>
											<RhythmHelpItem icon={CalendarDays} title="Día">
												compara medias por día de la semana y selecciona lunes, martes, etc.
											</RhythmHelpItem>
											<RhythmHelpItem icon={CalendarDays} title="Semana">
												revisa el total semanal del año y abre una semana para ver sus días concretos.
											</RhythmHelpItem>
											<RhythmHelpItem icon={Info} title="Media diaria general">
												es tu tiempo medio por día activo en Mediavida; aparece como referencia en todas las vistas.
											</RhythmHelpItem>
										</div>
									</div>
								</PopoverContent>
							</Popover>
							{headerSlot}
							{hasData && (
								<span
									className={cn(
										'hidden items-center rounded-md border px-2 py-1 text-[11px] font-medium sm:inline-flex',
										shareReadiness.canShare
											? 'border-primary/30 bg-primary/10 text-primary'
											: 'border-border/60 bg-muted/30 text-muted-foreground'
									)}
								>
									{shareReadiness.canShare
										? 'Listo para compartir'
										: `Faltan ${fmtTime(shareReadiness.remainingMs)} para compartir`}
								</span>
							)}
							<button
								type="button"
								onClick={() => setShareOpen(true)}
								className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary/45 hover:bg-primary/15"
								aria-label="Compartir resumen"
								title="Compartir resumen"
							>
								<Share2 className="h-4 w-4" />
								<span className="hidden sm:inline">Compartir</span>
							</button>
							{onSeedRandom && (
								<button
									onClick={onSeedRandom}
									className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
									aria-label="Generar datos aleatorios (dev)"
									title="Generar datos aleatorios (dev)"
								>
									<Dices className="h-4 w-4" />
								</button>
							)}
							{onClearData && (
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<button
											className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
											aria-label="Borrar ritmo"
											title="Borrar datos de ritmo"
										>
											<Trash2 className="h-4 w-4" />
										</button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>¿Borrar Tiempo en Mediavida?</AlertDialogTitle>
											<AlertDialogDescription>
												Se eliminará el registro de a qué horas, días y subforos navegas. Esta acción no se puede
												deshacer y los datos se volverán a acumular desde cero.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancelar</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => onClearData?.()}
												className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
											>
												Borrar
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							)}
						</div>
					</div>
				</CardHeader>

				<CardContent>
					{/* Top: clock + details, centered together as the hero */}
					<div className="flex flex-col items-center justify-center gap-8 lg:flex-row lg:items-center lg:gap-12">
						<div className="relative flex w-full max-w-[400px] items-center justify-center">
							<div
								aria-hidden
								className="pointer-events-none absolute h-3/4 w-3/4 rounded-full opacity-30 blur-3xl"
								style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)' }}
							/>
							<svg
								viewBox={`${-MARGIN} ${-MARGIN} ${SIZE + MARGIN * 2} ${SIZE + MARGIN * 2}`}
								className="relative h-auto w-full"
								role="img"
								aria-label={
									showInsights
										? `Reloj de actividad, hora punta a las ${peakHour}h`
										: hasData
										? 'Reloj de actividad, pocos datos aún'
										: 'Reloj de actividad, sin datos aún'
								}
								onMouseLeave={() => setHoverHour(null)}
							>
								<defs>
									<filter id="mvpRingShadow" x="-20%" y="-20%" width="140%" height="140%">
										<feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="black" floodOpacity="0.35" />
									</filter>
									<radialGradient id="mvpWedgeSheen" gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={R_RING_OUTER}>
										<stop offset="0.6" stopColor="white" stopOpacity={0} />
										<stop offset="0.86" stopColor="white" stopOpacity={0.1} />
										<stop offset="1" stopColor="white" stopOpacity={0} />
									</radialGradient>
									<linearGradient id="mvpDiscBevel" gradientUnits="userSpaceOnUse" x1={CX} y1={CY - R_CENTER} x2={CX} y2={CY + R_CENTER}>
										<stop offset="0" stopColor="white" stopOpacity={0.1} />
										<stop offset="0.5" stopColor="white" stopOpacity={0} />
										<stop offset="1" stopColor="black" stopOpacity={0.22} />
									</linearGradient>
								</defs>
								<g filter={hasData ? 'url(#mvpRingShadow)' : undefined}>
								{effectiveHours.map((value, hour) => {
									// Clock buckets are capped to 1h, so 1h is the literal visual maximum.
									const t = clockIntensity(value)
									const outer = R_MIN_OUTER + t * (R_RING_OUTER - R_MIN_OUTER)
									const isPinned = !inDay && pinnedHour === hour
									const isHover = hoverHour === hour
									const isPeakDefault = !isExplicit && showInsights && hour === peakHour
									const stroke = isPinned
										? 'var(--primary)'
										: isHover
										? primaryMix(70)
										: isPeakDefault
										? primaryMix(40)
										: 'transparent'
									const sw = isPinned ? 2.5 : isHover || isPeakDefault ? 1.5 : 0
									// Pin marker lives in the inner gap (between disc and ring), away from labels.
									const [dotX, dotY] = polarHour(hour, (R_CENTER + R_RING_INNER) / 2)
									return (
										<g key={hour}>
											<path
												d={wedgePath(hour, outer)}
												fill={heatFill(t)}
												stroke={stroke}
												strokeWidth={sw}
												// outline:none — focus is shown via the wedge stroke (onFocus), so the
												// browser's default focus rectangle would just look like an ugly white box.
												style={{ cursor: 'pointer', outline: 'none' }}
												onMouseEnter={() => setHoverHour(hour)}
												role="button"
												tabIndex={0}
												aria-label={`${hourRange(hour)}, ${fmtTime(value)}`}
												aria-pressed={isPinned}
												onClick={() => setPinnedHour(prev => (prev === hour ? null : hour))}
												onFocus={() => setHoverHour(hour)}
												onBlur={() => setHoverHour(null)}
												onKeyDown={event => {
													if (event.key === 'Enter' || event.key === ' ') {
														event.preventDefault()
														setPinnedHour(prev => (prev === hour ? null : hour))
													}
												}}
											>
												<title>{`${hourRange(hour)} · ${fmtTime(value)}`}</title>
											</path>
											{isPinned && <circle cx={dotX} cy={dotY} r={2.5} fill="var(--primary)" pointerEvents="none" />}
										</g>
									)
								})}
								</g>
								{hasData && (
									<circle
										cx={CX}
										cy={CY}
										r={R_RING_OUTER}
										fill="url(#mvpWedgeSheen)"
										pointerEvents="none"
										style={{ mixBlendMode: 'overlay' }}
									/>
								)}

								{HOUR_TICKS.map(({ label, hour }) => {
									const [x, y] = polarHour(hour, R_RING_OUTER + 18)
									return (
										<text
											key={label}
											x={x}
											y={y}
											fill="var(--muted-foreground)"
											fontSize={12}
											fontFamily="var(--font-data)"
											textAnchor="middle"
											dominantBaseline="middle"
										>
											{label}
										</text>
									)
								})}

								<circle
									cx={CX}
									cy={CY}
									r={R_CENTER}
									fill="var(--card)"
									stroke="color-mix(in srgb, var(--border) 80%, transparent)"
									strokeWidth={1}
								/>
								<circle
									cx={CX}
									cy={CY}
									r={R_CENTER}
									fill="url(#mvpDiscBevel)"
									pointerEvents="none"
								/>
								<text
									x={CX}
									y={CY - 4}
									fill="var(--foreground)"
									fontSize={28}
									fontWeight={600}
									fontFamily="var(--font-data)"
									textAnchor="middle"
								>
									{showInsights || isExplicit ? hourLabel(activeHour) : '—'}
								</text>
								<text
									x={CX}
									y={CY + 20}
									fill="var(--muted-foreground)"
									fontSize={11}
									fontFamily="var(--font-sans)"
									textAnchor="middle"
								>
									{isExplicit
										? 'a esta hora'
										: !hasData
										? 'sin datos aún'
										: !hasEnoughData
										? 'pocos datos aún'
										: peakHours.length > 1
										? 'una de tus horas punta'
										: 'tu hora punta'}
								</text>
							</svg>
						</div>

						{/* details column */}
						<div className="relative w-full max-w-[440px] space-y-4 lg:pl-2">
							{showInsights && (
								<span
									aria-hidden
									className="pointer-events-none absolute -left-8 top-[47%] hidden h-px w-6 bg-gradient-to-r from-primary/50 to-transparent lg:block"
								/>
							)}
							{showInsights ? (
								<div className="relative pl-4">
									<span
										aria-hidden
										className="absolute left-0 top-1 bottom-1 w-px bg-gradient-to-b from-primary via-primary/45 to-transparent"
									/>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<div className="font-data text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
												Media diaria general
											</div>
										</div>
										<div className="mt-1 font-data text-[1.65rem] font-bold leading-none tabular-nums text-foreground">
											{fmtTime(dailyAverageMs)}
										</div>
										<p className="mt-1.5 text-xs text-muted-foreground">
											tiempo medio al día en Mediavida
										</p>
										{inDay && (
											<div
												className="mt-2 inline-flex items-center gap-1.5 border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs text-primary"
												style={segmentedRadiusStyle}
											>
												<CalendarDays className="h-3.5 w-3.5" />
												<span className="text-primary/75">Vista</span>
												<span className="font-semibold">{WEEKDAY_FULL[selectedWeekday as number]}</span>
												{(selectedWeekStart || !isViewingToday) && (
													<button
														type="button"
														onClick={returnToCurrentDay}
														className="ml-1 border border-primary/40 bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-[0_0_12px_-8px_var(--primary)] transition-colors hover:bg-primary/90"
														style={segmentedItemRadiusStyle}
													>
														{selectedWeekStart ? 'Volver a semana' : 'Ver día actual'}
													</button>
												)}
											</div>
										)}
									</div>

									<dl className="mt-3 grid gap-1.5 text-xs">
										<div className="flex items-center gap-2">
											<dt className="w-[92px] shrink-0 text-muted-foreground">Ritmo</dt>
											<dd className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground">
												<span className="text-sm leading-none" aria-hidden>
													{archetype.emoji}
												</span>
												<span>{archetype.label}</span>
											</dd>
										</div>
										<div className="flex items-center gap-2">
											<dt className="w-[92px] shrink-0 text-muted-foreground">
												{peakHours.length > 1 ? 'Horas punta' : 'Hora punta'}
											</dt>
											<dd className="font-data font-medium tabular-nums text-foreground">
												{peakHours.length > 1 ? formatPeakHours(peakHours) : hourRange(peakHour)}
											</dd>
										</div>
										{band && (
											<div className="flex items-center gap-2">
												<dt className="w-[92px] shrink-0 text-muted-foreground">Franja activa</dt>
												<dd className="font-data font-medium tabular-nums text-foreground">
													{hourLabel(band.start)}–{String(band.end).padStart(2, '0')}:59
												</dd>
											</div>
										)}
									</dl>
								</div>
							) : (
								<div className="rounded-lg border border-border/60 bg-background/30 px-4 py-3">
									<p className="text-sm font-semibold text-foreground">
										{hasData ? 'Pocos datos aún' : 'Aún sin datos'}
									</p>
									<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
										{hasData
											? `Hay ${fmtTime(contextMs)} en esta vista. Cuando el total supere 1m, verás patrones fiables.`
											: 'Tu tiempo se irá dibujando a medida que navegues por Mediavida.'}
									</p>
								</div>
							)}

							<DondePanel
								scopeLabel={dondeScope}
								subs={dondeSubs}
								hasData={hasData}
								pinned={!inDay && pinnedHour !== null && activeHour === pinnedHour}
							/>

							<div
								className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
								title="Escala del reloj: una hora media llena el bloque; menos tiempo queda más corto y tenue."
							>
								<span>Menos tiempo</span>
								<i className="h-3 w-3 rounded-[3px]" style={{ background: FAINT_FILL }} />
								<i className="h-3 w-3 rounded-[3px]" style={{ background: primaryMix(40) }} />
								<i className="h-3 w-3 rounded-[3px]" style={{ background: primaryMix(70) }} />
								<i className="h-3 w-3 rounded-[3px]" style={{ background: 'var(--primary)' }} />
								<span>Más tiempo</span>
							</div>
						</div>
					</div>

					{/* Band: weekday / year-weeks heatmap strips */}
					<div className="mt-6 border-t border-border/60 pt-5">
						<div className="mb-3 flex items-center justify-between gap-2">
							<div className="flex min-w-0 items-center gap-1.5">
								<span
									className="truncate font-data text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
									title={
										subView === 'weekday'
											? 'Cada barra resume la media de ese día de la semana.'
											: selectedWeekStart
												? 'Días reales de la semana seleccionada; al abrir uno se selecciona ese día de la semana.'
												: 'Cada barra resume el tiempo total acumulado en una semana.'
									}
								>
								{subView === 'weekday'
									? 'Días de la semana · media por día'
									: selectedWeekStart
										? `Semana ${formatWeekRange(selectedWeekStart)} · TOTAL ${fmtTime(selectedWeekTotalMs)}`
										: `Semanas de ${new Date().getFullYear()} · total semanal`}
								</span>
								<RhythmScopeHelp subView={subView} inSelectedWeek={Boolean(selectedWeekStart)} />
							</div>
							<div className="flex items-center gap-2">
								{subView === 'weekly' && selectedWeekStart && (
									<button
										type="button"
										onClick={clearSelectedWeek}
										className="inline-flex items-center gap-1 border border-border/70 bg-background/45 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary"
										style={segmentedItemRadiusStyle}
									>
										<ArrowLeft className="h-3 w-3" />
										Volver a semanas
									</button>
								)}
								<div
									className="inline-flex gap-0.5 border border-border/70 bg-background/50 p-0.5"
									style={segmentedRadiusStyle}
								>
									<button
										type="button"
										onClick={() => {
											setSubView('weekday')
											setSelectedWeekKey(null)
										}}
										style={segmentedItemRadiusStyle}
										className={cn(
											'px-2 py-0.5 text-[10px] font-semibold transition-colors',
											subView === 'weekday'
												? 'bg-primary text-primary-foreground'
												: 'text-muted-foreground hover:text-foreground'
										)}
									>
										Día
									</button>
									<button
										type="button"
										disabled={!weeklyAvailable}
										onClick={() => weeklyAvailable && setSubView('weekly')}
										title={weeklyAvailable ? undefined : 'Disponible cuando haya pasado al menos una semana'}
										style={segmentedItemRadiusStyle}
										className={cn(
											'px-2 py-0.5 text-[10px] font-semibold transition-colors',
											subView === 'weekly'
												? 'bg-primary text-primary-foreground'
												: weeklyAvailable
													? 'text-muted-foreground hover:text-foreground'
													: 'cursor-not-allowed text-muted-foreground/40'
										)}
									>
										Semana
									</button>
								</div>
							</div>
						</div>

						{subView === 'weekday' ? (
							<WeekdayStrip
								stats={stats}
								counts={weekdayCounts}
								selected={selectedWeekday}
								onSelect={selectWeekday}
								todayWeekday={todayWeekday}
								showPeak={hasEnoughData}
							/>
						) : selectedWeekStart ? (
							<WeekDaysStrip
								days={stats.days}
								weekStart={selectedWeekStart}
								selectedWeekday={selectedWeekday}
								onSelectDay={selectWeekday}
							/>
						) : (
							<YearWeeksStrip weeks={stats.weeks} selectedKey={selectedWeekKey} onSelectWeek={selectWeek} />
						)}
					</div>
				</CardContent>
			</Card>
			<RhythmShareDialog
				open={shareOpen}
				onOpenChange={setShareOpen}
				stats={stats}
				username={username}
				selectedWeekKey={selectedWeekKey}
				selectedWeekday={selectedWeekday}
			/>
		</div>
	)
})
