/**
 * Image URL Detector
 *
 * Detects if a URL points to an image using heuristics:
 * 1. File extension matching (.jpg, .png, etc.)
 * 2. Known image hosting domains (Unsplash, Imgur, etc.)
 * 3. Image-related query parameters (auto=format, fm=jpg, etc.)
 */

// ============================================================================
// Known Image Extensions
// ============================================================================

// Only extensions that Mediavida's [img] tag supports
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif']

// ============================================================================
// Known Image Hosting Domains
// ============================================================================

const IMAGE_DOMAINS = [
	// Unsplash
	'images.unsplash.com',
	'plus.unsplash.com',
	// Imgur
	'i.imgur.com',
	'imgur.com',
	// Reddit
	'i.redd.it',
	'preview.redd.it',
	// Twitter/X
	'pbs.twimg.com',
	// Giphy
	'media.giphy.com',
	'media0.giphy.com',
	'media1.giphy.com',
	'media2.giphy.com',
	'media3.giphy.com',
	'media4.giphy.com',
	// ImgBB
	'i.ibb.co',
	// TMDB
	'image.tmdb.org',
	// Discord
	'cdn.discordapp.com',
	'media.discordapp.net',
	// Cloudinary
	'res.cloudinary.com',
	// Mediavida
	'www.mediavida.com/imagenes',
	'static.mediavida.com',
	// Flickr
	'live.staticflickr.com',
	'farm66.staticflickr.com',
	// Pinterest
	'i.pinimg.com',
	// Tenor
	'media.tenor.com',
	// PostImages
	'i.postimg.cc',
	// Prnt.sc / Lightshot
	'image.prntscr.com',
	// Gyazo
	'i.gyazo.com',
]

// ============================================================================
// Image-Related Query Parameters
// ============================================================================

// Query params that indicate image content (only for supported formats)
const IMAGE_QUERY_PARAMS = [
	'fm=jpg',
	'fm=png',
	'fm=gif',
	'format=jpg',
	'format=png',
	'format=gif',
]

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validates if the provided string follows a correct URL format
 */
export function isValidUrl(text: string): boolean {
	try {
		const url = new URL(text.trim())
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

// ============================================================================
// Image Detection
// ============================================================================

/**
 * Check if a URL points to an image using heuristics
 *
 * @param url - The URL to check
 * @returns true if the URL is likely an image
 */
export function isImageUrl(url: string): boolean {
	if (!isValidUrl(url)) return false

	const trimmedUrl = url.trim()

	// 1. Check file extension (fast path)
	if (hasImageExtension(trimmedUrl)) return true

	// 2. Check known image domains
	if (isKnownImageDomain(trimmedUrl)) return true

	// 3. Check image-related query params
	if (hasImageQueryParams(trimmedUrl)) return true

	return false
}

/**
 * Checks if the URL path ends with a recognized image extension.
 * Handles both standard URL objects and malformed strings via regex.
 * @param url - The URL string to test
 */
function hasImageExtension(url: string): boolean {
	try {
		const urlObj = new URL(url)
		const pathname = urlObj.pathname.toLowerCase()

		// Remove query string influence, check pure pathname
		return IMAGE_EXTENSIONS.some(ext => pathname.endsWith(`.${ext}`))
	} catch {
		// Fallback to regex for malformed URLs
		const extensionRegex = new RegExp(`\\.(${IMAGE_EXTENSIONS.join('|')})(?:[?#]|$)`, 'i')
		return extensionRegex.test(url)
	}
}

/**
 * Checks if the URL hostname belongs to a known image-hosting domain.
 * Supports both exact matches and subdomain matching.
 * @param url - The URL to analyze
 */
function isKnownImageDomain(url: string): boolean {
	try {
		const urlObj = new URL(url)
		const hostname = urlObj.hostname.toLowerCase()

		return IMAGE_DOMAINS.some(domain => {
			// Exact match or subdomain match
			return hostname === domain || hostname.endsWith(`.${domain}`)
		})
	} catch {
		return false
	}
}

/**
 * Scans URL query parameters for common indicators that the resource is an image.
 * @param url - The URL to inspect
 */
function hasImageQueryParams(url: string): boolean {
	const lowerUrl = url.toLowerCase()
	return IMAGE_QUERY_PARAMS.some(param => lowerUrl.includes(param))
}
