/**
 * Shared helpers for thread summarizer (single-page & multi-page).
 *
 * - Exponential-backoff retry on 429 / Rate Limit errors
 * - Robust avatar hydration (exact-first, strict partial fallback)
 * - JSON parse with AI-powered repair fallback
 */

import { parseAIJsonResponse } from '@/services/ai/shared'
import { logger } from '@/lib/logger'

// =============================================================================
// CONSTANTS
// =============================================================================

const RETRY_MAX_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 5000 // 5s → 10s → 20s

const AVATAR_PARTIAL_MATCH_MIN_LENGTH = 4

/** Structure hint used by the AI repair prompt for summary JSON. */
export const SUMMARY_JSON_STRUCTURE =
	'{"topic":"string","keyPoints":["string"],"participants":[{"name":"string","contribution":"string"}],"status":"string"}'

/** Structure hint used by the AI repair prompt for user analysis JSON. */
export const USER_ANALYSIS_JSON_STRUCTURE =
	'{"username":"string","tagline":"string","profile":"string","topics":["string"],"interactions":["string"],"style":"string","highlights":["string"],"verdict":"string"}'

export interface GenerateWithRetryRetryEvent {
	/** 1-based index of the failed attempt */
	failedAttempt: number
	/** 1-based index of the next attempt that will run after the delay */
	nextAttempt: number
	/** Total attempts allowed in this helper */
	maxAttempts: number
	delayMs: number
	error: unknown
}

export interface GenerateWithRetryOptions {
	onRetry?: (event: GenerateWithRetryRetryEvent) => void
}

export interface ParseJsonFallbackOptions {
	onRepairStart?: (info: { label: string; reason: string }) => void
	repairRetryOptions?: GenerateWithRetryOptions
}

// =============================================================================
// SLEEP
// =============================================================================

export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

// =============================================================================
// RETRY WITH EXPONENTIAL BACKOFF
// =============================================================================

export function isRateLimitError(error: unknown): boolean {
	if (!(error instanceof Error)) return false
	const msg = error.message
	return (
		msg.includes('429') ||
		msg.includes('Rate limit') ||
		msg.includes('rate_limit') ||
		msg.includes('TPM') ||
		msg.includes('Límite de velocidad') ||
		msg.includes('modelos agotados')
	)
}

/**
 * Wraps aiService.generate with exponential backoff retry on 429 errors.
 * Retries up to 3 times with delays of 5 s, 10 s, 20 s.
 */
export async function generateWithRetry(
	aiService: { generate: (prompt: string) => Promise<string> },
	prompt: string,
	options?: GenerateWithRetryOptions
): Promise<string> {
	for (let attempt = 0; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
		try {
			return await aiService.generate(prompt)
		} catch (error) {
			const isLast = attempt === RETRY_MAX_ATTEMPTS
			if (!isRateLimitError(error) || isLast) {
				throw error
			}

			const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
			options?.onRetry?.({
				failedAttempt: attempt + 1,
				nextAttempt: attempt + 2,
				maxAttempts: RETRY_MAX_ATTEMPTS + 1,
				delayMs: delay,
				error,
			})
			logger.warn(
				`Rate limit (429) en intento ${attempt + 1}/${RETRY_MAX_ATTEMPTS + 1}. Reintentando en ${delay}ms...`
			)
			await sleep(delay)
		}
	}

	// Unreachable — the loop always returns or throws
	throw new Error('generateWithRetry: bucle agotado sin resultado')
}

// =============================================================================
// AVATAR HYDRATION
// =============================================================================

/**
 * Matches AI-generated participant names to real avatar URLs.
 *
 * Priority:
 * 1. Exact case-insensitive match (safe, no false positives)
 * 2. Strict partial match (only if both names are >= 4 chars to prevent
 *    short names like "Ana" from matching "AnaMaria")
 */
export function hydrateParticipantAvatars(
	participants: { name: string; contribution: string }[],
	avatarMap: Map<string, string>
): { name: string; contribution: string; avatarUrl?: string }[] {
	return participants.map(p => {
		const cleanName = p.name.toLowerCase().trim()
		let avatarUrl: string | undefined

		// 1. Exact case-insensitive match
		for (const [key, url] of avatarMap.entries()) {
			if (key.toLowerCase().trim() === cleanName) {
				avatarUrl = url
				break
			}
		}

		// 2. Strict partial match (both names must be >= minimum length)
		if (!avatarUrl && cleanName.length >= AVATAR_PARTIAL_MATCH_MIN_LENGTH) {
			for (const [key, url] of avatarMap.entries()) {
				const keyLower = key.toLowerCase().trim()
				if (keyLower.length < AVATAR_PARTIAL_MATCH_MIN_LENGTH) continue
				if (keyLower.includes(cleanName) || cleanName.includes(keyLower)) {
					avatarUrl = url
					break
				}
			}
		}

		if (avatarUrl?.startsWith('//')) {
			avatarUrl = 'https:' + avatarUrl
		}

		return { ...p, avatarUrl }
	})
}

// =============================================================================
// JSON PARSE WITH AI REPAIR FALLBACK
// =============================================================================

/**
 * Parses an AI response as JSON. If parsing fails, sends a repair prompt
 * to the AI and tries once more.
 *
 * @param rawResponse  - Raw text from the AI
 * @param aiService    - Service to call for repair
 * @param label        - Human label for log messages (e.g. "resumen final")
 * @param structureHint - JSON structure string shown to the AI in the repair prompt
 */
export async function parseJsonWithAIFallback<T>(
	rawResponse: string,
	aiService: { generate: (prompt: string) => Promise<string> },
	label: string,
	structureHint: string = SUMMARY_JSON_STRUCTURE,
	options?: ParseJsonFallbackOptions
): Promise<T> {
	let repairReason = 'Respuesta no parseable como JSON'
	try {
		return parseAIJsonResponse<T>(rawResponse)
	} catch (error) {
		repairReason = error instanceof Error ? error.message : String(error)
		logger.warn(`JSON inválido en ${label}. Intentando autocorrección con IA.`, repairReason)
	}

	options?.onRepairStart?.({ label, reason: repairReason })

	const repairPrompt = `Devuelve SOLO JSON válido (sin markdown) corrigiendo comas, comillas y texto extra.
No inventes datos.
Estructura exacta:
${structureHint}
Contenido:
${rawResponse}`

	const repaired = await generateWithRetry(aiService, repairPrompt, options?.repairRetryOptions)
	return parseAIJsonResponse<T>(repaired)
}
