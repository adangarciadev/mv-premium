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

/**
 * Whether a kickoff is still ahead of us today.
 *
 * Only then is the time worth accenting. A fixture the API has not updated
 * keeps its kickoff time long after it was played, and painting that in the
 * accent colour made a finished match look like it was about to start.
 */
export function isUpcomingToday(match: FootballMatch, now: Date = new Date()): boolean {
	const kickoff = Date.parse(match.utcDate)
	if (Number.isNaN(kickoff) || kickoff <= now.getTime()) return false

	return formatIsoDateKey(new Date(kickoff)) === formatIsoDateKey(now)
}

/** No football match runs longer than this, extra time and stoppages included. */
const MAX_MATCH_DURATION = 2.5 * 60 * 60 * 1000

/**
 * Whether a match still claiming to be in progress can be believed.
 *
 * The API is the only source for the status, and it has been seen holding
 * IN_PLAY after the final whistle. Past two and a half hours from kickoff the
 * claim is certainly wrong, and showing a pulsing "playing now" chip on a match
 * that ended is worse than showing its last known score plainly.
 */
export function isLiveStatusStale(match: FootballMatch, now: Date = new Date()): boolean {
	if (match.status !== 'IN_PLAY' && match.status !== 'PAUSED') return false

	const kickoff = Date.parse(match.utcDate)
	if (Number.isNaN(kickoff)) return false

	return now.getTime() - kickoff > MAX_MATCH_DURATION
}

/**
 * How far into the match we are, for the live chip's tooltip.
 *
 * Only reported when the payload actually carries a minute: the wall clock
 * cannot be turned into a match minute without knowing the interval and
 * stoppage time, and a guess dressed as data is worse than no data. `PAUSED`
 * is the API's own way of saying half time, so that one is safe to name.
 */
export function formatLiveMinute(match: FootballMatch): string | null {
	if (match.status === 'PAUSED') return 'Descanso'
	if (match.status !== 'IN_PLAY') return null
	if (match.minute === null) return null

	return `${match.minute}'`
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
