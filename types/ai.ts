/**
 * AI Service Types - Gemini API
 * Simplified for text generation (summaries, rewrites, etc.)
 */

// =============================================================================
// SERVICE TYPES
// =============================================================================

/**
 * AI Service interface - contract for Gemini implementation
 */
export interface AIService {
	/** Generate text from a custom prompt, optionally with context */
	generate(prompt: string, context?: string): Promise<string>

	/** Interactive chat with history. Returns all messages including the new response. */
	chat(history: ChatMessage[]): Promise<ChatMessage[]>

	/** Check if the service is available and ready */
	isAvailable(): Promise<boolean>

	/** Get the display name of the service */
	getName(): string
}



/**
 * Available Gemini models (free tier)
 */
export type GeminiModel =
	| 'gemini-3-flash-preview' // Recommended
	| 'gemini-2.5-flash' // Stable option
	| 'gemini-2.5-flash-lite' // Lite version

/** Combined AI model type for settings */
export type AIModel = GeminiModel

/**
 * AI Service configuration stored in settings
 */
export interface AIConfig {
	geminiApiKey: string
	aiModel: GeminiModel
}

// =============================================================================
// CHAT TYPES (Simplified - no tools)
// =============================================================================

export interface ChatMessage {
	role: 'user' | 'model' | 'system'
	parts: ChatPart[]
}

export type ChatPart = { text: string }

// =============================================================================
// GEMINI API RESPONSE TYPES
// =============================================================================

/**
 * Part in Gemini API response content
 */
export interface GeminiResponsePart {
	text?: string
}

/**
 * Candidate in Gemini API response
 */
export interface GeminiCandidate {
	content?: {
		parts?: GeminiResponsePart[]
		role?: string
	}
	finishReason?: string
	safetyRatings?: Array<{
		category: string
		probability: string
	}>
}

/**
 * Full Gemini API response structure
 */
export interface GeminiAPIResponse {
	candidates?: GeminiCandidate[]
	promptFeedback?: {
		safetyRatings?: Array<{
			category: string
			probability: string
		}>
	}
	error?: {
		code?: number
		message?: string
		status?: string
	}
}

/**
 * Request body for Gemini API
 */
export interface GeminiRequestBody {
	systemInstruction?: {
		parts: Array<{ text: string }>
	}
	contents?: Array<{
		role: 'user' | 'model'
		parts: Array<{ text: string }>
	}>
	generationConfig?: {
		temperature?: number
		topK?: number
		topP?: number
		maxOutputTokens?: number
	}
}

/**
 * Result from Gemini generation (internal use)
 */
export interface GeminiGenerationResult {
	success: boolean
	text?: string
	error?: string
}
