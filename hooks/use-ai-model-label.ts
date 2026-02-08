/**
 * Hook: useAIModelLabel
 *
 * Shared hook for displaying the AI model label and detecting fallback usage
 * across post summary, thread summary, and multi-page summary modals.
 */

import { useSettingsStore } from '@/store/settings-store'
import { getAvailableModels } from '@/services/ai/gemini-service'
import { getAvailableGroqModels } from '@/services/ai/groq-service'

interface AIModelLabelResult {
	/** The model ID to display (actual if available, otherwise configured) */
	displayModel: string
	/** Human-readable model label (e.g. "Gemini 2.5 Flash") */
	modelLabel: string
	/** True if the actual model differs from the configured one (rate-limit fallback) */
	isModelFallback: boolean
	/** The model ID selected for the effective provider */
	configuredModel: string
	/** Provider selected in settings */
	configuredProvider: 'gemini' | 'groq'
	/** Provider that will actually be used based on available API keys */
	effectiveProvider: 'gemini' | 'groq'
	/** True when configured provider has no key and we auto-switch provider */
	isProviderFallback: boolean
	/** Human-readable provider fallback message */
	providerFallbackMessage: string | null
}

/**
 * Returns the display label and fallback status for the current AI model.
 *
 * @param actualModel - The model that actually processed the request (from API response),
 *                       or null if not yet known / still loading.
 */
export function useAIModelLabel(actualModel: string | null): AIModelLabelResult {
	const aiProvider = useSettingsStore(s => s.aiProvider)
	const aiModel = useSettingsStore(s => s.aiModel)
	const groqModel = useSettingsStore(s => s.groqModel)
	const geminiApiKey = useSettingsStore(s => s.geminiApiKey)
	const groqApiKey = useSettingsStore(s => s.groqApiKey)

	const hasGeminiKey = geminiApiKey.trim().length > 0
	const hasGroqKey = groqApiKey.trim().length > 0

	// Mirrors getAIService() provider fallback behavior to avoid misleading labels in UI.
	const effectiveProvider =
		aiProvider === 'gemini'
			? hasGeminiKey
				? 'gemini'
				: hasGroqKey
					? 'groq'
					: 'gemini'
			: hasGroqKey
				? 'groq'
				: hasGeminiKey
					? 'gemini'
					: 'groq'

	const configuredModel = effectiveProvider === 'groq' ? groqModel : aiModel
	const displayModel = actualModel || configuredModel

	const modelLabel = (() => {
		if (effectiveProvider === 'groq') {
			const models = getAvailableGroqModels()
			return models.find(m => m.value === displayModel)?.label || displayModel
		}
		const models = getAvailableModels()
		return models.find(m => m.value === displayModel)?.label || displayModel
	})()

	const isModelFallback = !!actualModel && actualModel !== configuredModel
	const isProviderFallback = aiProvider !== effectiveProvider
	const providerFallbackMessage = isProviderFallback
		? aiProvider === 'gemini'
			? 'Gemini no tiene API Key configurada. Se está usando Groq automáticamente.'
			: 'Groq no tiene API Key configurada. Se está usando Gemini automáticamente.'
		: null

	return {
		displayModel,
		modelLabel,
		isModelFallback,
		configuredModel,
		configuredProvider: aiProvider,
		effectiveProvider,
		isProviderFallback,
		providerFallbackMessage,
	}
}
