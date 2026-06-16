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
import { getSubforumName } from '@/lib/subforums'
import { getDayKey, getWeekKey, getWeekStart, type RhythmStats } from '../logic/rhythm-model'
import {
	getRhythmShareAvailability,
	MIN_SHARE_RHYTHM_MS,
	type RhythmShareAvailability,
	type RhythmShareScope,
} from '../logic/rhythm-share-availability'
import {
	getActiveBand,
	getArchetype,
	getAverageRhythmHours,
	getDailyAverageForDays,
	getPeakHour,
	getRhythmCalendarWeeks,
	getRhythmDailyAverageHours,
	getRhythmDailyAverageMs,
	getRhythmWeekDays,
	getSubforumTotals,
	getSubforumTotalsForDays,
	getWeekdayCounts,
	getWeekdaySubforums,
	hasEnoughRhythmData,
	type WeekBucket,
} from '../logic/rhythm-insights'

type ShareScope = RhythmShareScope

interface RhythmShareDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	stats: RhythmStats
	username?: string
	selectedWeekKey?: string | null
	selectedWeekday?: number | null
}

interface ShareBar {
	label: string
	value: number
}

interface ShareForum {
	label: string
	value: string
}

interface ShareSummary {
	scope: ShareScope
	period: string
	story: string
	mainLabel: string
	mainValue: string
	mainCaption: string
	secondaryLabel: string
	secondaryValue: string
	hours: number[]
	peakLabel: string
	bandLabel: string
	archetypeLabel: string
	archetypeEmoji: string
	forumTitle: string
	forums: ShareForum[]
	barTitle: string
	bars: ShareBar[]
	hasEnoughData: boolean
	username?: string
	fileName: string
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

type DocumentWithFonts = Document & {
	fonts?: {
		load?: (font: string, text?: string) => Promise<FontFace[]>
		ready?: Promise<unknown>
	}
}

const WEEKDAY_LABELS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const WEEKDAY_PLURAL_ES = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const CANVAS_WIDTH = 1280
const CANVAS_HEIGHT = 1600
const CANVAS_SCALE = 2
const HOUR_BUCKET_MAX_MS = 60 * 60_000

const CENTER_X = CANVAS_WIDTH / 2
const CONTENT_LEFT = 96
const CONTENT_RIGHT = CANVAS_WIDTH - 96
const CONTENT_W = CONTENT_RIGHT - CONTENT_LEFT
const FRAME = { x: 36, y: 36, w: CANVAS_WIDTH - 72, h: CANVAS_HEIGHT - 72, r: 12 } as const
/** Single corner radius shared by every rectangular surface for a uniform, straight look. */
const UI_RADIUS = 12
/** Display ("Grotesk") font used for headings and feature names, matching the dashboard. */
const DISPLAY_FONT_PRIMARY = '"Bricolage Grotesque Variable"'
const DISPLAY_FONT = `${DISPLAY_FONT_PRIMARY}, "Bricolage Grotesque", "Instrument Sans Variable", system-ui, sans-serif`
const SANS_FONT_PRIMARY = '"Instrument Sans Variable"'
const SANS_FONT = `${SANS_FONT_PRIMARY}, "Instrument Sans", system-ui, sans-serif`
const DATA_FONT_PRIMARY = '"Spline Sans Mono Variable"'
const DATA_FONT = `${DATA_FONT_PRIMARY}, "Spline Sans Mono", ui-monospace, monospace`

const CANVAS_FONT_LOADS = [
	`800 60px ${DISPLAY_FONT_PRIMARY}`,
	`750 24px ${SANS_FONT_PRIMARY}`,
	`900 48px ${DATA_FONT_PRIMARY}`,
] as const

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

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`
const hourRange = (hour: number) => `${String(hour).padStart(2, '0')}:00-${String(hour).padStart(2, '0')}:59`

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

function slugifyFilePart(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
}

function getBestWeekday(stats: RhythmStats): number {
	const counts = getWeekdayCounts(stats.days)
	let best = 1
	let bestValue = 0
	for (const index of [1, 2, 3, 4, 5, 6, 0]) {
		const value = (Number(stats.weekdays[index]) || 0) / Math.max(1, counts[index])
		if (value > bestValue) {
			best = index
			bestValue = value
		}
	}
	return best
}

function getDefaultWeekKey(stats: RhythmStats, selectedWeekKey?: string | null): string {
	const weeks = getRhythmCalendarWeeks(stats.weeks).filter(week => week.ms > 0)
	if (selectedWeekKey && weeks.some(week => week.key === selectedWeekKey)) return selectedWeekKey
	const currentKey = getWeekKey(new Date())
	if (weeks.some(week => week.key === currentKey)) return currentKey
	const bestWeek = weeks.reduce<WeekBucket | null>((best, week) => (!best || week.ms > best.ms ? week : best), null)
	return bestWeek?.key ?? currentKey
}

/** Day keys ('YYYY-MM-DD') that belong to the selected period. */
function subforumDayKeys(stats: RhythmStats, scope: ShareScope, weekKey: string, now = new Date()): string[] {
	if (scope === 'last30') {
		return Array.from({ length: 30 }, (_, offset) => {
			const date = new Date(now)
			date.setDate(now.getDate() - offset)
			return getDayKey(date)
		})
	}
	if (scope === 'week') {
		return getRhythmWeekDays(stats.days, findWeek(stats, weekKey).weekStart).map(day => day.key)
	}
	// year: every day of the current calendar year up to today.
	const keys: string[] = []
	const cursor = new Date(now.getFullYear(), 0, 1)
	while (cursor.getTime() <= now.getTime()) {
		keys.push(getDayKey(cursor))
		cursor.setDate(cursor.getDate() + 1)
	}
	return keys
}

/**
 * Top subforums by accumulated time, scoped to the selected period (year / 30 days
 * / week) from the per-day breakdown. The "día" view keeps the weekday breakdown.
 * Legacy fallback: the year view borrows the all-time totals when per-day data is
 * still empty, so older installs aren't shown a blank ranking.
 */
function buildForums(stats: RhythmStats, scope: ShareScope, weekKey: string, weekday: number): ShareForum[] {
	let raw =
		scope === 'weekday'
			? getWeekdaySubforums(stats.weekdaySubforums, weekday, 3)
			: getSubforumTotalsForDays(stats.daySubforums, subforumDayKeys(stats, scope, weekKey), 3)
	if (raw.length === 0 && scope === 'year') {
		raw = getSubforumTotals(stats.hourSubforums, 3)
	}
	return raw.map(item => ({
		label: getSubforumName(item.slug) || item.slug,
		value: fmtTime(item.ms),
	}))
}

function buildYearBars(stats: RhythmStats): ShareBar[] {
	const weeks = getRhythmCalendarWeeks(stats.weeks)
	return MONTHS_SHORT.map((label, month) => ({
		label,
		value: weeks
			.filter(week => week.weekStart.getMonth() === month)
			.reduce((total, week) => total + week.ms, 0),
	}))
}

function buildWeekdayBars(stats: RhythmStats): ShareBar[] {
	const counts = getWeekdayCounts(stats.days)
	return [1, 2, 3, 4, 5, 6, 0].map(weekday => ({
		label: WEEKDAY_SHORT[weekday],
		value: (Number(stats.weekdays[weekday]) || 0) / Math.max(1, counts[weekday]),
	}))
}

function buildLast30DaysBars(stats: RhythmStats, now = new Date()): ShareBar[] {
	return Array.from({ length: 30 }, (_, offset) => {
		const date = new Date(now)
		date.setDate(now.getDate() - (29 - offset))
		return {
			label: `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`,
			value: Math.max(0, Number(stats.days[getDayKey(date)]) || 0),
		}
	})
}

function findWeek(stats: RhythmStats, weekKey: string): WeekBucket {
	const weeks = getRhythmCalendarWeeks(stats.weeks)
	const found = weeks.find(week => week.key === weekKey)
	if (found) return found
	const currentStart = getWeekStart(new Date())
	return { key: getWeekKey(currentStart), weekStart: currentStart, ms: 0 }
}

function buildShareSummary(
	stats: RhythmStats,
	scope: ShareScope,
	weekKey: string,
	weekday: number,
	username?: string
): ShareSummary {
	const year = new Date().getFullYear()
	const dailyAverageMs = getRhythmDailyAverageMs(stats)
	const yearDailyAverageMs = getDailyAverageForDays(stats.days, subforumDayKeys(stats, 'year', weekKey))
	const hasEnoughData = hasEnoughRhythmData(stats)
	let period = `Resumen ${year}`
	let mainLabel = `TOTAL ${year}`
	let mainValue = fmtTime(buildYearBars(stats).reduce((total, bar) => total + bar.value, 0))
	let mainCaption = `Media diaria ${year}: ${fmtTime(yearDailyAverageMs)}`
	let secondaryLabel = 'Días activos'
	let secondaryValue = String(Object.keys(stats.days).length)
	let hours = getRhythmDailyAverageHours(stats)
	let bars = buildYearBars(stats)
	let barTitle = 'Total por mes'
	let forumTitle = 'Subforos habituales'

	if (scope === 'last30') {
		bars = buildLast30DaysBars(stats)
		const total = bars.reduce((acc, bar) => acc + bar.value, 0)
		period = 'Últimos 30 días'
		mainLabel = 'TOTAL 30 DÍAS'
		mainValue = fmtTime(total)
		mainCaption = 'Tiempo total registrado en los últimos 30 días.'
		secondaryLabel = 'Media diaria general'
		secondaryValue = fmtTime(getDailyAverageForDays(stats.days, subforumDayKeys(stats, 'last30', weekKey)))
		mainCaption = `Media diaria 30 d\u00edas: ${secondaryValue}`
		barTitle = 'Total por día'
		forumTitle = 'Subforos habituales'
	}

	if (scope === 'week') {
		const week = findWeek(stats, weekKey)
		const weekDays = getRhythmWeekDays(stats.days, week.weekStart)
		period = `Semana ${formatWeekRange(week.weekStart)}`
		mainLabel = 'TOTAL SEMANAL'
		mainValue = fmtTime(week.ms)
		mainCaption = 'Tiempo total registrado en esa semana.'
		secondaryLabel = 'Media diaria general'
		secondaryValue = fmtTime(getDailyAverageForDays(stats.days, weekDays.map(day => day.key)))
		mainCaption = `Media diaria semanal: ${secondaryValue}`
		bars = weekDays.map(day => ({ label: `${WEEKDAY_SHORT[day.weekday]} ${day.date.getDate()}`, value: day.ms }))
		barTitle = 'Días de la semana seleccionada'
		forumTitle = 'Subforos habituales'
	}

	if (scope === 'weekday') {
		const counts = getWeekdayCounts(stats.days)
		const denominator = Math.max(1, counts[weekday])
		const weekdayHours = stats.weekdayHours[String(weekday)] ?? Array(24).fill(0)
		const weekdayAverage = (Number(stats.weekdays[weekday]) || 0) / denominator
		period = `Media de ${WEEKDAY_LABELS_ES[weekday]}`
		mainLabel = `MEDIA ${WEEKDAY_LABELS_ES[weekday].toUpperCase()}`
		mainValue = fmtTime(weekdayAverage)
		mainCaption = 'Media de ese día de la semana, no una fecha concreta.'
		secondaryLabel = 'Media diaria general'
		secondaryValue = fmtTime(dailyAverageMs)
		mainCaption = `Frente a tu media general: ${secondaryValue}`
		hours = getAverageRhythmHours(weekdayHours, denominator)
		bars = buildWeekdayBars(stats)
		barTitle = 'Media por día de la semana'
		forumTitle = `Subforos de ${WEEKDAY_LABELS_ES[weekday]}`
	}

	const peakHour = getPeakHour(hours)
	const archetype = hasEnoughData ? getArchetype(peakHour) : { emoji: '·', label: 'Pocos datos' }
	const band = hasEnoughData ? getActiveBand(hours) : null
	const forums = buildForums(stats, scope, weekKey, weekday)
	const topForum = forums[0]?.label
	const badgeUsername = username && username.trim().toLowerCase() !== 'usuario' ? username.trim() : undefined

	// Story adapts its framing to the selected period so each view reads distinctly.
	const peak = hourLabel(peakHour)
	const forumPart = topForum ? ` y mucho paso por ${topForum}` : ''
	const archetypeLower = archetype.label.toLowerCase()
	let story: string
	if (!hasEnoughData) {
		story = 'Todavía se está formando tu tiempo en Mediavida.'
	} else if (scope === 'last30') {
		story = `Estos 30 días: ${archetypeLower}, con pico a las ${peak}${forumPart}.`
	} else if (scope === 'week') {
		story = `Esa semana: ${archetypeLower}, con pico a las ${peak}${forumPart}.`
	} else if (scope === 'weekday') {
		story = `Tus ${WEEKDAY_PLURAL_ES[weekday]}: ${archetypeLower}, con pico a las ${peak}${forumPart}.`
	} else {
		story = `${archetype.label}, con pico a las ${peak}${forumPart}.`
	}
	if (hasEnoughData) {
		const storyScope =
			scope === 'last30'
				? '\u00daltimos 30 d\u00edas'
				: scope === 'week'
					? 'Semana seleccionada'
					: scope === 'weekday'
						? WEEKDAY_LABELS_ES[weekday]
						: null
		story = [
			storyScope,
			archetype.label,
			`pico a las ${peak}`,
			topForum ? `${topForum} como zona principal` : null,
		]
			.filter(Boolean)
			.join(' \u00b7 ')
	}

	return {
		scope,
		period,
		story,
		mainLabel,
		mainValue,
		mainCaption,
		secondaryLabel,
		secondaryValue,
		hours,
		peakLabel: hasEnoughData ? hourRange(peakHour) : 'Aún sin patrón',
		bandLabel: band ? `${hourLabel(band.start)}-${String(band.end).padStart(2, '0')}:59` : 'Aún sin tramo',
		archetypeLabel: archetype.label,
		archetypeEmoji: archetype.emoji,
		forumTitle,
		forums,
		barTitle,
		bars,
		hasEnoughData,
		username: badgeUsername,
		fileName: `mediavida-ritmo-${slugifyFilePart(period)}.png`,
	}
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
	const radius = Math.min(r, w / 2, h / 2)
	ctx.beginPath()
	ctx.moveTo(x + radius, y)
	ctx.lineTo(x + w - radius, y)
	ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
	ctx.lineTo(x + w, y + h - radius)
	ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
	ctx.lineTo(x + radius, y + h)
	ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
	ctx.lineTo(x, y + radius)
	ctx.quadraticCurveTo(x, y, x + radius, y)
	ctx.closePath()
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
	if (ctx.measureText(text).width <= maxWidth) return text
	let next = text
	while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
		next = next.slice(0, -1)
	}
	return `${next}...`
}

function setFittedFont(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
	weight: number,
	size: number,
	family: string,
	minSize = 28
): void {
	let nextSize = size
	do {
		ctx.font = `${weight} ${nextSize}px ${family}`
		if (ctx.measureText(text).width <= maxWidth || nextSize <= minSize) return
		nextSize -= 3
	} while (nextSize > minSize)
}

function drawSoftCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
	roundedRect(ctx, x, y, w, h, UI_RADIUS)
	ctx.fillStyle = 'rgba(9, 12, 17, 0.74)'
	ctx.fill()
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
	ctx.lineWidth = 1.5
	ctx.stroke()
}

type CanvasWithTracking = CanvasRenderingContext2D & { letterSpacing: string }

/** Set canvas letter-spacing (supported in modern Chrome/Firefox; no-op otherwise). */
function setTracking(ctx: CanvasRenderingContext2D, value: string): void {
	;(ctx as CanvasWithTracking).letterSpacing = value
}

function drawMetricTile(
	ctx: CanvasRenderingContext2D,
	label: string,
	value: string,
	x: number,
	y: number,
	w: number
): void {
	ctx.save()
	drawSoftCard(ctx, x, y, w, 96)
	const midX = x + w / 2
	ctx.textAlign = 'center'
	ctx.fillStyle = 'rgba(94, 234, 212, 0.85)'
	ctx.font = `850 12px ${DATA_FONT}`
	setTracking(ctx, '2px')
	ctx.fillText(label.toUpperCase(), midX, y + 32)
	setTracking(ctx, '0px')

	// Premium accent divider: teal core fading out symmetrically.
	const sepW = 48
	const sep = ctx.createLinearGradient(midX - sepW / 2, 0, midX + sepW / 2, 0)
	sep.addColorStop(0, 'rgba(94, 234, 212, 0)')
	sep.addColorStop(0.5, 'rgba(94, 234, 212, 0.6)')
	sep.addColorStop(1, 'rgba(94, 234, 212, 0)')
	ctx.fillStyle = sep
	ctx.fillRect(midX - sepW / 2, y + 44, sepW, 2)

	ctx.fillStyle = '#f8fafc'
	setFittedFont(ctx, value, w - 36, 900, 28, DATA_FONT, 16)
	ctx.fillText(value, midX, y + 76)
	ctx.restore()
}

/** Big hero time, horizontally centered on `cx`: bold hours + amber minutes/seconds. */
function drawMainTime(ctx: CanvasRenderingContext2D, value: string, cx: number, y: number): void {
	const [head = value, ...restParts] = value.split(' ')
	const rest = restParts.join(' ')
	ctx.save()
	ctx.textAlign = 'left'
	setFittedFont(ctx, head, 680, 950, 96, DATA_FONT, 58)
	const headWidth = ctx.measureText(head).width
	let restWidth = 0
	if (rest) {
		ctx.save()
		ctx.font = `900 42px ${DATA_FONT}`
		restWidth = ctx.measureText(rest).width
		ctx.restore()
	}
	const gap = rest ? 20 : 0
	const startX = cx - (headWidth + gap + restWidth) / 2
	ctx.fillStyle = '#f8fafc'
	ctx.fillText(head, startX, y)
	if (rest) {
		ctx.fillStyle = '#f5a400'
		ctx.font = `900 42px ${DATA_FONT}`
		ctx.fillText(rest, startX + headWidth + gap, y)
	}
	ctx.restore()
}

/** Width a pill would occupy for `text` (same font as drawPill), for centering. */
function measurePill(ctx: CanvasRenderingContext2D, text: string, paddingX = 18): number {
	ctx.save()
	ctx.font = `850 18px ${SANS_FONT}`
	const width = Math.ceil(ctx.measureText(text).width + paddingX * 2)
	ctx.restore()
	return width
}

function drawPill(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	paddingX = 18,
	color = '#f5a400'
): number {
	ctx.save()
	ctx.textAlign = 'left'
	ctx.font = `850 18px ${SANS_FONT}`
	const width = Math.ceil(ctx.measureText(text).width + paddingX * 2)
	roundedRect(ctx, x, y, width, 44, UI_RADIUS)
	ctx.fillStyle = color === '#f5a400' ? 'rgba(245, 164, 0, 0.14)' : 'rgba(94, 234, 212, 0.12)'
	ctx.fill()
	ctx.strokeStyle = color === '#f5a400' ? 'rgba(245, 164, 0, 0.40)' : 'rgba(94, 234, 212, 0.32)'
	ctx.lineWidth = 1.5
	ctx.stroke()
	ctx.fillStyle = color
	ctx.fillText(text, x + paddingX, y + 28)
	ctx.restore()
	return width
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
	ctx.fillStyle = '#06080c'
	ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

	const sweep = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
	sweep.addColorStop(0, 'rgba(245, 164, 0, 0.16)')
	sweep.addColorStop(0.4, 'rgba(6, 8, 12, 0.18)')
	sweep.addColorStop(0.72, 'rgba(94, 234, 212, 0.09)')
	sweep.addColorStop(1, 'rgba(245, 164, 0, 0.07)')
	ctx.fillStyle = sweep
	ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

	// Central glow sitting behind the seal — anchors the eye to the emblem.
	const glow = ctx.createRadialGradient(CENTER_X, 648, 30, CENTER_X, 648, 600)
	glow.addColorStop(0, 'rgba(245, 164, 0, 0.18)')
	glow.addColorStop(0.5, 'rgba(94, 234, 212, 0.06)')
	glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
	ctx.fillStyle = glow
	ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

	ctx.save()
	ctx.strokeStyle = 'rgba(94, 234, 212, 0.04)'
	ctx.lineWidth = 1
	for (let x = -120; x < CANVAS_WIDTH + 320; x += 150) {
		ctx.beginPath()
		ctx.moveTo(x, -20)
		ctx.lineTo(x - 300, CANVAS_HEIGHT + 20)
		ctx.stroke()
	}
	ctx.restore()

	ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
	for (let i = 0; i < 220; i++) {
		const x = 44 + ((i * 131) % (CANVAS_WIDTH - 88))
		const y = 44 + ((i * 89) % (CANVAS_HEIGHT - 88))
		ctx.fillRect(x, y, 1.2, 1.2)
	}

	// Framed "minted" panel: outer surface + inner amber hairline.
	roundedRect(ctx, FRAME.x, FRAME.y, FRAME.w, FRAME.h, FRAME.r)
	ctx.fillStyle = 'rgba(8, 11, 16, 0.62)'
	ctx.fill()
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
	ctx.lineWidth = 2
	ctx.stroke()

	roundedRect(ctx, FRAME.x + 11, FRAME.y + 11, FRAME.w - 22, FRAME.h - 22, Math.max(2, FRAME.r - 6))
	ctx.strokeStyle = 'rgba(245, 164, 0, 0.18)'
	ctx.lineWidth = 1.5
	ctx.stroke()

	// Corner ornaments.
	const cm = 30
	const cl = 30
	const corners: Array<[number, number, number, number]> = [
		[FRAME.x + cm, FRAME.y + cm, 1, 1],
		[FRAME.x + FRAME.w - cm, FRAME.y + cm, -1, 1],
		[FRAME.x + cm, FRAME.y + FRAME.h - cm, 1, -1],
		[FRAME.x + FRAME.w - cm, FRAME.y + FRAME.h - cm, -1, -1],
	]
	ctx.save()
	ctx.strokeStyle = 'rgba(245, 164, 0, 0.6)'
	ctx.lineWidth = 2.5
	ctx.lineCap = 'round'
	for (const [cx, cy, sx, sy] of corners) {
		ctx.beginPath()
		ctx.moveTo(cx + sx * cl, cy)
		ctx.lineTo(cx, cy)
		ctx.lineTo(cx, cy + sy * cl)
		ctx.stroke()
	}
	ctx.restore()

	// Bottom closure mark.
	drawDiamond(ctx, CENTER_X, FRAME.y + FRAME.h - 44, 5, 'rgba(245, 164, 0, 0.5)')
}

/**
 * The collectible centerpiece: a radial 24h "huella" ring (one wedge per hour,
 * length + brightness = average time) with the archetype emoji and peak hour
 * minted into the center disc.
 */
function drawSeal(ctx: CanvasRenderingContext2D, summary: ShareSummary, cx: number, cy: number): void {
	const R_OUTER = 152
	const R_INNER = 98
	const R_DISC = 90
	const R_MIN = R_INNER + 6
	const half = 7.5 - 1 // 15°/hour wedge minus a 2° gap
	const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180

	ctx.save()

	// Backplate glow.
	const plate = ctx.createRadialGradient(cx, cy, 30, cx, cy, R_OUTER + 36)
	plate.addColorStop(0, 'rgba(245, 164, 0, 0.16)')
	plate.addColorStop(0.6, 'rgba(94, 234, 212, 0.05)')
	plate.addColorStop(1, 'rgba(0, 0, 0, 0)')
	ctx.fillStyle = plate
	ctx.beginPath()
	ctx.arc(cx, cy, R_OUTER + 36, 0, Math.PI * 2)
	ctx.fill()

	ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
	ctx.lineWidth = 1
	for (const r of [R_OUTER + 20, R_OUTER + 8]) {
		ctx.beginPath()
		ctx.arc(cx, cy, r, 0, Math.PI * 2)
		ctx.stroke()
	}

	// 24h wedges.
	summary.hours.forEach((rawValue, hour) => {
		const value = Math.max(0, Number(rawValue) || 0)
		const t = Math.min(1, value / HOUR_BUCKET_MAX_MS)
		const outerR = value > 0 ? R_MIN + t * (R_OUTER - R_MIN) : R_MIN
		const a0 = hour * 15 - half
		const a1 = hour * 15 + half
		const isPeak = summary.hasEnoughData && summary.peakLabel.startsWith(String(hour).padStart(2, '0'))

		ctx.beginPath()
		ctx.arc(cx, cy, outerR, toRad(a0), toRad(a1), false)
		ctx.arc(cx, cy, R_INNER, toRad(a1), toRad(a0), true)
		ctx.closePath()
		ctx.fillStyle = value > 0 ? `rgba(245, 164, 0, ${0.3 + t * 0.7})` : 'rgba(255, 255, 255, 0.07)'
		ctx.fill()
		if (isPeak) {
			ctx.strokeStyle = '#5eead4'
			ctx.lineWidth = 2.5
			ctx.stroke()
		}
	})

	// Hour ticks (00 / 06 / 12 / 18).
	ctx.fillStyle = 'rgba(201, 212, 229, 0.7)'
	ctx.font = `800 13px ${DATA_FONT}`
	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	for (const hour of [0, 6, 12, 18]) {
		const tx = cx + Math.cos(toRad(hour * 15)) * (R_OUTER + 24)
		const ty = cy + Math.sin(toRad(hour * 15)) * (R_OUTER + 24)
		ctx.fillText(String(hour).padStart(2, '0'), tx, ty)
	}

	// Center disc + minted content.
	ctx.beginPath()
	ctx.arc(cx, cy, R_DISC, 0, Math.PI * 2)
	ctx.fillStyle = 'rgba(7, 10, 16, 0.94)'
	ctx.fill()
	ctx.strokeStyle = 'rgba(94, 234, 212, 0.22)'
	ctx.lineWidth = 1.5
	ctx.stroke()

	const peakHour = summary.hasEnoughData ? summary.peakLabel.slice(0, 5) : '--:--'
	ctx.fillStyle = '#f8fafc'
	ctx.font = `400 34px ${SANS_FONT}`
	ctx.fillText(summary.archetypeEmoji, cx, cy - 34)
	ctx.font = `900 40px ${DATA_FONT}`
	ctx.fillText(peakHour, cx, cy + 8)
	ctx.fillStyle = 'rgba(201, 212, 229, 0.78)'
	ctx.font = `700 14px ${SANS_FONT}`
	ctx.fillText(summary.hasEnoughData ? 'hora punta' : 'pocos datos', cx, cy + 38)

	ctx.textBaseline = 'alphabetic'
	ctx.restore()
}

/** Centered headline: section label + big total time + caption. */
function drawHero(ctx: CanvasRenderingContext2D, summary: ShareSummary): void {
	ctx.save()
	ctx.textAlign = 'center'
	ctx.fillStyle = '#f5a400'
	ctx.font = `900 18px ${DATA_FONT}`
	setTracking(ctx, '2.2px')
	const label = summary.mainLabel.toUpperCase()
	const labelWidth = ctx.measureText(label).width
	const ruleW = 48
	const ruleGap = 22
	const ruleY = 270
	const leftRule = ctx.createLinearGradient(
		CENTER_X - labelWidth / 2 - ruleGap - ruleW,
		0,
		CENTER_X - labelWidth / 2 - ruleGap,
		0
	)
	leftRule.addColorStop(0, 'rgba(245, 164, 0, 0)')
	leftRule.addColorStop(1, 'rgba(245, 164, 0, 0.58)')
	ctx.fillStyle = leftRule
	ctx.fillRect(CENTER_X - labelWidth / 2 - ruleGap - ruleW, ruleY, ruleW, 2)

	const rightRule = ctx.createLinearGradient(
		CENTER_X + labelWidth / 2 + ruleGap,
		0,
		CENTER_X + labelWidth / 2 + ruleGap + ruleW,
		0
	)
	rightRule.addColorStop(0, 'rgba(245, 164, 0, 0.58)')
	rightRule.addColorStop(1, 'rgba(245, 164, 0, 0)')
	ctx.fillStyle = rightRule
	ctx.fillRect(CENTER_X + labelWidth / 2 + ruleGap, ruleY, ruleW, 2)

	ctx.fillStyle = '#f5a400'
	ctx.fillText(label, CENTER_X, 276)
	setTracking(ctx, '0px')

	drawMainTime(ctx, summary.mainValue, CENTER_X, 374)

	ctx.textAlign = 'center'
	ctx.fillStyle = '#c9d4e5'
	ctx.font = `750 24px ${SANS_FONT}`
	ctx.fillText(truncateText(ctx, summary.mainCaption, CONTENT_W), CENTER_X, 418)
	ctx.restore()
}

/** Archetype + optional @username pills, centered beneath the seal. */
function drawSealPills(ctx: CanvasRenderingContext2D, summary: ShareSummary, y: number): void {
	const pills: Array<{ text: string; pad: number; color: string }> = [
		{ text: `${summary.archetypeEmoji} ${summary.archetypeLabel}`, pad: 22, color: '#f5a400' },
	]
	if (summary.username) pills.push({ text: `@${summary.username}`, pad: 22, color: '#5eead4' })

	const widths = pills.map(p => measurePill(ctx, p.text, p.pad))
	const gap = 14
	const total = widths.reduce((acc, w) => acc + w, 0) + gap * (pills.length - 1)
	let cursor = CENTER_X - total / 2
	pills.forEach((p, index) => {
		drawPill(ctx, p.text, cursor, y, p.pad, p.color)
		cursor += widths[index] + gap
	})
}

/** Three evenly-spaced metric tiles spanning the content width. */
function drawMetricTiles(ctx: CanvasRenderingContext2D, summary: ShareSummary, y: number): void {
	const tiles: Array<[string, string]> = [
		['Hora punta', summary.peakLabel],
		['Franja activa', summary.bandLabel],
		[summary.secondaryLabel, summary.secondaryValue],
	]
	const gap = 20
	const tileW = (CONTENT_W - gap * 2) / 3
	tiles.forEach(([label, value], index) => {
		drawMetricTile(ctx, label, value, CONTENT_LEFT + index * (tileW + gap), y, tileW)
	})
}

/** Top-3 subforums by total accumulated time, in a framed card. */
function drawForumsCard(ctx: CanvasRenderingContext2D, summary: ShareSummary, y: number): void {
	const x = CONTENT_LEFT
	const w = CONTENT_W
	const h = 168
	ctx.save()
	roundedRect(ctx, x, y, w, h, UI_RADIUS)
	ctx.fillStyle = 'rgba(6, 8, 13, 0.55)'
	ctx.fill()
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)'
	ctx.lineWidth = 1.5
	ctx.stroke()

	ctx.textAlign = 'center'
	ctx.fillStyle = 'rgba(94, 234, 212, 0.85)'
	ctx.font = `700 13px ${DATA_FONT}`
	setTracking(ctx, '2.5px')
	ctx.fillText(`${summary.forumTitle.toUpperCase()} · TIEMPO TOTAL`, x + w / 2, y + 34)
	setTracking(ctx, '0px')

	if (summary.forums.length === 0) {
		ctx.fillStyle = '#aeb8c7'
		ctx.font = `600 18px ${SANS_FONT}`
		ctx.fillText('Aún sin subforos suficientes.', x + w / 2, y + 100)
		ctx.restore()
		return
	}

	const cols = summary.forums.slice(0, 3)
	const colW = w / cols.length
	const chip = 26
	cols.forEach((forum, index) => {
		const colX = x + index * colW + 26
		const nameY = y + 92
		const chipY = nameY - 19

		// Column divider.
		if (index > 0) {
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)'
			ctx.lineWidth = 1
			ctx.beginPath()
			ctx.moveTo(x + index * colW, y + 62)
			ctx.lineTo(x + index * colW, y + h - 24)
			ctx.stroke()
		}

		// Neutral rank chip (no amber on #1).
		roundedRect(ctx, colX, chipY, chip, chip, 6)
		ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
		ctx.fill()
		ctx.textAlign = 'center'
		ctx.fillStyle = 'rgba(201, 212, 229, 0.85)'
		ctx.font = `900 14px ${DATA_FONT}`
		ctx.fillText(String(index + 1), colX + chip / 2, nameY - 1)

		// Subforum name — display "Grotesk" font for variety vs the mono/sans elsewhere.
		ctx.textAlign = 'left'
		ctx.fillStyle = '#f8fafc'
		ctx.font = `800 22px ${DISPLAY_FONT}`
		ctx.fillText(truncateText(ctx, forum.label, colW - chip - 60), colX + chip + 12, nameY)

		// Total time — the prominent, colour-accented figure (amber #1, teal rest).
		ctx.fillStyle = index === 0 ? '#f5a400' : 'rgba(94, 234, 212, 0.92)'
		ctx.font = `800 19px ${DATA_FONT}`
		ctx.fillText(forum.value, colX + chip + 12, nameY + 32)
	})
	ctx.restore()
}

/** Compact duration for tight bar labels: biggest non-zero unit only ("119h", "45m"). */
function fmtShort(ms: number): string {
	const h = Math.floor(ms / 3_600_000)
	if (h >= 1) return `${h}h`
	const m = Math.floor(ms / 60_000)
	if (m >= 1) return `${m}m`
	return `${Math.max(1, Math.floor(ms / 1000))}s`
}

/**
 * Trend chart (month / day / week) drawn as a readable static graphic — a baseline
 * axis plus value labels above the bars (no faux-interactive "slots"), with the peak
 * bar highlighted to tie it to the "Pico" figure.
 */
function drawBars(ctx: CanvasRenderingContext2D, summary: ShareSummary, titleY: number): void {
	const x = CONTENT_LEFT
	const w = CONTENT_W
	const barAreaH = 52
	const baseY = titleY + 108
	const values = summary.bars.map(bar => Math.max(0, bar.value))
	const max = Math.max(...values, 0)
	const peakIndex = max > 0 ? values.indexOf(max) : -1
	const showValues = summary.bars.length <= 14
	const gap = summary.bars.length > 14 ? 4 : 12
	const barWidth = (w - gap * (summary.bars.length - 1)) / summary.bars.length

	ctx.save()
	ctx.fillStyle = 'rgba(245, 164, 0, 0.92)'
	ctx.font = `800 14px ${DATA_FONT}`
	ctx.textAlign = 'left'
	setTracking(ctx, '2.5px')
	ctx.fillText(summary.barTitle.toUpperCase(), x, titleY)
	setTracking(ctx, '0px')
	ctx.fillStyle = 'rgba(174, 184, 199, 0.65)'
	ctx.font = `600 15px ${SANS_FONT}`
	ctx.textAlign = 'right'
	ctx.fillText(max > 0 ? `Pico: ${fmtTime(max)}` : 'Sin actividad visible', x + w, titleY)

	// Baseline axis.
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
	ctx.lineWidth = 1.5
	ctx.beginPath()
	ctx.moveTo(x, baseY + 1)
	ctx.lineTo(x + w, baseY + 1)
	ctx.stroke()

	summary.bars.forEach((bar, index) => {
		const value = values[index]
		const t = max > 0 ? value / max : 0
		const isPeak = index === peakIndex
		const bh = value > 0 ? Math.max(5, Math.round(t * barAreaH)) : 2
		const bx = x + index * (barWidth + gap)
		const barTop = baseY - bh

		roundedRect(ctx, bx, barTop, barWidth, bh, 4)
		ctx.fillStyle = value > 0
			? isPeak
				? '#f5a400'
				: `rgba(245, 164, 0, ${0.32 + t * 0.5})`
			: 'rgba(255, 255, 255, 0.08)'
		ctx.fill()

		// Value above the bar (all bars when few; otherwise just the peak).
		if (value > 0 && (showValues || isPeak)) {
			ctx.fillStyle = isPeak ? '#f5a400' : 'rgba(201, 212, 229, 0.82)'
			ctx.font = `${isPeak ? 800 : 700} 12px ${DATA_FONT}`
			ctx.textAlign = 'center'
			ctx.fillText(fmtShort(value), bx + barWidth / 2, barTop - 8)
		}

		// X-axis label.
		const showLabel =
			summary.bars.length <= 14 || index === 0 || index === summary.bars.length - 1 || index % 5 === 0
		if (showLabel) {
			ctx.fillStyle = isPeak ? 'rgba(245, 164, 0, 0.9)' : '#9aa6b6'
			ctx.font = `700 13px ${SANS_FONT}`
			ctx.textAlign = 'center'
			ctx.fillText(bar.label, bx + barWidth / 2, baseY + 22)
		}
	})

	ctx.restore()
}

/** A small rotated-square brand mark. */
function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
	ctx.save()
	ctx.translate(cx, cy)
	ctx.rotate(Math.PI / 4)
	ctx.fillStyle = color
	ctx.fillRect(-r, -r, r * 2, r * 2)
	ctx.restore()
}

function drawHeader(ctx: CanvasRenderingContext2D, summary: ShareSummary): void {
	ctx.save()
	ctx.textBaseline = 'alphabetic'

	// Credential row: brand mark + label (left), period chip (right).
	drawDiamond(ctx, CONTENT_LEFT + 7, 110, 7, '#f5a400')
	ctx.textAlign = 'left'
	ctx.fillStyle = '#f5a400'
	ctx.font = `900 15px ${DATA_FONT}`
	setTracking(ctx, '3px')
	ctx.fillText('MEDIAVIDA PREMIUM', CONTENT_LEFT + 28, 116)
	setTracking(ctx, '0px')

	const chipPad = 18
	const chipW = measurePill(ctx, summary.period, chipPad)
	drawPill(ctx, summary.period, CONTENT_RIGHT - chipW, 90, chipPad, '#f5a400')

	// The period chip and hero metric carry the context; no repeated headline here.
	ctx.restore()
}

async function waitForCanvasFonts(): Promise<void> {
	const fonts = (document as DocumentWithFonts).fonts
	if (!fonts) return

	await Promise.all(
		CANVAS_FONT_LOADS.map(font => fonts.load?.(font, 'Mediavida Premium 0123456789')?.catch(() => []) ?? [])
	)
	await fonts.ready?.catch(() => undefined)
}

async function createShareImageBlob(summary: ShareSummary): Promise<Blob> {
	await waitForCanvasFonts()

	const canvas = document.createElement('canvas')
	canvas.width = CANVAS_WIDTH * CANVAS_SCALE
	canvas.height = CANVAS_HEIGHT * CANVAS_SCALE

	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('No se pudo preparar el lienzo de imagen.')

	ctx.scale(CANVAS_SCALE, CANVAS_SCALE)
	drawBackground(ctx)
	drawHeader(ctx, summary)
	drawHero(ctx, summary)
	drawSeal(ctx, summary, CENTER_X, 660)
	drawSealPills(ctx, summary, 872)
	drawMetricTiles(ctx, summary, 962)
	drawForumsCard(ctx, summary, 1098)
	drawBars(ctx, summary, 1322)

	return await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(blob => {
			if (blob) resolve(blob)
			else reject(new Error('No se pudo generar el PNG.'))
		}, 'image/png')
	})
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
							{status && <p className="text-xs text-muted-foreground">{status}</p>}
						</DialogFooter>
					</aside>

					<section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background/60 p-5 pb-8">
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
					</section>
				</div>
			</DialogContent>
		</Dialog>
	)
}
