import { extractThreadNumericId, slugToName, slugToTitle } from '@/lib/url-helpers'

const THREAD_PATH_REGEX = /^\/foro\/[^/]+\/[^/]+-\d+/
const MV_BASE_URL = 'https://www.mediavida.com'

export interface HiddenThreadMetadata {
	id: string
	title: string
	subforum: string
	subforumId: string
}

function isMediavidaHost(hostname: string): boolean {
	return hostname === 'www.mediavida.com' || hostname === 'mediavida.com'
}

/**
 * Normalizes a thread URL/path to a canonical thread id.
 * Example: https://www.mediavida.com/foro/cine/hilo-123/4#99 -> /foro/cine/hilo-123
 */
export function normalizeThreadPath(input: string): string | null {
	try {
		const parsed = new URL(input, MV_BASE_URL)
		if (!isMediavidaHost(parsed.hostname)) {
			return null
		}

		let path = parsed.pathname
		if (path.endsWith('/')) {
			path = path.slice(0, -1)
		}

		// Remove optional live suffix and page suffix.
		path = path.replace(/\/live$/i, '')
		path = path.replace(/\/\d+$/, '')

		if (path.endsWith('/')) {
			path = path.slice(0, -1)
		}

		const match = path.match(THREAD_PATH_REGEX)
		return match ? match[0] : null
	} catch {
		return null
	}
}

/**
 * Parses a thread URL and returns normalized metadata for storage.
 */
export function parseHiddenThreadFromUrl(input: string): HiddenThreadMetadata | null {
	const threadPath = normalizeThreadPath(input)
	if (!threadPath) return null

	const match = threadPath.match(/^\/foro\/([^/]+)\/([^/]+)$/)
	if (!match) return null

	const [, subforumSlug, threadSlug] = match

	return {
		id: threadPath,
		title: slugToTitle(threadSlug),
		subforum: slugToName(subforumSlug),
		subforumId: `/foro/${subforumSlug}`,
	}
}

/**
 * Extracts a canonical thread path from a forum list row.
 */
export function extractThreadPathFromRow(row: Element): string | null {
	const threadLink = row.querySelector<HTMLAnchorElement>('td.col-th .thread a[href*="/foro/"]')
	if (!threadLink) return null

	return normalizeThreadPath(threadLink.getAttribute('href') || threadLink.href)
}

/**
 * Builds a Set of numeric thread IDs from a collection of normalized thread paths.
 * Used as a fallback matching mechanism when URL slugs differ slightly
 * (e.g., news section uses `11-feb` while subforum uses `11feb`).
 */
export function buildHiddenNumericIds(hiddenPaths: Iterable<string>): Set<number> {
	const ids = new Set<number>()
	for (const path of hiddenPaths) {
		const numId = extractThreadNumericId(path)
		if (numId !== null) ids.add(numId)
	}
	return ids
}

/**
 * Checks if a thread URL matches any hidden thread by full path or numeric ID fallback.
 */
export function isThreadUrlHidden(
	url: string,
	hiddenPaths: Set<string>,
	hiddenNumericIds: Set<number>,
): boolean {
	const path = normalizeThreadPath(url)
	if (!path) return false
	if (hiddenPaths.has(path)) return true

	const numericId = extractThreadNumericId(path)
	return numericId !== null && hiddenNumericIds.has(numericId)
}
