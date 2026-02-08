/**
 * Shared AI Utilities
 * Common functions used by both Gemini and Groq services.
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
 * Handles markdown code blocks and free-form text before/after JSON.
 * Finds the first `{` and last `}` to extract the JSON object.
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
	return JSON.parse(jsonStr) as T
}
