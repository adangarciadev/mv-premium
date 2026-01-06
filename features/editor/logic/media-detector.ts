/**
 * Media URL Detector
 *
 * Detects if a URL points to embeddable media content that Mediavida's
 * [media] tag supports: YouTube, Instagram, Twitter/X, Amazon, Steam, etc.
 */

import { isValidUrl } from './image-detector'

// ============================================================================
// Media URL Patterns
// ============================================================================

/**
 * Patterns for detecting media URLs that should be wrapped with [media] tag.
 * Each pattern is a regex that matches the URL structure.
 */
const MEDIA_PATTERNS: { name: string; pattern: RegExp }[] = [
	// YouTube
	{
		name: 'youtube',
		pattern: /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/i,
	},
	// Instagram
	{
		name: 'instagram',
		pattern: /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/i,
	},
	// Twitter/X
	{
		name: 'twitter',
		pattern: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[A-Za-z0-9_]+\/status\/\d+/i,
	},
	// Amazon (products)
	{
		name: 'amazon',
		pattern: /^https?:\/\/(www\.)?amazon\.(es|com|co\.uk|de|fr|it)\/.*\/(dp|gp\/product)\/[A-Z0-9]+/i,
	},
	// Steam (store pages)
	{
		name: 'steam',
		pattern: /^https?:\/\/store\.steampowered\.com\/app\/\d+/i,
	},
	// Twitch clips
	{
		name: 'twitch-clip',
		pattern: /^https?:\/\/(www\.)?(twitch\.tv\/[A-Za-z0-9_]+\/clip\/|clips\.twitch\.tv\/)[A-Za-z0-9_-]+/i,
	},
	// Twitch videos
	{
		name: 'twitch-video',
		pattern: /^https?:\/\/(www\.)?twitch\.tv\/videos\/\d+/i,
	},
	// Spotify (tracks, albums, playlists)
	{
		name: 'spotify',
		pattern: /^https?:\/\/open\.spotify\.com\/(track|album|playlist|episode)\/[A-Za-z0-9]+/i,
	},
	// TikTok
	{
		name: 'tiktok',
		pattern: /^https?:\/\/(www\.)?(tiktok\.com\/@[A-Za-z0-9_.]+\/video\/\d+|vm\.tiktok\.com\/[A-Za-z0-9]+)/i,
	},
	// Vimeo
	{
		name: 'vimeo',
		pattern: /^https?:\/\/(www\.)?vimeo\.com\/\d+/i,
	},
	// SoundCloud
	{
		name: 'soundcloud',
		pattern: /^https?:\/\/(www\.)?soundcloud\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+/i,
	},
	// Gfycat
	{
		name: 'gfycat',
		pattern: /^https?:\/\/(www\.)?gfycat\.com\/[A-Za-z]+/i,
	},
	// Streamable
	{
		name: 'streamable',
		pattern: /^https?:\/\/(www\.)?streamable\.com\/[A-Za-z0-9]+/i,
	},
]

// ============================================================================
// Media Detection
// ============================================================================

/**
 * Check if a URL is a media URL that should be wrapped with [media] tag
 *
 * @param url - The URL to check
 * @returns true if the URL is embeddable media
 */
export function isMediaUrl(url: string): boolean {
	if (!isValidUrl(url)) return false

	const trimmedUrl = url.trim()

	return MEDIA_PATTERNS.some(({ pattern }) => pattern.test(trimmedUrl))
}

/**
 * Get the type of media for a URL (for debugging/logging)
 *
 * @param url - The URL to check
 * @returns The media type name or null if not a media URL
 */
export function getMediaType(url: string): string | null {
	if (!isValidUrl(url)) return null

	const trimmedUrl = url.trim()

	for (const { name, pattern } of MEDIA_PATTERNS) {
		if (pattern.test(trimmedUrl)) {
			return name
		}
	}

	return null
}
