/**
 * AI Service - Groq API via Background Script
 * Simplified version - only for generating text (summaries, rewrites, etc.)
 *
 * Groq uses an OpenAI-compatible API format.
 */

import type { AIService, ChatMessage, ChatPart } from '@/types/ai'
import { logger } from '@/lib/logger'
import { getSettings } from '@/store/settings-store'
import { sendMessage } from '@/lib/messaging'
import { setLastModelUsed } from './gemini-service'
import { sanitizeHistory, buildFullPrompt, extractModelResponse } from './shared'
import type { GroqModel } from '@/store/settings-types'

// --- GROQ SERVICE ---
class GroqService implements AIService {
	constructor(private apiKey: string, private model: string) {}

	getName() {
		return this.model
	}

	getProvider() {
		return 'groq' as const
	}

	async isAvailable() {
		return !!this.apiKey
	}

	async chat(history: ChatMessage[]): Promise<ChatMessage[]> {
		const sanitized = sanitizeHistory(history)

		const result = await sendMessage('generateGroq', {
			apiKey: this.apiKey,
			model: this.model,
			history: sanitized,
		})

		if (!result.success) throw new Error(result.error || 'Error de conexión IA')

		if (result.modelUsed) setLastModelUsed(result.modelUsed)

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
			logger.error('Groq generate error:', e)
			throw new Error(e instanceof Error ? e.message : 'Error generating text')
		}
	}
}

/**
 * Factory function to get the configured Groq service instance
 */
export async function getGroqService(): Promise<AIService | null> {
	const settings = await getSettings()
	const { groqApiKey, groqModel = 'moonshotai/kimi-k2-instruct' } = settings

	if (!groqApiKey) {
		return null
	}

	return new GroqService(groqApiKey, groqModel)
}

/**
 * Test Groq API connection
 */
export async function testGroqConnection(
	apiKey: string
): Promise<{ success: boolean; message: string; availableModelIds?: string[] }> {
	try {
		const response = await fetch('https://api.groq.com/openai/v1/models', {
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		})

		if (response.ok) {
			const data = await response.json()
			const models: { id: string }[] = data.data || []

			return {
				success: true,
				message: `Conexión correcta. ${models.length} modelos disponibles.`,
				availableModelIds: models.map(m => m.id),
			}
		}

		const error = await response.json()
		return { success: false, message: error.error?.message || 'API Key inválida' }
	} catch {
		return { success: false, message: 'Error de conexión' }
	}
}

/**
 * Get list of available Groq models for the UI
 */
export function getAvailableGroqModels(): { value: GroqModel; label: string; description: string }[] {
	return [
		{
			value: 'moonshotai/kimi-k2-instruct',
			label: 'Moonshot Kimi K2',
			description: 'Análisis profundo - Ideal para hilos largos',
		},
	]
}
