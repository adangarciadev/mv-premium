/**
 * Age filtering for Mediavida's related-threads table.
 *
 * Mediavida stamps every row with the timestamp of its LAST MESSAGE, not the thread's creation
 * date — that one is not in the DOM and would cost a request per thread. So "age" here always
 * means "time since the last reply", which is also the more useful reading: a thread opened in
 * 2016 that people still post in today is not stale.
 */

/** 25 years: past that the filter stops meaning anything, and Mediavida itself is younger. */
const MAX_AGE_MONTHS = 300

/** Rows carry the same timestamp twice; the activity column is the canonical one. */
const ACTIVITY_TIME_SELECTORS = ['.thread-count .m-last [data-time]', '.last-av [data-time]', '[data-time]']

/**
 * Milliseconds of the row's last activity, or null when the row carries no usable timestamp.
 * Returning null means "never hide": a markup change on Mediavida's side should cost us the
 * filter, not the thread.
 */
export function getRowActivityTime(row: Element): number | null {
	for (const selector of ACTIVITY_TIME_SELECTORS) {
		const raw = row.querySelector(selector)?.getAttribute('data-time')
		if (!raw) continue

		// Mediavida stores Unix seconds.
		const seconds = Number.parseInt(raw, 10)
		if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000
	}

	return null
}

/** Normalises whatever is in storage; 0 (and anything invalid) means "no limit". */
export function normalizeMaxAgeMonths(value: unknown): number {
	const months = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
	if (!Number.isFinite(months) || months <= 0) return 0
	return Math.min(MAX_AGE_MONTHS, Math.floor(months))
}

/**
 * Oldest activity timestamp still allowed, or null when there is no limit.
 * Calendar months, so "12 months" lands on the same day of the year rather than 365 fixed days.
 */
export function getActivityCutoff(maxAgeMonths: number, now: Date = new Date()): number | null {
	const months = normalizeMaxAgeMonths(maxAgeMonths)
	if (months === 0) return null

	const cutoff = new Date(now.getTime())
	cutoff.setMonth(cutoff.getMonth() - months)
	return cutoff.getTime()
}

/** A row is stale when it has a readable timestamp and that timestamp predates the cutoff. */
export function isRowStale(row: Element, cutoff: number | null): boolean {
	if (cutoff === null) return false

	const time = getRowActivityTime(row)
	return time !== null && time < cutoff
}
