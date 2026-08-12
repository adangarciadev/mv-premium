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
 * Stable identifier inside an uploaded card URL, or null when nothing usable can be
 * extracted. A null result means the record can never be confirmed automatically, which
 * is the safe outcome: it stays pending rather than matching the wrong image.
 *
 * The identifier is the WHOLE path, not just the filename, because the two hosts we upload
 * to put their id in different places: freeimage.host serves `iili.io/<id>.png`, while
 * ImgBB serves `i.ibb.co/<id>/<generic-name>.jpg`. Taking only the last segment would throw
 * away ImgBB's real identifier and keep a filename we generate ourselves.
 */
export function extractImageId(url: string): string | null {
	if (!url) return null

	let pathname: string
	try {
		// The base only matters for relative inputs; the pathname is what we read either way.
		pathname = new URL(url, 'https://mvp.invalid').pathname
	} catch {
		return null
	}

	const segments = pathname.split('/').filter(Boolean)
	if (segments.length === 0) return null

	// Only the filename carries an extension and a size suffix. Directory segments are the
	// host's own id and must survive untouched.
	const fileStem = segments[segments.length - 1].replace(FILE_EXTENSION, '').replace(SIZE_SUFFIX, '')
	const identifier = [...segments.slice(0, -1), fileStem].join('/')

	if (!VALID_IDENTIFIER.test(identifier)) return null

	return identifier.length >= MIN_IMAGE_ID_LENGTH ? identifier : null
}

/** True when a candidate image source carries the given identifier. */
export function sourceMatchesImageId(source: string, imageId: string): boolean {
	if (!source || imageId.length < MIN_IMAGE_ID_LENGTH) return false
	return source.includes(imageId)
}
