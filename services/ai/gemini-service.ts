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
	constructor(private model: string) {}

	getName() {
		return this.model
	}

	async isAvailable() {
		return true
	}

	async chat(history: ChatMessage[]): Promise<ChatMessage[]> {
		const sanitized = sanitizeHistory(history)

		const result = await sendMessage('generateGemini', {
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
 */
export async function getAIService(): Promise<AIService | null> {
	const settings = await getSettings()
	const { geminiApiKey, aiModel = 'gemini-3-flash-preview' } = settings

	if (geminiApiKey) {
		return new GeminiService(aiModel)
	}

	return null
}

/**
 * Test Gemini API connection
 */
export async function testGeminiConnection(): Promise<{ success: boolean; message: string; availableModelIds?: string[] }> {
	return sendMessage('testGeminiConnection', undefined)
}

/**
 * Get list of available Gemini models for the UI
 */
export function getAvailableModels() {
	return [
		{ value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash Preview', description: 'Recomendado (Default)' },
		{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Estable y equilibrado' },
		{ value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', description: 'Versión ligera' },
	]
}
