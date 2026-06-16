import type { RhythmStats } from './rhythm-model'

export type RhythmShareScope = 'year' | 'last30' | 'week' | 'weekday'

export const MIN_SHARE_RHYTHM_MS = 60 * 60_000

export interface RhythmShareAvailability {
	canShare: boolean
	currentMs: number
	minMs: number
	reason: string
}

function getLocalDayKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function sumDays(days: Record<string, number>, keys: Iterable<string>): number {
	let total = 0
	for (const key of keys) {
		total += Math.max(0, Number(days[key]) || 0)
	}
	return total
}

function currentYearDayKeys(now: Date): string[] {
	const keys: string[] = []
	const cursor = new Date(now.getFullYear(), 0, 1)
	while (cursor.getTime() <= now.getTime()) {
		keys.push(getLocalDayKey(cursor))
		cursor.setDate(cursor.getDate() + 1)
	}
	return keys
}

function last30DayKeys(now: Date): string[] {
	return Array.from({ length: 30 }, (_, offset) => {
		const date = new Date(now)
		date.setDate(now.getDate() - offset)
		return getLocalDayKey(date)
	})
}

function availability(currentMs: number, reason: string, minMs: number): RhythmShareAvailability {
	return {
		canShare: currentMs >= minMs,
		currentMs,
		minMs,
		reason,
	}
}

export function getRhythmShareAvailability(
	stats: RhythmStats,
	scope: RhythmShareScope,
	weekKey: string,
	weekday: number,
	now = new Date(),
	minMs = MIN_SHARE_RHYTHM_MS
): RhythmShareAvailability {
	if (scope === 'year') {
		return availability(
			sumDays(stats.days, currentYearDayKeys(now)),
			`Necesitas al menos 1 h registrada este año para compartir el resumen anual.`,
			minMs
		)
	}

	if (scope === 'last30') {
		return availability(
			sumDays(stats.days, last30DayKeys(now)),
			`Necesitas al menos 1 h registrada en los últimos 30 días para compartir este resumen.`,
			minMs
		)
	}

	if (scope === 'week') {
		return availability(
			Math.max(0, Number(stats.weeks[weekKey]) || 0),
			`Esta semana aún no llega a 1 h registrada. Elige una semana con más actividad.`,
			minMs
		)
	}

	return availability(
		Math.max(0, Number(stats.weekdays[weekday]) || 0),
		`Necesitas al menos 1 h acumulada en este día de la semana para compartirlo.`,
		minMs
	)
}

export function hasAnyShareableRhythmScope(
	stats: RhythmStats,
	now = new Date(),
	minMs = MIN_SHARE_RHYTHM_MS
): boolean {
	const yearMs = sumDays(stats.days, currentYearDayKeys(now))
	const last30Ms = sumDays(stats.days, last30DayKeys(now))
	const bestWeekMs = Math.max(0, ...Object.values(stats.weeks).map(ms => Math.max(0, Number(ms) || 0)))
	const bestWeekdayMs = Math.max(0, ...stats.weekdays.map(ms => Math.max(0, Number(ms) || 0)))

	return [yearMs, last30Ms, bestWeekMs, bestWeekdayMs].some(ms => ms >= minMs)
}
