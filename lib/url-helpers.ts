/**
 * URL Helpers
 * Centralized utilities for parsing Mediavida URLs and extracting thread/page info
 */

import { MV_SELECTORS } from '@/constants/mediavida-selectors'
import { ALL_SUBFORUMS } from '@/lib/subforums'

// Set of valid subforum slugs for O(1) lookup
const VALID_SUBFORUM_SLUGS = new Set(ALL_SUBFORUMS.map(s => s.slug))

// =============================================================================
// Thread URL Utilities
// =============================================================================

/**
 * Get thread ID from current URL (normalized without page number or /live suffix)
 * Example: "/foro/cine/titulo-del-hilo-123456"
 */
export function getThreadId(): string {
	let path = window.location.pathname
	// Remove /live suffix (for live threads)
	path = path.replace(/\/live\/?$/, '')
	// Remove page number at the end (e.g., /1331)
	path = path.replace(/\/\d+\/?$/, '')
	// Remove trailing slash
	if (path.endsWith('/')) {
		path = path.slice(0, -1)
	}
	return path
}

/**
 * Get current page number from URL
 * Returns 1 if no page number is present
 */
export function getCurrentPage(): number {
	const match = window.location.pathname.match(/\/(\d+)\/?$/)
	return match ? parseInt(match[1], 10) : 1
}

/**
 * Check if current URL is a thread page
 */
export function isThreadUrl(path?: string): boolean {
	const url = path || window.location.pathname
	return /^\/foro\/[^/]+\/[^/]+-\d+/.test(url)
}

// =============================================================================
// Subforum Utilities
// =============================================================================

export interface SubforumInfo {
	/** Subforum name (capitalized, e.g., "Off Topic") */
	name: string
	/** Subforum path (e.g., "/foro/off-topic") */
	path: string
	/** Subforum slug (e.g., "off-topic") */
	slug: string
}

/**
 * Extract subforum info from a thread path
 * @param threadId - Thread path (e.g., "/foro/cine/titulo-123456")
 */
export function getSubforumInfo(threadId: string): SubforumInfo {
	// Strict validation: must start with /foro/ to be a subforum
	if (!threadId.startsWith('/foro/') || threadId === '/foro/') {
		return { name: 'Unknown', path: '', slug: '' }
	}

	const parts = threadId.split('/').filter(Boolean)
	// Format: foro/subforum-name/thread-slug
	if (parts.length >= 2) {
		const subforumSlug = parts[1]

		// Validate against known subforum slugs
		// This prevents URLs like /foro/post.php or /foro/spy from being treated as subforums
		if (!VALID_SUBFORUM_SLUGS.has(subforumSlug)) {
			return { name: 'Unknown', path: '', slug: '' }
		}

		return {
			name: slugToName(subforumSlug),
			path: `/foro/${subforumSlug}`,
			slug: subforumSlug,
		}
	}
	return { name: 'Unknown', path: '', slug: '' }
}

/**
 * Convert a slug to a readable name
 * Example: "off-topic" → "Off Topic"
 */
export function slugToName(slug: string): string {
	return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// =============================================================================
// Title Cleaning Utilities
// =============================================================================

/**
 * Clean a thread title by removing Mediavida suffixes and page numbers
 * Works with both document.title and h1 content
 */
export function cleanThreadTitle(title: string): string {
	return title
		.replace(/\s*\|\s*Página\s*\d+\s*/gi, '') // Remove "| Página X"
		.replace(/\s*\|\s*Mediavida\s*$/i, '') // Remove "| Mediavida"
		.replace(/\s*-\s*Mediavida\s*$/i, '') // Remove "- Mediavida"
		.replace(/\s*Página\s*\d+\s*$/i, '') // Remove trailing "Página X"
		.trim()
}

/**
 * Extract thread title from the current page DOM
 * Tries h1 first, falls back to document.title
 */
export function extractThreadTitle(): string {
	const h1 = document.querySelector(MV_SELECTORS.THREAD.THREAD_TITLE_ALL)
	let title = h1?.textContent?.trim() || ''

	if (!title) {
		title = document.title
	}

	return cleanThreadTitle(title)
}

// =============================================================================
// Thread Slug Utilities
// =============================================================================

/**
 * Convert a thread slug to a readable title
 * Example: "titulo-del-hilo-123456" → "Titulo Del Hilo"
 */
export function slugToTitle(slug: string): string {
	return slug
		.replace(/-\d+$/, '') // Remove trailing ID number
		.split('-')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
}

/**
 * Extract the numeric ID from a thread path
 * Example: "/foro/cine/titulo-123456" → 123456
 */
export function extractThreadNumericId(threadPath: string): number | null {
	const match = threadPath.match(/-(\d+)$/)
	return match ? parseInt(match[1], 10) : null
}
