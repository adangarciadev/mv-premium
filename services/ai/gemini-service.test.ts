import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetSettings = vi.hoisted(() => vi.fn())
const mockSendMessage = vi.hoisted(() => vi.fn())

vi.mock('@/store/settings-store', () => ({
	getSettings: mockGetSettings,
}))

vi.mock('@/lib/messaging', () => ({
	sendMessage: mockSendMessage,
}))

import { getAIService, testGeminiConnection } from './gemini-service'

describe('GeminiService', () => {
	beforeEach(() => {
		mockGetSettings.mockReset()
		mockSendMessage.mockReset()
	})

	it('creates a service when Gemini is configured without sending the API key through messaging', async () => {
		mockGetSettings.mockResolvedValue({
			geminiApiKey: 'test-gemini-key',
			aiModel: 'gemini-2.5-flash',
		})
		mockSendMessage.mockResolvedValue({
			success: true,
			text: 'Respuesta generada',
			modelUsed: 'gemini-2.5-flash',
		})

		const service = await getAIService()
		expect(service).not.toBeNull()

		await service?.chat([{ role: 'user', parts: [{ text: 'Resume esto' }] }])

		expect(mockSendMessage).toHaveBeenCalledWith('generateGemini', {
			model: 'gemini-2.5-flash',
			history: [{ role: 'user', parts: [{ text: 'Resume esto' }] }],
		})
		expect(mockSendMessage.mock.calls[0][1]).not.toHaveProperty('apiKey')
	})

	it('tests Gemini connection through a no-data background message', async () => {
		mockSendMessage.mockResolvedValue({
			success: true,
			message: 'Conexion correcta. 1 modelos disponibles (1 Gemini).',
			availableModelIds: ['gemini-2.5-flash'],
		})

		const result = await testGeminiConnection()

		expect(result.success).toBe(true)
		expect(mockSendMessage).toHaveBeenCalledWith('testGeminiConnection', undefined)
	})
})
