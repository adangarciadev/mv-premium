/**
 * Pure share-summary derivation for the "Tiempo en Mediavida" share image.
 *
 * No DOM, canvas or React here: this module turns RhythmStats + a selected
 * scope into the plain `ShareSummary` data contract consumed by the renderer
 * (`rhythm-share-image.ts`) and the dialog UI.
 */
import { getDayKey, getWeekKey, getWeekStart, type RhythmStats } from './rhythm-model'
import type { RhythmShareScope } from './rhythm-share-availability'
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
} from './rhythm-insights'
import { getSubforumName } from '@/lib/subforums'

export type ShareScope = RhythmShareScope

export interface ShareBar {
	label: string
	value: number
}

export interface ShareForum {
	label: string
	value: string
}

export interface ShareSummary {
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

export const WEEKDAY_LABELS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const WEEKDAY_PLURAL_ES = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function fmtTime(ms: number): string {
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

export function formatWeekRange(start: Date): string {
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

export function getBestWeekday(stats: RhythmStats): number {
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

export function getDefaultWeekKey(stats: RhythmStats, selectedWeekKey?: string | null): string {
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

export function buildShareSummary(
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
		mainCaption = `Media diaria 30 días: ${secondaryValue}`
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
				? 'Últimos 30 días'
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
			.join(' · ')
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
