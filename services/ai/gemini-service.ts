/**
 * AI Service - Gemini API via Background Script
 * Simplified version - only for generating text (summaries, rewrites, etc.)
 */

import type { AIService, ChatMessage, ChatPart } from '@/types/ai'
import { logger } from '@/lib/logger'
import { getSettings } from '@/store/settings-store'
import { sendMessage } from '@/lib/messaging'
import { sanitizeHistory, buildFullPrompt, extractModelResponse } from './shared'

// --- LAST MODEL TRACKING ---
/** Tracks the actual model used in the last AI call (may differ from configured due to fallback) */
let _lastModelUsed: string | null = null
export function getLastModelUsed(): string | null {
	return _lastModelUsed
}
export function setLastModelUsed(model: string | null) {
	_lastModelUsed = model
}

// --- GEMINI SERVICE ---
class GeminiService implements AIService {
	constructor(private apiKey: string, private model: string) {}

	getName() {
		return this.model
	}

	getProvider() {
		return 'gemini' as const
	}

	async isAvailable() {
		return !!this.apiKey
	}

	async chat(history: ChatMessage[]): Promise<ChatMessage[]> {
		const sanitized = sanitizeHistory(history)

		const result = await sendMessage('generateGemini', {
			apiKey: this.apiKey,
			model: this.model,
			history: sanitized,
		})

		if (!result.success) throw new Error(result.error || 'Error de conexión IA')

		if (result.modelUsed) _lastModelUsed = result.modelUsed

		const modelParts: ChatPart[] = []
		if (result.text) modelParts.push({ text: result.text })

		const modelMessage: ChatMessage = { role: 'model', parts: modelParts }
		return [...sanitized, modelMessage]
	}

	async generate(prompt: string, context?: string): Promise<string> {
		try {
			const fullPrompt = buildFullPrompt(prompt, context)
			const messages = await this.chat([{ role: 'user', parts: [{ text: fullPrompt }] }])
			return extractModelResponse(messages)
		} catch (e) {
			logger.error('Gemini generate error:', e)
			throw new Error(e instanceof Error ? e.message : 'Error generating text')
		}
	}
}

/**
 * Factory function to get the configured AI service instance.
 * Uses the aiProvider setting to determine which service to return.
 * Falls back to the other provider if the preferred one isn't configured.
 */
export async function getAIService(): Promise<AIService | null> {
	const settings = await getSettings()
	const { geminiApiKey, groqApiKey, aiModel = 'gemini-2.5-flash', aiProvider = 'gemini' } = settings

	if (aiProvider === 'groq') {
		if (groqApiKey) {
			const { getGroqService } = await import('./groq-service')
			return getGroqService()
		}
		if (geminiApiKey) {
			return new GeminiService(geminiApiKey, aiModel)
		}
	} else {
		if (geminiApiKey) {
			return new GeminiService(geminiApiKey, aiModel)
		}
		if (groqApiKey) {
			const { getGroqService } = await import('./groq-service')
			return getGroqService()
		}
	}

	return null
}

/**
 * Test Gemini API connection
 */
export async function testGeminiConnection(
	apiKey: string
): Promise<{ success: boolean; message: string; availableModelIds?: string[] }> {
	try {
		const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)

		if (response.ok) {
			const data = await response.json()
			const models: { name: string }[] = data.models || []

			const geminiIds = models
				.map(m => m.name.replace(/^models\//, ''))
				.filter(id => id.startsWith('gemini'))

			return {
				success: true,
				message: `Conexion correcta. ${models.length} modelos disponibles (${geminiIds.length} Gemini).`,
				availableModelIds: geminiIds,
			}
		}

		const error = await response.json()
		return { success: false, message: error.error?.message || 'Invalid API Key' }
	} catch {
		return { success: false, message: 'Error de conexion' }
	}
}

/**
 * Get list of available Gemini models for the UI
 */
export function getAvailableModels() {
	return [
		{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Recomendado (Default)' },
		{ value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', description: 'Versión ligera' },
		{ value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash', description: 'Preview Última Generación' },
	]
}
