/**
 * Qualification zones for the standings table.
 *
 * The domestic cutoffs below are the ones to revisit if UEFA ever changes the
 * allocation: Spain's Champions berths have moved between four and five in
 * recent seasons, and the Europa slot shifts when the cup winner already
 * qualified through the league. The API reports none of this, so the numbers
 * live here as constants and changing them is a one-line edit.
 *
 * Keyed on the competition code rather than the payload's `stage` string: the
 * code is ours and always correct, while the stage wording belongs to the API
 * and an unexpected value silently produced no zones at all.
 */
import type { FootballCompetitionCode } from '@/services'

export type StandingsZone = 'champions' | 'europa' | 'round-of-16' | 'playoff' | 'relegation'

// --- Domestic league (revisit each season if the UEFA allocation changes) ---
const CHAMPIONS_PLACES = 4
const EUROPA_PLACES = 6
const RELEGATION_SLOTS = 3

// --- Champions League phase (format rules, not coefficient-driven) ---
const ROUND_OF_16_CUTOFF = 8
const PLAYOFF_CUTOFF = 24

/** Below these sizes the table is partial and marking zones would mislead. */
const MIN_LEAGUE_PHASE_ROWS = 24
const MIN_DOMESTIC_ROWS = 10

export function getStandingsZone(
	competition: FootballCompetitionCode,
	position: number,
	totalRows: number
): StandingsZone | null {
	if (competition === 'CL') {
		if (totalRows < MIN_LEAGUE_PHASE_ROWS) return null
		if (position <= ROUND_OF_16_CUTOFF) return 'round-of-16'
		if (position <= PLAYOFF_CUTOFF) return 'playoff'
		return null
	}

	if (totalRows < MIN_DOMESTIC_ROWS) return null
	if (position <= CHAMPIONS_PLACES) return 'champions'
	if (position <= EUROPA_PLACES) return 'europa'

	return position > totalRows - RELEGATION_SLOTS ? 'relegation' : null
}
