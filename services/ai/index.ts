/**
 * AI Services Index
 * Centralized export for AI-related functionality
 */

export { getAIService, testGeminiConnection, getAvailableModels, getLastModelUsed, setLastModelUsed } from './gemini-service'
export { getAvailableGroqModels, testGroqConnection } from './groq-service'
export { sanitizeHistory, buildFullPrompt, extractModelResponse, parseAIJsonResponse } from './shared'
