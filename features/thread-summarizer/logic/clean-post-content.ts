/**
 * Shared Post Content Cleaning
 *
 * Unified cleaning function for post content extraction.
 * Used by both thread summarizer (extract-posts, fetch-pages)
 * and individual post summarizer (summarize-post).
 */

export interface CleanPostContentOptions {
	/** Keep spoiler content visible (remove only trigger links). Default: false (removes all spoilers) */
	keepSpoilers?: boolean
	/** Remove code blocks (pre, code). Default: false */
	removeCodeBlocks?: boolean
	/**
	 * User analysis mode: optimizes content for single-user profile analysis.
	 * - Keeps blockquotes (they show what others said to the user)
	 * - Converts #N quote links to descriptive text "[→ responde al #N]"
	 * - Keeps spoiler content (implied)
	 */
	userAnalysisMode?: boolean
}

/**
 * Base selectors always removed from post content.
 * Covers quotes, edits, scripts, media embeds, images, and signatures.
 */
const BASE_SELECTORS = [
	'.post-meta',
	'.post-meta-reply',
	'.post-controls',
	'blockquote',
	'.cita',
	'.ref',
	'.edit',
	'.edited',
	'script',
	'style',
	'[data-s9e-mediaembed]',
	'.twitter-tweet',
	'blockquote.twitter-tweet',
	'.instagram-media',
	'.tiktok-embed',
	'.fb-post',
	'.bluesky-embed',
	'iframe',
	'video',
	'audio',
	'object',
	'embed',
	'.media-container',
	'.iframe-container',
	'.video-container',
	'img',
	'.post-signature',
	'.signature',
]

/** Selectors for spoiler elements (trigger + content) */
const SPOILER_SELECTORS = ['.spoiler', '.sp']

/** Selectors for spoiler trigger links only (keep content) */
const SPOILER_TRIGGER_SELECTORS = ['.spoiler-wrap > a.spoiler']

/** Selectors for code blocks */
const CODE_SELECTORS = ['pre', 'code']

const MEDIA_URL_PATTERNS = [
	/^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\s]+$/i,
	/^https?:\/\/(?:www\.)?instagram\.com\/[^\s]+$/i,
	/^https?:\/\/(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com)\/[^\s]+$/i,
	/^https?:\/\/(?:www\.)?youtube\.com\/[^\s]+$/i,
	/^https?:\/\/(?:www\.)?youtu\.be\/[^\s]+$/i,
	/^https?:\/\/(?:www\.)?twitch\.tv\/[^\s]+$/i,
	/^https?:\/\/(?:www\.)?clips\.twitch\.tv\/[^\s]+$/i,
]

const QUOTE_MARKER_OPEN = '[CITA_INICIO]'
const QUOTE_MARKER_CLOSE = '[CITA_FIN]'

/**
 * Cleans post content by removing noise elements and normalizing whitespace.
 *
 * Default behavior (thread summarizer): removes quotes, spoilers, media, etc.
 * With `keepSpoilers: true`: keeps spoiler content, removes only trigger links.
 * With `removeCodeBlocks: true`: also removes pre/code elements.
 */
export function cleanPostContent(contentEl: Element, options: CleanPostContentOptions = {}): string {
	const { keepSpoilers = false, removeCodeBlocks = false, userAnalysisMode = false } = options

	const clone = contentEl.cloneNode(true) as HTMLElement

	if (userAnalysisMode) {
		// User analysis mode: keep blockquotes (they show context of replies) but
		// convert #N quote links to descriptive text so the AI understands reply context.
		clone.querySelectorAll<HTMLAnchorElement>('a.quote[rel], a.quote[href]').forEach(quoteLink => {
			const postNum = getQuoteLinkPostNumber(quoteLink)
			if (!postNum) return
			const span = (clone.ownerDocument || document).createElement('span')
			span.textContent = `[→ responde al #${postNum}]`
			quoteLink.parentNode?.replaceChild(span, quoteLink)
		})

		// Wrap quoted blocks with explicit markers so the AI can distinguish
		// quoted text from the user's own words after textContent flattening.
		markQuotedBlocks(clone)

		// Remove everything from BASE_SELECTORS EXCEPT generic blockquote and .cita
		// (we keep those to preserve quoted context from [quote=user] BBCode)
		const analysisSelectors = BASE_SELECTORS.filter(s => s !== 'blockquote' && s !== '.cita')
		analysisSelectors.push(...SPOILER_TRIGGER_SELECTORS)
		if (removeCodeBlocks) analysisSelectors.push(...CODE_SELECTORS)
		clone.querySelectorAll(analysisSelectors.join(', ')).forEach(el => el.remove())
	} else {
		const selectors = [...BASE_SELECTORS]

		if (keepSpoilers) {
			// Only remove the trigger link, keep spoiler content
			selectors.push(...SPOILER_TRIGGER_SELECTORS)
			// Also remove .quote (used in summarize-post but not in thread summarizer)
			selectors.push('.quote')
		} else {
			// Remove all spoiler elements
			selectors.push(...SPOILER_SELECTORS)
		}

		if (removeCodeBlocks) {
			selectors.push(...CODE_SELECTORS)
		}

		clone.querySelectorAll(selectors.join(', ')).forEach(el => el.remove())
	}

	// Remove bare media links that come from embed-only posts.
	clone.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
		const href = (anchor.getAttribute('href') || '').trim()
		if (!isMediaOnlyUrl(href)) return

		const text = (anchor.textContent || '').trim()
		const normalizedHref = normalizeUrlLikeToken(href)
		const normalizedText = normalizeUrlLikeToken(text)
		const isBareUrl = !text || normalizedText === normalizedHref || /^https?:\/\//i.test(text)

		if (isBareUrl) {
			anchor.remove()
		}
	})

	const normalized = (clone.textContent || '').replace(/\s+/g, ' ').trim()
	return hasMeaningfulNonUrlText(normalized) ? normalized : ''
}

function markQuotedBlocks(root: HTMLElement): void {
	const quoteSelector = 'blockquote, .cita'
	const quoteBlocks = Array.from(root.querySelectorAll<HTMLElement>(quoteSelector)).filter(
		el => !el.parentElement?.closest(quoteSelector)
	)

	for (const quoteEl of quoteBlocks) {
		const doc = quoteEl.ownerDocument || root.ownerDocument || document
		quoteEl.insertBefore(doc.createTextNode(`${QUOTE_MARKER_OPEN} `), quoteEl.firstChild)
		quoteEl.appendChild(doc.createTextNode(` ${QUOTE_MARKER_CLOSE}`))
	}
}

function getQuoteLinkPostNumber(link: HTMLAnchorElement): string | null {
	const rel = (link.getAttribute('rel') || '').trim()
	if (/^\d+$/.test(rel)) return rel

	const text = (link.textContent || '').trim()
	const textMatch = text.match(/#(\d+)/) || text.match(/\b(\d+)\b/)
	if (textMatch) return textMatch[1]

	const href = (link.getAttribute('href') || '').trim()
	if (!href) return null

	const hrefMatch =
		href.match(/#(?:post-)?(\d+)/i) ||
		href.match(/[?&](?:post|quote|reply|id)=(\d+)/i) ||
		href.match(/\/post\/(\d+)\b/i)

	return hrefMatch?.[1] ?? null
}

function isMediaOnlyUrl(url: string): boolean {
	return MEDIA_URL_PATTERNS.some(pattern => pattern.test(url))
}

function normalizeUrlLikeToken(value: string): string {
	return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').trim().toLowerCase()
}

function hasMeaningfulNonUrlText(text: string): boolean {
	if (!text) return false

	const withoutUrls = text
		.replace(/https?:\/\/\S+/gi, ' ')
		.replace(/\bwww\.\S+/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim()

	// If after stripping URLs there is no real text, treat as media-only/noise.
	return withoutUrls.length >= 3
}
