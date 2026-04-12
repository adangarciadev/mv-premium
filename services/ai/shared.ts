/**
 * Shared AI Utilities
 * Common functions used by AI services.
 */

import type { ChatMessage } from '@/types/ai'
import { logger } from '@/lib/logger'

/**
 * Sanitize chat history to ensure proper alternation.
 * Merges consecutive user messages into a single message.
 */
export function sanitizeHistory(history: ChatMessage[]): ChatMessage[] {
	const sanitized: ChatMessage[] = []

	for (const msg of history) {
		const lastMsg = sanitized[sanitized.length - 1]
		if (msg.role === 'user' && lastMsg?.role === 'user') {
			const existingText = lastMsg.parts.find(p => 'text' in p)
			const newText = msg.parts.find(p => 'text' in p)
			if (existingText && newText && 'text' in existingText && 'text' in newText) {
				existingText.text += '\n\n' + newText.text
				continue
			}
		}
		sanitized.push(msg)
	}

	return sanitized
}

/**
 * Build a full prompt with optional context wrapper.
 */
export function buildFullPrompt(prompt: string, context?: string): string {
	if (!context) return prompt

	return `CONTEXTO DEL USUARIO:
---
${context}
---

PETICIÓN DEL USUARIO:
${prompt}`
}

/**
 * Extract text from the last model response in a chat history.
 */
export function extractModelResponse(messages: ChatMessage[]): string {
	const lastModelMsg = [...messages].reverse().find(m => m.role === 'model')
	if (!lastModelMsg) return ''

	const textPart = lastModelMsg.parts.find(p => 'text' in p)
	if (textPart && 'text' in textPart) {
		return textPart.text
	}
	return ''
}

/**
 * Robust JSON parsing from AI responses.
 * Handles markdown code blocks, free-form text before/after JSON,
 * and common LLM JSON malformations (trailing commas, missing commas, etc.).
 *
 * Uses a 3-tier strategy:
 * 1. Direct parse (fast path for well-formed JSON)
 * 2. Regex-based structural repair (trailing commas, missing commas, control chars)
 * 3. Iterative position-based comma insertion (uses parser errors to guide fixes)
 */
export function parseAIJsonResponse<T = unknown>(text: string): T {
	// Strip markdown code blocks if present
	const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()

	// Find JSON object boundaries
	const start = cleaned.indexOf('{')
	const end = cleaned.lastIndexOf('}')

	if (start === -1 || end === -1 || start > end) {
		logger.error('No JSON object found in AI response:', text.substring(0, 200))
		throw new Error('No JSON object found in AI response')
	}

	const jsonStr = cleaned.substring(start, end + 1)

	// Tier 1: Try parsing as-is (fast path)
	try {
		return JSON.parse(jsonStr) as T
	} catch {
		// Fall through to repair
	}

	// Tier 2: Regex-based structural repair
	const repaired = repairJson(jsonStr)

	try {
		return JSON.parse(repaired) as T
	} catch {
		// Fall through to iterative repair
	}

	// Tier 3: Iterative position-based comma insertion
	// Uses the parser's own error to locate missing commas precisely
	const iterativeResult = repairJsonIterative(repaired)

	try {
		return JSON.parse(iterativeResult) as T
	} catch (e) {
		logger.error('Failed to parse AI JSON after all repair strategies:', (e as Error).message, jsonStr.substring(0, 300))
		throw e
	}
}

/**
 * Attempts to fix common JSON issues produced by LLMs:
 * - Trailing commas before ] or }
 * - Missing commas between array elements ("..." "..." → "...", "...")
 * - Missing commas between object entries ("key": "val" "key2" → "key": "val", "key2")
 * - Single-line control characters (literal newlines inside strings)
 */
export function repairJson(json: string): string {
	// FIRST: Sanitize control characters inside string literals.
	// This MUST run before regex-based fixes, because newlines inside strings
	// would otherwise be misinterpreted as structural separators by the regexes.
	let result = sanitizeStringLiterals(json)

	// 1. Remove trailing commas before ] or } (with optional whitespace/newlines)
	result = result.replace(/,(\s*[}\]])/g, '$1')

	// 2. Fix missing commas between string array elements: "..." "..." → "...", "..."
	//    Match: closing quote + whitespace/newline + opening quote (not preceded by : or ,)
	result = result.replace(/"(\s*\n\s*)"(?![:\s]*})/g, '",\n"')

	// 3. Fix missing commas between objects in array: } { → }, {
	result = result.replace(/}(\s*\n\s*){/g, '},\n{')

	// 4. Fix missing comma after string value before next key: "value" "nextKey":
	result = result.replace(/"(\s*\n\s*)"(\w+)"\s*:/g, '",\n"$2":')

	// 5. Fix missing comma after ] or } before next key: ] "nextKey": or } "nextKey":
	result = result.replace(/([}\]])(\s*\n\s*)"(\w+)"\s*:/g, '$1,\n"$3":')

	return result
}

/**
 * Iteratively inserts missing commas using the JSON parser's own error position.
 * When JSON.parse says "Expected ',' at position N", we insert a comma there and retry.
 * Handles up to MAX_ITERATIONS missing commas in a single response.
 */
function repairJsonIterative(json: string, maxIterations = 20): string {
	let current = json

	for (let i = 0; i < maxIterations; i++) {
		try {
			JSON.parse(current)
			return current // Successfully parsed
		} catch (e) {
			if (!(e instanceof SyntaxError)) throw e

			// Extract error position from the message: "... at position 1234 ..."
			const posMatch = e.message.match(/position\s+(\d+)/)
			if (!posMatch) throw e

			const pos = parseInt(posMatch[1], 10)
			if (pos <= 0 || pos >= current.length) throw e

			// Only insert comma if the error is about a missing comma/separator
			const isMissingComma =
				e.message.includes("Expected ','") ||
				e.message.includes("Expected '}'") ||
				e.message.includes('Expected comma') ||
				e.message.includes('Unexpected string')

			if (!isMissingComma) throw e

			// Insert a comma at the error position
			current = current.slice(0, pos) + ',' + current.slice(pos)
		}
	}

	return current
}

/**
 * Sanitizes control characters (newlines, tabs) that appear inside JSON string literals.
 * Tracks quote state to only modify content inside strings, not structural whitespace.
 */
function sanitizeStringLiterals(json: string): string {
	const chars = [...json]
	const out: string[] = []
	let inString = false
	let prevChar = ''

	for (const ch of chars) {
		if (ch === '"' && prevChar !== '\\') {
			inString = !inString
			out.push(ch)
		} else if (inString && (ch === '\n' || ch === '\r' || ch === '\t')) {
			// Replace control chars inside strings with a space
			if (ch === '\t') out.push(' ')
			else if (ch === '\n' || ch === '\r') out.push(' ')
		} else {
			out.push(ch)
		}
		prevChar = ch
	}

	return out.join('')
}
