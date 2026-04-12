/**
 * Hook: useAIModelLabel
 *
 * Shared hook for displaying the AI model label and detecting fallback usage
 * across post summary, thread summary, and multi-page summary modals.
 */

import { useSettingsStore } from '@/store/settings-store'
import { getAvailableModels } from '@/services/ai/gemini-service'

interface AIModelLabelResult {
	/** The model ID to display (actual if available, otherwise configured) */
	displayModel: string
	/** Human-readable model label (e.g. "Gemini 2.5 Flash") */
	modelLabel: string
	/** True if the actual model differs from the configured one (rate-limit fallback) */
	isModelFallback: boolean
	/** The model ID selected in settings */
	configuredModel: string
}

/**
 * Returns the display label and fallback status for the current AI model.
 *
 * @param actualModel - The model that actually processed the request (from API response),
 *                       or null if not yet known / still loading.
 */
export function useAIModelLabel(actualModel: string | null): AIModelLabelResult {
	const aiModel = useSettingsStore(s => s.aiModel)
	const configuredModel = aiModel
	const displayModel = actualModel || configuredModel

	const models = getAvailableModels()
	const modelLabel = models.find(m => m.value === displayModel)?.label || displayModel

	const isModelFallback = !!actualModel && actualModel !== configuredModel

	return {
		displayModel,
		modelLabel,
		isModelFallback,
		configuredModel,
	}
}
