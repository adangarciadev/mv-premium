import { formatIsoDateKey } from '@/lib/date-utils'
import type { FootballMatch, FootballScore } from '@/services'

const STAGE_LABELS: Record<string, string> = {
	PLAYOFFS: 'Playoffs',
	LAST_16: 'Octavos',
	QUARTER_FINALS: 'Cuartos',
	SEMI_FINALS: 'Semifinales',
	FINAL: 'Final',
	THIRD_PLACE: 'Tercer puesto',
}

export function formatStageLabel(match: FootballMatch): string {
	if (match.stage === 'REGULAR_SEASON') {
		return match.matchday === null ? 'Jornada' : `Jornada ${match.matchday}`
	}

	if (match.stage === 'LEAGUE_STAGE') {
		return match.matchday === null ? 'Fase de liga' : `Fase de liga · J${match.matchday}`
	}

	return STAGE_LABELS[match.stage] ?? ''
}

export function formatScoreText(score: FootballScore | null): string | null {
	if (score === null) return null

	const scoreText = `${score.home} - ${score.away}`
	if (score.penalties !== null) {
		return `${scoreText} (${score.penalties.home}-${score.penalties.away} pen.)`
	}

	return score.decidedBeyondRegularTime ? `${scoreText} (pró.)` : scoreText
}

export function formatKickoffTime(utcDate: string): string {
	const date = new Date(utcDate)
	if (Number.isNaN(date.getTime())) return ''

	const hours = String(date.getHours()).padStart(2, '0')
	const minutes = String(date.getMinutes()).padStart(2, '0')
	return `${hours}:${minutes}`
}

function parseLocalDayKey(dayKey: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey)
	if (!match) return null

	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	const date = new Date(year, month - 1, day)
	if (
		Number.isNaN(date.getTime()) ||
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return null
	}

	date.setHours(0, 0, 0, 0)
	return date
}

function getRelativeDayKey(now: Date, offset: number): string {
	const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	date.setDate(date.getDate() + offset)
	return formatIsoDateKey(date)
}

export function formatDayLabelParts(
	dayKey: string,
	now: Date = new Date(),
): {
	weekday: string
	dayNumber: string | null
	isRelative: boolean
	isToday: boolean
} {
	const date = parseLocalDayKey(dayKey)
	if (date === null) {
		return { weekday: '', dayNumber: null, isRelative: false, isToday: false }
	}

	const isToday = dayKey === getRelativeDayKey(now, 0)
	if (isToday) return { weekday: 'Hoy', dayNumber: null, isRelative: true, isToday: true }
	if (dayKey === getRelativeDayKey(now, 1)) {
		return { weekday: 'Mañana', dayNumber: null, isRelative: true, isToday: false }
	}
	if (dayKey === getRelativeDayKey(now, -1)) {
		return { weekday: 'Ayer', dayNumber: null, isRelative: true, isToday: false }
	}

	const weekday = new Intl.DateTimeFormat('es-ES', {
		weekday: 'long',
	})
		.format(date)
		.toLowerCase()
		.replace(/[.,]/g, '')

	return {
		weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
		dayNumber: String(date.getDate()),
		isRelative: false,
		isToday: false,
	}
}

export function formatDayLabel(dayKey: string, now: Date = new Date()): string {
	const parts = formatDayLabelParts(dayKey, now)
	if (parts.isRelative) return parts.weekday
	if (parts.weekday === '') return ''

	return `${parts.weekday} ${parts.dayNumber}`
}
