/**
 * Slash Command Handler
 *
 * Detects /shortcut patterns in text and finds matching templates.
 * Used for quick template insertion via keyboard.
 */
import type { Draft } from '../storage'

// ============================================================================
// TYPES
// ============================================================================

export interface SlashCommandState {
	/** Whether a slash command is currently being typed */
	isActive: boolean
	/** The query text after the slash (e.g., "test" for "/test") */
	query: string
	/** Start position of the slash character */
	startIndex: number
	/** Current cursor position */
	endIndex: number
	/** Matching templates sorted by relevance */
	matches: TemplateMatch[]
	/** Currently selected index in matches (for keyboard nav) */
	selectedIndex: number
}

export interface TemplateMatch {
	id: string
	title: string
	/** The trigger/shortcut for this template (e.g., "saludo") */
	trigger: string
	content: string
	/** Optional subforum associated with this template */
	subforum?: string
	/** Optional category associated with this template */
	category?: string
	/** Match score for sorting (higher = better match) */
	score: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum number of matches to return */
const MAX_MATCHES = 5

/** Characters that break a slash command (before the /) */
const BREAK_CHARS = /[\s\n\r]/

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Analyzes text at cursor position to detect a slash command trigger (/pattern).
 * @param text - Full textarea content
 * @param cursorPos - Current cursor index
 * @returns SlashCommandState if detected, null otherwise
 */
export function detectSlashCommand(text: string, cursorPos: number): SlashCommandState | null {
	// Find the start of the current "word" by looking backwards
	let startIndex = cursorPos - 1

	while (startIndex >= 0) {
		const char = text[startIndex]

		// Found a slash - check if it's valid
		if (char === '/') {
			// Slash at start of text is valid
			if (startIndex === 0) break

			// Slash after whitespace or newline is valid
			const prevChar = text[startIndex - 1]
			if (BREAK_CHARS.test(prevChar)) break

			// Slash in middle of word - not a command
			return null
		}

		// Found non-command character - not a command
		if (!/[a-z0-9-]/i.test(char)) {
			return null
		}

		startIndex--
	}

	// No slash found
	if (startIndex < 0 || text[startIndex] !== '/') {
		return null
	}

	// Extract the query (text between / and cursor)
	const query = text.substring(startIndex + 1, cursorPos).toLowerCase()

	return {
		isActive: true,
		query,
		startIndex,
		endIndex: cursorPos,
		matches: [],
		selectedIndex: 0,
	}
}

/**
 * Filters a list of templates to find matches for a given query string.
 * Uses a weighted scoring system to prioritize exact matches and prefixes.
 * @param query - The string after the slash
 * @param templates - Array of available draft templates
 * @returns Sorted list of matching templates
 */
export function findMatchingTemplates(query: string, templates: Draft[]): TemplateMatch[] {
	if (!templates || templates.length === 0) return []

	const normalizedQuery = query.toLowerCase().trim()

	// Filter templates with triggers and calculate scores
	const matches: TemplateMatch[] = templates
		.filter(t => t.trigger) // Only templates with triggers
		.map(template => {
			const trigger = template.trigger!.toLowerCase()
			let score = 0

			// Calculate match score
			if (normalizedQuery === '') {
				// Empty query - show all with triggers
				score = 1
			} else if (trigger === normalizedQuery) {
				// Exact match
				score = 100
			} else if (trigger.startsWith(normalizedQuery)) {
				// Starts with query
				score = 50 + (normalizedQuery.length / trigger.length) * 40
			} else if (trigger.includes(normalizedQuery)) {
				// Contains query
				score = 10 + (normalizedQuery.length / trigger.length) * 20
			}

			return {
				id: template.id,
				title: template.title || 'Sin título',
				trigger: template.trigger!,
				content: template.content,
				subforum: template.subforum,
				category: template.category,
				score,
			}
		})
		.filter(m => m.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, MAX_MATCHES)

	return matches
}

/**
 * Replaces the slash command trigger in the text with the full template content.
 * @param text - Full original content
 * @param state - Current active slash command state
 * @param content - Template content to insert
 * @returns Object with the new text and updated cursor position
 */
export function replaceSlashCommand(
	text: string,
	state: SlashCommandState,
	content: string
): { newText: string; newCursorPos: number } {
	const before = text.substring(0, state.startIndex)
	const after = text.substring(state.endIndex)
	const newText = before + content + after
	const newCursorPos = state.startIndex + content.length

	return { newText, newCursorPos }
}

/**
 * Generates a clean preview of the draft content (first 60 characters, with BBCode stripped).
 * @param content - The raw draft content
 * @returns Cleaned preview string
 */
export function getTemplatePreview(content: string, maxLength = 60): string {
	const stripped = content.replace(/\[.*?\]/g, '').trim()
	return stripped.length > maxLength ? stripped.slice(0, maxLength) + '...' : stripped
}
