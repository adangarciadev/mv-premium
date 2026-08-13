/**
 * Identity for an uploaded review card.
 *
 * The URL we upload to and the URL Mediavida ends up serving are not reliably the same
 * string: protocol, host alias and size suffix all vary. The stable part is the filename
 * stem, so that is what identifies a card everywhere in this feature.
 */

/**
 * Shortest identifier we are willing to trust. The identifier is searched for as a
 * substring inside candidate image sources, so a short one could appear in an unrelated
 * URL by chance. Real image hosts use around nine characters, so this floor rejects
 * nothing legitimate.
 */
export const MIN_IMAGE_ID_LENGTH = 6

/** Variant suffixes image hosts append to a resized copy of the same upload. */
const SIZE_SUFFIX = /_(?:th|md|sm|lg|full|big|o)$/i

const FILE_EXTENSION = /\.[a-z0-9]+$/i

/**
 * Image hosts use plain alphanumeric path segments. Anything else means we parsed something
 * that was never an image URL: `new URL` with a base happily turns arbitrary text into a
 * path, so length alone is not enough to tell a real identifier from noise.
 */
const VALID_IDENTIFIER = /^[A-Za-z0-9_\-/]+$/

/**
 * Query parameters image proxies use to carry the original URL.
 *
 * Mediavida does not serve external images directly: it rewrites them through wsrv.nl, so a
 * published card arrives as `https://wsrv.nl/?n=-1&output=webp&url=<encoded original>`. The
 * proxy's own path carries nothing, so without unwrapping there is no identifier to find.
 */
const PROXY_URL_PARAMS = ['url', 'u', 'src']

/** How many nested proxies to unwrap before giving up, in case one ever points at itself. */
const MAX_PROXY_DEPTH = 3

function unwrapProxiedUrl(parsed: URL): string | null {
	for (const param of PROXY_URL_PARAMS) {
		// searchParams decodes for us, so %2F is a slash again by the time we see it.
		const value = parsed.searchParams.get(param)
		if (value && /^https?:\/\//i.test(value)) return value
	}

	return null
}

/**
 * Stable identifier inside an uploaded card URL, or null when nothing usable can be
 * extracted. A null result means the record can never be confirmed automatically, which
 * is the safe outcome: it stays pending rather than matching the wrong image.
 *
 * The identifier is the WHOLE path, not just the filename, because the two hosts we upload
 * to put their id in different places: freeimage.host serves `iili.io/<id>.png`, while
 * ImgBB serves `i.ibb.co/<id>/<generic-name>.jpg`. Taking only the last segment would throw
 * away ImgBB's real identifier and keep a filename we generate ourselves.
 */
export function extractImageId(url: string, depth = 0): string | null {
	if (!url) return null

	let parsed: URL
	try {
		// The base only matters for relative inputs; the pathname is what we read either way.
		parsed = new URL(url, 'https://mvp.invalid')
	} catch {
		return null
	}

	// A proxied image's identity is the identity of what it proxies.
	if (depth < MAX_PROXY_DEPTH) {
		const original = unwrapProxiedUrl(parsed)
		if (original) return extractImageId(original, depth + 1)
	}

	const segments = parsed.pathname.split('/').filter(Boolean)
	if (segments.length === 0) return null

	// Only the filename carries an extension and a size suffix. Directory segments are the
	// host's own id and must survive untouched.
	const fileStem = segments[segments.length - 1].replace(FILE_EXTENSION, '').replace(SIZE_SUFFIX, '')
	const identifier = [...segments.slice(0, -1), fileStem].join('/')

	if (!VALID_IDENTIFIER.test(identifier)) return null

	return identifier.length >= MIN_IMAGE_ID_LENGTH ? identifier : null
}

/**
 * True when a candidate image source carries the given identifier.
 *
 * Extraction comes first because a substring test is not enough on its own: Mediavida serves
 * images through a proxy that percent-encodes the original URL, and an ImgBB identifier spans
 * two path segments, so its slash arrives as %2F and the raw substring never matches. The
 * substring check stays as a fallback for URL shapes we have not met yet.
 */
export function sourceMatchesImageId(source: string, imageId: string): boolean {
	if (!source || imageId.length < MIN_IMAGE_ID_LENGTH) return false
	if (extractImageId(source) === imageId) return true

	return source.includes(imageId)
}
