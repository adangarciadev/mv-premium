/**
 * AI Service - Gemini API via Background Script
 * Simplified version - only for generating text (summaries, rewrites, etc.)
 */

import type { AIService, RewriteStyle, ChatMessage, ChatPart } from '@/types/ai'
import { logger } from '@/lib/logger'
import { getSettings } from '@/store/settings-store'
import { sendMessage } from '@/lib/messaging'

// --- GEMINI SERVICE ---
class GeminiService implements AIService {
	constructor(private apiKey: string, private model: string) {}

	/** Get the model name */
	getName() {
		return this.model
	}

	/** Get the provider identifier */
	getProvider() {
		return 'gemini' as const
	}

	/** Check if the service is configured with an API key */
	async isAvailable() {
		return !!this.apiKey
	}

	/**
	 * Send a chat request to Gemini
	 * @param history - Array of chat messages
	 * @returns Updated chat history including the model's response
	 */
	async chat(history: ChatMessage[]): Promise<ChatMessage[]> {
		// Sanitize history for proper alternation
		const sanitizedHistory: ChatMessage[] = []

		for (let i = 0; i < history.length; i++) {
			const msg = history[i]

			// Skip duplicate user messages
			const lastMsg = sanitizedHistory[sanitizedHistory.length - 1]
			if (msg.role === 'user' && lastMsg?.role === 'user') {
				const existingText = lastMsg.parts.find(p => 'text' in p)
				const newText = msg.parts.find(p => 'text' in p)
				if (existingText && newText && 'text' in existingText && 'text' in newText) {
					existingText.text += '\n\n' + newText.text
					continue
				}
			}

			sanitizedHistory.push(msg)
		}

		const result = await sendMessage('generateGemini', {
			apiKey: this.apiKey,
			model: this.model,
			history: sanitizedHistory,
			tools: undefined,
		})

		if (!result.success) throw new Error(result.error || 'Error de conexión IA')

		// Parse response
		const modelParts: ChatPart[] = []
		if (result.text) modelParts.push({ text: result.text })

		const modelMessage: ChatMessage = { role: 'model', parts: modelParts }
		return [...sanitizedHistory, modelMessage]
	}

	/**
	 * Generate text based on a prompt and optional context
	 * @param prompt - The user's request
	 * @param context - Optional context to provide to the AI
	 * @returns Generated text response
	 */
	async generate(prompt: string, context?: string): Promise<string> {
		try {
			let fullPrompt = prompt
			if (context) {
				// We use Spanish labels for the prompt structure even if labels are technical,
				// as the AI model is instructed to act as a Spanish assistant.
				fullPrompt = `CONTEXTO DEL USUARIO:
---
${context}
---

PETICIÓN DEL USUARIO:
${prompt}`
			}

			const messages = await this.chat([{ role: 'user', parts: [{ text: fullPrompt }] }])
			const lastModelMsg = messages.reverse().find(m => m.role === 'model')
			if (!lastModelMsg) return ''

			const textPart = lastModelMsg.parts.find(p => 'text' in p)
			if (textPart && 'text' in textPart) {
				return textPart.text
			}
			return ''
		} catch (e) {
			logger.error('Gemini generate error:', e)
			throw new Error(e instanceof Error ? e.message : 'Error generating text')
		}
	}

	/**
	 * Summarize a given text
	 * @param text - Text to summarize
	 * @returns Summarized text
	 */
	async summarize(text: string) {
		const prompt = `Eres un asistente de escritura en español.

TAREA: Resume el siguiente texto en 2-3 frases claras y concisas.
- Extrae las ideas principales
- Mantén el tono original
- No añadas información nueva

TEXTO:
${text}

Responde SOLO con el resumen, sin explicaciones ni introducciones.`
		return this.generate(prompt)
	}

	/**
	 * Rewrite text in a specific style
	 * @param text - Text to rewrite
	 * @param style - The desired writing style (formal, casual, etc.)
	 * @returns Rewritten text
	 */
	async rewrite(text: string, style: RewriteStyle = 'formal') {
		const stylePrompts: Record<RewriteStyle, string> = {
			formal: `Reescribe el texto con tono formal y profesional.
- Usa vocabulario más elaborado
- Evita coloquialismos
- Mantén la estructura de párrafos`,
			casual: `Reescribe el texto con tono casual y cercano.
- Usa un lenguaje más relajado y amigable
- Puedes añadir algún emoji si queda natural
- Mantén el mensaje original`,
			concise: `Acorta el texto manteniendo las ideas clave.
- Elimina redundancias y muletillas
- Usa frases más directas
- Reduce a la mitad si es posible`,
			detailed: `Expande el texto añadiendo más contexto y detalles.
- Desarrolla las ideas principales
- Añade ejemplos o aclaraciones si es útil
- Mantén el tono original`,
			friendly: `Reescribe el texto con tono amigable y cercano.
- Usa un lenguaje cálido y empático
- Haz que suene como si hablaras con un amigo
- Mantén el contenido original`,
		}

		const prompt = `Eres un asistente de escritura en español para foros de internet.

INSTRUCCIONES:
${stylePrompts[style]}

REGLAS:
- Mantén cualquier formato BBCode o markdown existente ([b], [i], [url], etc.)
- NO añadas ni elimines información, solo cambia la forma
- Responde SOLO con el texto reescrito

TEXTO ORIGINAL:
${text}`

		return this.generate(prompt)
	}

	/**
	 * Polish and correct text (grammar, style, clarity)
	 * @param text - Text to polish
	 * @returns Polished text
	 */
	async polish(text: string) {
		const prompt = `Eres un corrector de estilo experto para textos de foro en español.

TAREA: Mejora la redacción del siguiente texto aplicando estas reglas:

1. ORTOGRAFÍA Y GRAMÁTICA
   - Corrige faltas de ortografía y acentos
   - Arregla errores gramaticales y de concordancia
   - Mejora la puntuación

2. FLUIDEZ Y CLARIDAD
   - Mejora la estructura de las frases si es necesario
   - Elimina muletillas y redundancias
   - Haz el texto más claro sin cambiar su significado

3. LO QUE NO DEBES CAMBIAR
   - Mantén el tono y voz del autor (si es informal, déjalo informal)
   - Conserva las expresiones coloquiales intencionadas
   - Respeta el formato BBCode/markdown ([b], [i], [url], etc.)
   - NO añadas ni elimines contenido, solo mejora la forma

TEXTO A MEJORAR:
${text}

Responde ÚNICAMENTE con el texto mejorado, sin explicaciones ni comentarios.`

		return this.generate(prompt)
	}
}

/**
 * Factory function to get the configured AI service instance
 * @returns AIService instance or null if not configured
 */
export async function getAIService(): Promise<AIService | null> {
	const settings = await getSettings()
	const { geminiApiKey, aiModel = 'gemini-2.5-flash' } = settings

	if (!geminiApiKey) {
		return null
	}

	return new GeminiService(geminiApiKey, aiModel)
}

/**
 * Test Gemini API connection
 * @param apiKey - API key to test
 * @returns Success status and descriptive message
 */
export async function testGeminiConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
	try {
		const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)

		if (response.ok) {
			const data = await response.json()
			const modelCount = data.models?.length || 0
			return { success: true, message: `✓ Connection successful. ${modelCount} models available.` }
		}

		const error = await response.json()
		return { success: false, message: error.error?.message || 'Invalid API Key' }
	} catch {
		return { success: false, message: 'Connection error' }
	}
}

/**
 * Get list of available Gemini models for the UI
 * @returns Array of model options with descriptions
 */
export function getAvailableModels() {
	return [
		{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Recomendado (Default)' },
		{ value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', description: 'Versión ligera' },
		{ value: 'gemini-3-flash', label: 'Gemini 3.0 Flash', description: 'Preview Última Generación' },
		{ value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Más potente' },
		{ value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', description: 'Rápido y estable' },
	]
}
